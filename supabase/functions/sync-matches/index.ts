import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Free plan leagues
const FREE_LEAGUES = [501, 271]; // Scottish Premiership, Danish Superliga

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SPORTMONKS_API_KEY = Deno.env.get("SPORTMONKS_API_KEY");
    if (!SPORTMONKS_API_KEY) throw new Error("SPORTMONKS_API_KEY not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let roundId: string | null = null;
    try {
      const body = await req.json();
      roundId = body?.round_id || null;
    } catch { /* no body */ }

    const baseParams = `api_token=${SPORTMONKS_API_KEY}`;
    const rows: any[] = [];
    const seenIds = new Set<string>();

    const addFixtures = (fixtures: any[], forceStatus?: string) => {
      if (!Array.isArray(fixtures)) return;
      for (const fix of fixtures) {
        const id = String(fix.id);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        rows.push(parseFixture(fix, forceStatus));
      }
    };

    // 1. Inplay livescores
    console.log("1. Fetching inplay livescores...");
    const r1 = await safeFetch(`https://api.sportmonks.com/v3/football/livescores/inplay?${baseParams}&include=participants;scores;league`);
    if (r1) addFixtures(r1.data, "live");
    console.log(`   Inplay: ${r1?.data?.length || 0}`);

    // 2. All livescores (scheduled today)
    console.log("2. Fetching all livescores...");
    const r2 = await safeFetch(`https://api.sportmonks.com/v3/football/livescores?${baseParams}&include=participants;scores;league`);
    if (r2) addFixtures(r2.data);
    console.log(`   All live: ${r2?.data?.length || 0}`);

    // 3. Upcoming fixtures by date range (next 14 days) for free leagues
    const today = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    console.log(`3. Fetching fixtures ${today} to ${future}...`);
    const r3 = await safeFetch(
      `https://api.sportmonks.com/v3/football/fixtures/between/${today}/${future}?${baseParams}&include=participants;league;scores&per_page=150`
    );
    if (r3) addFixtures(r3.data);
    console.log(`   Date range: ${r3?.data?.length || 0}`);

    // 4. Optional round fixtures
    if (roundId) {
      console.log(`4. Fetching round ${roundId}...`);
      const r4 = await safeFetch(
        `https://api.sportmonks.com/v3/football/rounds/${roundId}?${baseParams}&include=fixtures.participants;fixtures.scores;league&filters=markets:1;bookmakers:2`
      );
      if (r4?.data?.fixtures) addFixtures(r4.data.fixtures);
      console.log(`   Round: ${r4?.data?.fixtures?.length || 0}`);
    }

    // 5. Schedules by season for each free league (gets all upcoming)
    for (const leagueId of FREE_LEAGUES) {
      console.log(`5. Fetching seasons for league ${leagueId}...`);
      const leagueRes = await safeFetch(
        `https://api.sportmonks.com/v3/football/leagues/${leagueId}?${baseParams}&include=currentSeason`
      );
      const seasonId = leagueRes?.data?.current_season_id;
      if (seasonId) {
        console.log(`   Season ${seasonId} — fetching schedule...`);
        const schedRes = await safeFetch(
          `https://api.sportmonks.com/v3/football/schedules/seasons/${seasonId}?${baseParams}&include=rounds.fixtures.participants;rounds.fixtures.scores`
        );
        // Schedule returns rounds with fixtures
        const rounds = schedRes?.data || [];
        if (Array.isArray(rounds)) {
          for (const round of rounds) {
            const fixtures = round.fixtures || [];
            addFixtures(fixtures);
          }
        }
        console.log(`   Schedule fixtures added`);
      }
    }

    // Bulk upsert
    let upsertCount = 0;
    if (rows.length > 0) {
      const { data: upserted, error } = await supabase
        .from("matches")
        .upsert(rows, { onConflict: "external_match_id" })
        .select("id");

      if (error) {
        console.error("Upsert error:", JSON.stringify(error));
      } else {
        upsertCount = upserted?.length || 0;
      }
    }

    console.log(`Done: synced ${upsertCount} of ${rows.length} total`);

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

async function safeFetch(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      console.log(`   API ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }
    return JSON.parse(text);
  } catch (e) {
    console.error(`   Fetch error: ${e}`);
    return null;
  }
}

function parseFixture(fix: any, forceStatus?: string) {
  const participants = fix.participants || [];
  const home = participants.find((p: any) => p.meta?.location === "home");
  const away = participants.find((p: any) => p.meta?.location === "away");

  let homeScore: number | null = null;
  let awayScore: number | null = null;
  const scores = fix.scores || [];
  if (Array.isArray(scores)) {
    for (const s of scores) {
      if (s.score?.participant === "home") homeScore = s.score?.goals ?? homeScore;
      if (s.score?.participant === "away") awayScore = s.score?.goals ?? awayScore;
    }
  }

  return {
    external_match_id: String(fix.id),
    league: fix.league?.name || "Unknown League",
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
