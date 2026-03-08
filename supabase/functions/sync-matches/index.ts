import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TheSportsDB free API key
const TSDB_KEY = "123";
const TSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}`;

// Top football leagues to sync
const LEAGUES = [
  { id: 4328, name: "English Premier League" },
  { id: 4335, name: "La Liga" },
  { id: 4332, name: "Serie A" },
  { id: 4331, name: "Bundesliga" },
  { id: 4334, name: "Ligue 1" },
  { id: 4337, name: "Eredivisie" },
  { id: 4344, name: "Primeira Liga" },
  { id: 4359, name: "Scottish Premiership" },
  { id: 4346, name: "MLS" },
  { id: 4330, name: "UEFA Champions League" },
  { id: 4481, name: "UEFA Europa League" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const rows: any[] = [];
    const seenIds = new Set<string>();

    // 1. Fetch next events for each league (1 call per league)
    for (const league of LEAGUES) {
      try {
        const res = await safeFetch(`${TSDB_BASE}/eventsnextleague.php?id=${league.id}`);
        const events = res?.events || [];
        if (Array.isArray(events)) {
          for (const ev of events) {
            const id = String(ev.idEvent);
            if (seenIds.has(id)) continue;
            seenIds.add(id);
            rows.push(parseEvent(ev));
          }
        }
        console.log(`${league.name}: ${events?.length || 0} upcoming`);
      } catch (e) {
        console.log(`${league.name}: fetch failed`);
      }
    }

    // 2. Fetch past events for each league (for score updates)
    for (const league of LEAGUES) {
      try {
        const res = await safeFetch(`${TSDB_BASE}/eventspastleague.php?id=${league.id}`);
        const events = res?.events || [];
        if (Array.isArray(events)) {
          for (const ev of events) {
            const id = String(ev.idEvent);
            if (seenIds.has(id)) continue;
            seenIds.add(id);
            rows.push(parseEvent(ev));
          }
        }
        console.log(`${league.name}: ${events?.length || 0} past/results`);
      } catch (e) {
        console.log(`${league.name}: past fetch failed`);
      }
    }

    // 3. Also fetch today's events across all sports (for live coverage)
    const today = new Date().toISOString().split("T")[0];
    try {
      const res = await safeFetch(`${TSDB_BASE}/eventsday.php?d=${today}&s=Soccer`);
      const events = res?.events || [];
      if (Array.isArray(events)) {
        for (const ev of events) {
          const id = String(ev.idEvent);
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          rows.push(parseEvent(ev));
        }
      }
      console.log(`Today (${today}): ${events?.length || 0} soccer events`);
    } catch (e) {
      console.log("Today fetch failed");
    }

    // Bulk upsert
    let upsertCount = 0;
    if (rows.length > 0) {
      // Upsert in batches of 50 to avoid payload limits
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { data: upserted, error } = await supabase
          .from("matches")
          .upsert(batch, { onConflict: "external_match_id" })
          .select("id");

        if (error) {
          console.error(`Upsert batch ${i} error:`, JSON.stringify(error));
        } else {
          upsertCount += upserted?.length || 0;
        }
      }
    }

    // 4. Auto-generate AI insights for upcoming matches without one
    let insightsGenerated = 0;
    try {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (GEMINI_API_KEY) {
        // Get upcoming matches that don't have insights yet
        const { data: upcomingMatches } = await supabase
          .from("matches")
          .select("id, home_team, away_team, league, kickoff")
          .eq("status", "upcoming")
          .order("kickoff", { ascending: true })
          .limit(10);

        if (upcomingMatches && upcomingMatches.length > 0) {
          // Get existing insights
          const matchIds = upcomingMatches.map((m: any) => m.id);
          const { data: existingInsights } = await supabase
            .from("ai_insights")
            .select("match_id")
            .in("match_id", matchIds);

          const insightSet = new Set((existingInsights || []).map((i: any) => i.match_id));
          const needInsights = upcomingMatches.filter((m: any) => !insightSet.has(m.id));

          // Generate up to 5 insights per sync
          for (const match of needInsights.slice(0, 5)) {
            try {
              // Fetch community predictions
              const { data: preds } = await supabase
                .from("predictions")
                .select("predicted_home_score, predicted_away_score, confidence, analysis")
                .eq("match_id", match.id);

              const predictions = preds || [];
              const predSummary = predictions.length > 0
                ? predictions.map((p: any) => `${p.predicted_home_score}-${p.predicted_away_score} (conf: ${p.confidence})`).join(", ")
                : "No community predictions yet";
              const avgHome = predictions.length > 0
                ? (predictions.reduce((s: number, p: any) => s + p.predicted_home_score, 0) / predictions.length).toFixed(1)
                : "N/A";
              const avgAway = predictions.length > 0
                ? (predictions.reduce((s: number, p: any) => s + p.predicted_away_score, 0) / predictions.length).toFixed(1)
                : "N/A";

              const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{
                      parts: [{
                        text: `You are a football match analyst for PagazaBetz. Provide concise, insightful match analysis in 2-3 paragraphs. Include prediction, key factors, and confidence level.\n\nAnalyze this match:\n${match.home_team} vs ${match.away_team}\nLeague: ${match.league}\nKickoff: ${match.kickoff}\n\nCommunity predictions: ${predSummary}\nAverage community prediction: ${avgHome} - ${avgAway}\n\nProvide your analysis and prediction.`
                      }]
                    }],
                  }),
                }
              );

              if (geminiRes.ok) {
                const geminiData = await geminiRes.json();
                const aiSummary = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (aiSummary) {
                  await supabase.from("ai_insights").insert({
                    match_id: match.id,
                    ai_summary: aiSummary,
                    community_prediction: `${avgHome} - ${avgAway}`,
                  });
                  insightsGenerated++;
                  console.log(`AI insight generated for ${match.home_team} vs ${match.away_team}`);
                }
              } else {
                console.log(`Gemini error for ${match.id}: ${geminiRes.status}`);
              }
            } catch (e) {
              console.log(`Insight generation failed for ${match.id}:`, e);
            }
          }
        }
      } else {
        console.log("GEMINI_API_KEY not set, skipping AI insights");
      }
    } catch (e) {
      console.log("AI insights auto-generation error:", e);
    }

    console.log(`Done: synced ${upsertCount} of ${rows.length} total, generated ${insightsGenerated} AI insights`);

    // 5. Auto-run manage-markets to create/resolve markets
    let marketsCreated = 0;
    let marketsResolved = 0;
    try {
      const manageRes = await fetch(
        `${supabaseUrl}/functions/v1/manage-markets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
        }
      );
      if (manageRes.ok) {
        const manageData = await manageRes.json();
        marketsCreated = manageData.markets_created || 0;
        marketsResolved = manageData.markets_resolved || 0;
        console.log(`manage-markets: created ${marketsCreated}, resolved ${marketsResolved}`);
      } else {
        console.log(`manage-markets failed: ${manageRes.status}`);
      }
    } catch (e) {
      console.log("manage-markets chain error:", e);
    }

    return new Response(
      JSON.stringify({ success: true, synced: upsertCount, total: rows.length, insights_generated: insightsGenerated, markets_created: marketsCreated, markets_resolved: marketsResolved }),
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
      console.log(`API ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }
    return JSON.parse(text);
  } catch (e) {
    console.error(`Fetch error: ${e}`);
    return null;
  }
}

function parseEvent(ev: any) {
  const homeScore = ev.intHomeScore !== null && ev.intHomeScore !== "" ? parseInt(ev.intHomeScore) : null;
  const awayScore = ev.intAwayScore !== null && ev.intAwayScore !== "" ? parseInt(ev.intAwayScore) : null;

  // Build kickoff datetime
  const kickoff = ev.strTimestamp || `${ev.dateEvent}T${ev.strTime || "00:00:00"}+00:00`;

  return {
    external_match_id: String(ev.idEvent),
    league: ev.strLeague || "Unknown",
    home_team: ev.strHomeTeam || "TBD",
    away_team: ev.strAwayTeam || "TBD",
    kickoff,
    status: mapStatus(ev.strStatus, homeScore, awayScore),
    ...(homeScore !== null && !isNaN(homeScore) ? { home_score: homeScore } : {}),
    ...(awayScore !== null && !isNaN(awayScore) ? { away_score: awayScore } : {}),
  };
}

function mapStatus(status: string | null, homeScore: number | null, awayScore: number | null): string {
  if (!status || status === "Not Started" || status === "NS") return "upcoming";
  if (status === "Match Finished" || status === "FT" || status === "AET" || status === "AP") return "finished";
  if (status === "Postponed" || status === "PST") return "postponed";
  if (status === "Cancelled" || status === "CANC") return "cancelled";
  if (status === "1H" || status === "2H" || status === "HT" || status === "ET" || status === "Live" || status === "P") return "live";
  // If scores exist, likely finished
  if (homeScore !== null && awayScore !== null) return "finished";
  return "upcoming";
}
