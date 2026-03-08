import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const API_FOOTBALL_KEY = Deno.env.get("API_FOOTBALL_KEY");
    if (!API_FOOTBALL_KEY) throw new Error("API_FOOTBALL_KEY not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch upcoming fixtures from API-Football (next 7 days)
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}&status=NS`,
      {
        headers: {
          "x-apisports-key": API_FOOTBALL_KEY,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("API-Football error:", response.status, text);
      return new Response(JSON.stringify({ error: "API-Football request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const fixtures = data.response || [];

    let upsertCount = 0;
    for (const fix of fixtures) {
      const { error } = await supabase.from("matches").upsert(
        {
          external_match_id: String(fix.fixture.id),
          league: fix.league.name,
          home_team: fix.teams.home.name,
          away_team: fix.teams.away.name,
          kickoff: fix.fixture.date,
          status: "upcoming",
        },
        { onConflict: "external_match_id" }
      );
      if (!error) upsertCount++;
    }

    return new Response(
      JSON.stringify({ success: true, synced: upsertCount, total: fixtures.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync-matches error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
