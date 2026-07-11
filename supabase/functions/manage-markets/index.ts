import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Creates markets for upcoming matches and resolves markets for finished matches.
 * Called after sync-matches or on a schedule.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let marketsCreated = 0;
    let marketsResolved = 0;

    // --- CREATE MARKETS FOR UPCOMING MATCHES ---
    const { data: upcomingMatches } = await db
      .from("matches")
      .select("id, home_team, away_team, league, kickoff")
      .eq("status", "upcoming")
      .order("kickoff", { ascending: true })
      .limit(50);

    if (upcomingMatches) {
      // Get existing market match_ids
      const { data: existingMarkets } = await db
        .from("markets")
        .select("match_id")
        .in("match_id", upcomingMatches.map(m => m.id));

      const existingSet = new Set((existingMarkets || []).map(m => m.match_id));

      for (const match of upcomingMatches) {
        if (existingSet.has(match.id)) continue;

        // Create "Match Result" market
        const { data: market } = await db.from("markets").insert({
          match_id: match.id,
          title: `${match.home_team} vs ${match.away_team}`,
          description: `${match.league} — Who wins?`,
          category: "match_result",
          liquidity_param: 100,
          closes_at: match.kickoff,
        }).select("id").single();

        if (market) {
          await db.from("market_outcomes").insert([
            { market_id: market.id, label: `${match.home_team} Win`, pool_shares: 100, sort_order: 0 },
            { market_id: market.id, label: "Draw", pool_shares: 100, sort_order: 1 },
            { market_id: market.id, label: `${match.away_team} Win`, pool_shares: 100, sort_order: 2 },
          ]);
          marketsCreated++;
        }

        // Create "Over/Under 2.5" market
        const { data: ouMarket } = await db.from("markets").insert({
          match_id: match.id,
          title: `${match.home_team} vs ${match.away_team} — Goals`,
          description: `${match.league} — Over or Under 2.5 goals?`,
          category: "over_under",
          liquidity_param: 100,
          closes_at: match.kickoff,
        }).select("id").single();

        if (ouMarket) {
          await db.from("market_outcomes").insert([
            { market_id: ouMarket.id, label: "Over 2.5", pool_shares: 100, sort_order: 0 },
            { market_id: ouMarket.id, label: "Under 2.5", pool_shares: 100, sort_order: 1 },
          ]);
          marketsCreated++;
        }
      }
    }

    // --- RESOLVE MARKETS FOR FINISHED MATCHES ---
    const { data: openMarkets } = await db
      .from("markets")
      .select("id, match_id, category")
      .eq("status", "open");

    if (openMarkets) {
      const matchIds = [...new Set(openMarkets.map(m => m.match_id).filter(Boolean))];
      const { data: finishedMatches } = await db
        .from("matches")
        .select("id, home_score, away_score, status")
        .in("id", matchIds)
        .eq("status", "finished");

      if (finishedMatches) {
        const matchMap = new Map(finishedMatches.map(m => [m.id, m]));

        for (const market of openMarkets) {
          const match = matchMap.get(market.match_id);
          if (!match || match.home_score === null || match.away_score === null) continue;

          const { data: outcomes } = await db.from("market_outcomes")
            .select("*").eq("market_id", market.id).order("sort_order");

          if (!outcomes) continue;

          let winnerIndex = -1;

          if (market.category === "match_result") {
            if (match.home_score > match.away_score) winnerIndex = 0; // home
            else if (match.home_score === match.away_score) winnerIndex = 1; // draw
            else winnerIndex = 2; // away
          } else if (market.category === "over_under") {
            const totalGoals = match.home_score + match.away_score;
            winnerIndex = totalGoals > 2.5 ? 0 : 1; // over or under
          }

          // Mark winner
          for (let i = 0; i < outcomes.length; i++) {
            await db.from("market_outcomes")
              .update({ is_winner: i === winnerIndex })
              .eq("id", outcomes[i].id);
          }

          // Resolve market
          await db.from("markets")
            .update({ status: "resolved", resolved_at: new Date().toISOString() })
            .eq("id", market.id);

          // Payout winning positions
          const winningOutcomeId = winnerIndex >= 0 ? outcomes[winnerIndex].id : null;

          if (winningOutcomeId) {
            const { data: winPositions } = await db.from("positions")
              .select("*")
              .eq("market_id", market.id)
              .eq("outcome_id", winningOutcomeId)
              .gt("shares", 0);

            for (const pos of (winPositions || [])) {
              // Each winning share pays out 1 KES
              const payout = Number(pos.shares);

              const { data: wallet } = await db.from("wallets")
                .select("id, balance").eq("user_id", pos.user_id).single();

              if (wallet) {
                await db.from("wallets")
                  .update({ balance: Number(wallet.balance) + payout, updated_at: new Date().toISOString() })
                  .eq("id", wallet.id);

                await db.from("transactions").insert({
                  user_id: pos.user_id,
                  wallet_id: wallet.id,
                  type: "bet_win",
                  amount: payout,
                  status: "completed",
                  description: `Market resolved: Won ${payout} KES on "${outcomes[winnerIndex].label}"`,
                });

                await db.from("notifications").insert({
                  user_id: pos.user_id,
                  type: "market_win",
                  title: "🏆 Market Resolved — You Won!",
                  message: `You won KES ${payout.toFixed(0)} on "${outcomes[winnerIndex].label}"`,
                  link: `/market/${market.id}`,
                });
              }
            }
          }

          marketsResolved++;
          console.log(`Resolved market ${market.id} — winner: ${winnerIndex >= 0 ? outcomes[winnerIndex].label : "none"}`);
        }
      }
    }

    // Close markets where kickoff has passed
    await db.from("markets")
      .update({ status: "closed" })
      .eq("status", "open")
      .lt("closes_at", new Date().toISOString());

    return new Response(
      JSON.stringify({ success: true, markets_created: marketsCreated, markets_resolved: marketsResolved }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("manage-markets error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
