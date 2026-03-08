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

    // Fetch today's fixtures from SportMonks (single call with includes)
    const today = new Date().toISOString().split("T")[0];

    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/date/${today}?api_token=${SPORTMONKS_API_KEY}&include=participants;league&per_page=150`,
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("SportMonks error:", response.status, text);
      return new Response(JSON.stringify({ error: "SportMonks request failed", details: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const fixtures = data.data || [];

    // Build batch of rows for a single upsert
    const rows = fixtures.map((fix: any) => {
      const participants = fix.participants || [];
      const home = participants.find((p: any) => p.meta?.location === "home");
      const away = participants.find((p: any) => p.meta?.location === "away");

      return {
        external_match_id: String(fix.id),
        league: fix.league?.name || "Unknown League",
        home_team: home?.name || fix.name?.split(" vs ")?.[0] || "TBD",
        away_team: away?.name || fix.name?.split(" vs ")?.[1] || "TBD",
        kickoff: fix.starting_at,
        status: mapState(fix.state_id),
      };
    });

    // Single bulk upsert — economic DB usage
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

    return new Response(
      JSON.stringify({ success: true, synced: upsertCount, total: fixtures.length }),
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

// Map SportMonks state_id to our match_status enum
function mapState(stateId: number): string {
  // SportMonks states: 1=NS, 2=INP/1H, 3=HT, 4=INP/2H, 5=FT, 6=AET, 7=PEN, 8=BREAK, 9=SUSP, 10=INT, 11=ABD, 12=CANC, 13=PP, 14=DEL, 15=AWD, 16=WO, 17=AU, 18=ET_BREAK, 19=PEN_BREAK
  if (stateId === 1 || stateId === 17) return "upcoming";
  if ([2, 3, 4, 8, 18, 19].includes(stateId)) return "live";
  if ([5, 6, 7, 15, 16].includes(stateId)) return "finished";
  if ([13, 14].includes(stateId)) return "postponed";
  if ([9, 10, 11, 12].includes(stateId)) return "cancelled";
  return "upcoming";
}
