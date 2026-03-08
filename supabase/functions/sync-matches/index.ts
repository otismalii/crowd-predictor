import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SPORTMONKS_API_KEY = Deno.env.get("SPORTMONKS_API_KEY");
    if (!SPORTMONKS_API_KEY) throw new Error("SPORTMONKS_API_KEY not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional round_id from request body
    let roundId: string | null = null;
    try {
      const body = await req.json();
      roundId = body?.round_id || null;
    } catch { /* no body is fine */ }

    const baseParams = `api_token=${SPORTMONKS_API_KEY}`;
    const rows: any[] = [];

    // 1. Fetch inplay livescores (live matches)
    const liveUrl = `https://api.sportmonks.com/v3/football/livescores/inplay?${baseParams}&include=participants;scores;periods;events;league.country;round`;
    console.log("Fetching inplay livescores...");
    const liveRes = await fetch(liveUrl);
    const liveText = await liveRes.text();

    if (liveRes.ok) {
      const liveData = JSON.parse(liveText);
      const liveFixtures = liveData.data || [];
      console.log(`Inplay fixtures: ${Array.isArray(liveFixtures) ? liveFixtures.length : 0}`);

      if (Array.isArray(liveFixtures)) {
        for (const fix of liveFixtures) {
          rows.push(parseFixture(fix, "live"));
        }
      }
    } else {
      console.log("Livescores response:", liveText.slice(0, 300));
    }

    // 2. Fetch round fixtures (upcoming + scheduled matches with odds)
    if (roundId) {
      const roundUrl = `https://api.sportmonks.com/v3/football/rounds/${roundId}?${baseParams}&include=fixtures.odds.market;fixtures.odds.bookmaker;fixtures.participants;league.country&filters=markets:1;bookmakers:2`;
      console.log(`Fetching round ${roundId}...`);
      const roundRes = await fetch(roundUrl);
      const roundText = await roundRes.text();

      if (roundRes.ok) {
        const roundData = JSON.parse(roundText);
        const roundFixtures = roundData.data?.fixtures || [];
        console.log(`Round fixtures: ${roundFixtures.length}`);

        for (const fix of roundFixtures) {
          rows.push(parseFixture(fix));
        }
      } else {
        console.log("Round response:", roundText.slice(0, 300));
      }
    }

    // 3. Also fetch today's scheduled livescores (pre-match, about to start)
    const allLiveUrl = `https://api.sportmonks.com/v3/football/livescores?${baseParams}&include=participants;league.country;scores`;
    console.log("Fetching all livescores (scheduled + live)...");
    const allLiveRes = await fetch(allLiveUrl);
    const allLiveText = await allLiveRes.text();

    if (allLiveRes.ok) {
      const allData = JSON.parse(allLiveText);
      const allFixtures = allData.data || [];
      console.log(`All livescores: ${Array.isArray(allFixtures) ? allFixtures.length : 0}`);

      if (Array.isArray(allFixtures)) {
        for (const fix of allFixtures) {
          // Don't duplicate already-added inplay ones
          if (!rows.find(r => r.external_match_id === String(fix.id))) {
            rows.push(parseFixture(fix));
          }
        }
      }
    } else {
      console.log("All livescores response:", allLiveText.slice(0, 300));
    }

    // 4. Bulk upsert — single DB call
    let upsertCount = 0;
    if (rows.length > 0) {
      const { data: upserted, error } = await supabase
        .from("matches")
        .upsert(rows, { onConflict: "external_match_id" })
        .select("id");

      if (error) {
        console.error("Upsert error:", error);
      } else {
        upsertCount = upserted?.length || 0;
      }
    }

    console.log(`Done: synced ${upsertCount} of ${rows.length} fixtures`);

    return new Response(
      JSON.stringify({ success: true, synced: upsertCount, total: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sync-matches error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function parseFixture(fix: any, forceStatus?: string) {
  const participants = fix.participants || [];
  const home = participants.find((p: any) => p.meta?.location === "home");
  const away = participants.find((p: any) => p.meta?.location === "away");

  // Extract scores from scores array if available
  let homeScore: number | null = null;
  let awayScore: number | null = null;
  const scores = fix.scores || [];
  if (Array.isArray(scores)) {
    const currentScore = scores.find((s: any) => s.description === "CURRENT");
    if (currentScore) {
      homeScore = currentScore.score?.participant === "home" ? currentScore.score?.goals : null;
      awayScore = currentScore.score?.participant === "away" ? currentScore.score?.goals : null;
    }
    // Fallback: sum home/away goals from all score entries
    if (homeScore === null) {
      for (const s of scores) {
        if (s.score?.participant === "home") homeScore = s.score?.goals ?? homeScore;
        if (s.score?.participant === "away") awayScore = s.score?.goals ?? awayScore;
      }
    }
  }

  const leagueName = fix.league?.name || fix.league_id?.toString() || "Unknown League";

  return {
    external_match_id: String(fix.id),
    league: leagueName,
    home_team: home?.name || fix.name?.split(" vs ")?.[0] || "TBD",
    away_team: away?.name || fix.name?.split(" vs ")?.[1] || "TBD",
    kickoff: fix.starting_at,
    status: forceStatus || mapState(fix.state_id),
    ...(homeScore !== null ? { home_score: homeScore } : {}),
    ...(awayScore !== null ? { away_score: awayScore } : {}),
  };
}

function mapState(stateId: number): string {
  if (stateId === 1 || stateId === 17) return "upcoming";
  if ([2, 3, 4, 8, 18, 19].includes(stateId)) return "live";
  if ([5, 6, 7, 15, 16].includes(stateId)) return "finished";
  if ([13, 14].includes(stateId)) return "postponed";
  if ([9, 10, 11, 12].includes(stateId)) return "cancelled";
  return "upcoming";
}
