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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch match data
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", match_id)
      .single();
    if (matchError || !match) throw new Error("Match not found");

    // Fetch community predictions for this match
    const { data: predictions } = await supabase
      .from("predictions")
      .select("predicted_home_score, predicted_away_score, confidence, analysis")
      .eq("match_id", match_id);

    const predSummary = predictions && predictions.length > 0
      ? predictions.map((p: any) => `${p.predicted_home_score}-${p.predicted_away_score} (conf: ${p.confidence})`).join(", ")
      : "No community predictions yet";

    const avgHome = predictions && predictions.length > 0
      ? (predictions.reduce((s: number, p: any) => s + p.predicted_home_score, 0) / predictions.length).toFixed(1)
      : "N/A";
    const avgAway = predictions && predictions.length > 0
      ? (predictions.reduce((s: number, p: any) => s + p.predicted_away_score, 0) / predictions.length).toFixed(1)
      : "N/A";

    // Generate AI insight
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a football match analyst for PagazaBetz. Provide concise, insightful match analysis in 2-3 paragraphs. Include prediction, key factors, and confidence level.",
          },
          {
            role: "user",
            content: `Analyze this match:\n${match.home_team} vs ${match.away_team}\nLeague: ${match.league}\nKickoff: ${match.kickoff}\n\nCommunity predictions: ${predSummary}\nAverage community prediction: ${avgHome} - ${avgAway}\n\nProvide your analysis and prediction.`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error: " + status);
    }

    const aiData = await aiResponse.json();
    const aiSummary = aiData.choices?.[0]?.message?.content || "No insight generated";

    // Store insight
    const { error: insertError } = await supabase.from("ai_insights").insert({
      match_id,
      ai_summary: aiSummary,
      community_prediction: `${avgHome} - ${avgAway}`,
    });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, insight: aiSummary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
