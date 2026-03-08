import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Get all accepted bets for finished matches that haven't been resolved
    const { data: bets, error: betsError } = await supabase
      .from("p2p_bets")
      .select("*, matches(home_score, away_score, status, home_team, away_team)")
      .eq("status", "accepted");

    if (betsError) throw betsError;
    if (!bets || bets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, resolved: 0, message: "No accepted bets to resolve" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let resolved = 0;

    for (const bet of bets) {
      const match = bet.matches;
      if (!match || match.status !== "finished" || match.home_score === null || match.away_score === null) {
        continue;
      }

      const actualHome = match.home_score;
      const actualAway = match.away_score;

      // Calculate accuracy: exact score = best, then goal difference, then result
      const challengerExact = bet.challenger_prediction_home === actualHome && bet.challenger_prediction_away === actualAway;
      const opponentExact = bet.opponent_prediction_home === actualHome && bet.opponent_prediction_away === actualAway;

      const challengerDiff = Math.abs(bet.challenger_prediction_home - actualHome) + Math.abs(bet.challenger_prediction_away - actualAway);
      const opponentDiff = Math.abs(bet.opponent_prediction_home - actualHome) + Math.abs(bet.opponent_prediction_away - actualAway);

      // Determine result direction for tiebreaker
      const actualResult = Math.sign(actualHome - actualAway); // 1=home, 0=draw, -1=away
      const challengerResult = Math.sign(bet.challenger_prediction_home - bet.challenger_prediction_away);
      const opponentResult = Math.sign(bet.opponent_prediction_home - bet.opponent_prediction_away);
      const challengerCorrectResult = challengerResult === actualResult ? 1 : 0;
      const opponentCorrectResult = opponentResult === actualResult ? 1 : 0;

      let winnerId: string | null = null;

      if (challengerExact && !opponentExact) {
        winnerId = bet.challenger_id;
      } else if (opponentExact && !challengerExact) {
        winnerId = bet.opponent_id;
      } else if (challengerDiff < opponentDiff) {
        winnerId = bet.challenger_id;
      } else if (opponentDiff < challengerDiff) {
        winnerId = bet.opponent_id;
      } else if (challengerCorrectResult > opponentCorrectResult) {
        winnerId = bet.challenger_id;
      } else if (opponentCorrectResult > challengerCorrectResult) {
        winnerId = bet.opponent_id;
      }
      // else: draw — winnerId stays null

      const totalPot = bet.stake_amount * 2;
      const houseCut = Math.round(totalPot * bet.house_cut_percent / 100);
      const winnerPayout = totalPot - houseCut;

      // Update bet
      const { error: updateError } = await supabase
        .from("p2p_bets")
        .update({
          status: "resolved",
          winner_id: winnerId,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", bet.id);

      if (updateError) {
        console.error(`Failed to resolve bet ${bet.id}:`, updateError);
        continue;
      }

      // Award reputation points to winner
      if (winnerId) {
        const { data: winnerProfile } = await supabase
          .from("profiles")
          .select("reputation_score")
          .eq("id", winnerId)
          .single();

        if (winnerProfile) {
          await supabase
            .from("profiles")
            .update({ reputation_score: winnerProfile.reputation_score + winnerPayout })
            .eq("id", winnerId);
        }

        // Notify winner
        await supabase.from("notifications").insert({
          user_id: winnerId,
          type: "bet_won",
          title: "🏆 You won a bet!",
          message: `You won ${winnerPayout} pts on ${match.home_team} vs ${match.away_team}! (${houseCut} pts house cut)`,
          link: "/challenges",
        });

        // Notify loser
        const loserId = winnerId === bet.challenger_id ? bet.opponent_id : bet.challenger_id;
        await supabase.from("notifications").insert({
          user_id: loserId,
          type: "bet_lost",
          title: "😢 Bet lost",
          message: `You lost your bet on ${match.home_team} vs ${match.away_team}. Better luck next time!`,
          link: "/challenges",
        });
      } else {
        // Draw — refund both minus half house cut each
        const refund = Math.round(bet.stake_amount - houseCut / 2);
        for (const uid of [bet.challenger_id, bet.opponent_id]) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("reputation_score")
            .eq("id", uid)
            .single();

          if (prof) {
            await supabase
              .from("profiles")
              .update({ reputation_score: prof.reputation_score + refund })
              .eq("id", uid);
          }

          await supabase.from("notifications").insert({
            user_id: uid,
            type: "bet_draw",
            title: "🤝 Bet drawn",
            message: `Your bet on ${match.home_team} vs ${match.away_team} was a draw. Refunded ${refund} pts.`,
            link: "/challenges",
          });
        }
      }

      resolved++;
      console.log(`Resolved bet ${bet.id}: winner=${winnerId || "draw"}, payout=${winnerPayout}`);
    }

    // Also check for badge unlocks for bet winners
    if (resolved > 0) {
      await checkBetBadges(supabase);
    }

    return new Response(
      JSON.stringify({ success: true, resolved }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("resolve-bets error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function checkBetBadges(supabase: any) {
  try {
    // Get badge definitions for bets
    const { data: betBadges } = await supabase
      .from("badges")
      .select("id, slug, threshold")
      .eq("category", "bets");

    if (!betBadges || betBadges.length === 0) return;

    // Get all users who have won bets
    const { data: winners } = await supabase
      .from("p2p_bets")
      .select("winner_id")
      .eq("status", "resolved")
      .not("winner_id", "is", null);

    if (!winners) return;

    // Count wins per user
    const winCounts: Record<string, number> = {};
    for (const w of winners) {
      winCounts[w.winner_id] = (winCounts[w.winner_id] || 0) + 1;
    }

    for (const [userId, count] of Object.entries(winCounts)) {
      for (const badge of betBadges) {
        if (count >= badge.threshold) {
          // Try to insert (unique constraint will prevent duplicates)
          await supabase.from("user_badges").upsert(
            { user_id: userId, badge_id: badge.id },
            { onConflict: "user_id,badge_id" }
          );
        }
      }
    }
  } catch (e) {
    console.log("Badge check error:", e);
  }
}
