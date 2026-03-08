import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { match_id } = await req.json();
    if (!match_id) throw new Error("match_id required");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch match + predictions in parallel
    const [matchRes, predsRes] = await Promise.all([
      supabase.from("matches").select("*").eq("id", match_id).single(),
      supabase.from("predictions").select("predicted_home_score, predicted_away_score, confidence, analysis").eq("match_id", match_id),
    ]);

    const match = matchRes.data;
    if (matchRes.error || !match) throw new Error("Match not found");

    const predictions = predsRes.data || [];
    const predSummary = predictions.length > 0
      ? predictions.map((p: any) => `${p.predicted_home_score}-${p.predicted_away_score} (conf: ${p.confidence})`).join(", ")
      : "No community predictions yet";

    const avgHome = predictions.length > 0
      ? (predictions.reduce((s: number, p: any) => s + p.predicted_home_score, 0) / predictions.length).toFixed(1)
      : "N/A";
    const avgAway = predictions.length > 0
      ? (predictions.reduce((s: number, p: any) => s + p.predicted_away_score, 0) / predictions.length).toFixed(1)
      : "N/A";

    // Call Gemini API directly
    const geminiResponse = await fetch(
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

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini error:", geminiResponse.status, errText);
      throw new Error("Gemini API error: " + geminiResponse.status);
    }

    const geminiData = await geminiResponse.json();
    const aiSummary = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "No insight generated";

    // Store insight
    const { error: insertError } = await supabase.from("ai_insights").insert({
      match_id,
      ai_summary: aiSummary,
      community_prediction: `${avgHome} - ${avgAway}`,
    });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, insight: aiSummary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
