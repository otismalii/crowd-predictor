// LOGIK Oracle — single entrypoint for all AI suggestion/analysis actions.
// Provider: NVIDIA NIM (OpenAI-compatible chat completions).
// Invariant: this function never publishes markets, never settles, never moves funds.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";

type Action =
  | "detect_events"
  | "suggest_markets"
  | "score_quality"
  | "analyze_risk"
  | "propose_resolution";

interface CallReq {
  action: Action;
  payload?: Record<string, unknown>;
  triggered_by?: string;
}

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function callNim(messages: any[], model = DEFAULT_MODEL): Promise<{ text: string; latency_ms: number }> {
  const key = Deno.env.get("NVIDIA_API_KEY");
  if (!key) throw new Error("NVIDIA_API_KEY not set");
  const t0 = Date.now();
  const res = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  });
  const latency_ms = Date.now() - t0;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NIM ${res.status}: ${err.slice(0, 500)}`);
  }
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "";
  return { text, latency_ms };
}

function safeParseJson(text: string): any {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }
}

async function logRun(
  client: ReturnType<typeof db>,
  stage: string, action: string,
  input: any, output: any,
  model: string, latency_ms: number,
  status: string, error: string | null,
  triggered_by?: string,
): Promise<string | null> {
  const { data } = await client.from("oracle_runs").insert({
    pipeline_stage: stage, action, input, output, model, latency_ms, status, error,
    triggered_by: triggered_by ?? null,
  }).select("id").single();
  return data?.id ?? null;
}

// ---------------- Actions ----------------

async function detectEvents(client: ReturnType<typeof db>, _payload: any, triggered_by?: string) {
  const { data: sources } = await client
    .from("ingestion_logs")
    .select("id, source_id, payload, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(20);

  const sys = `You are LOGIK, a prediction-market event detector. Given recent ingestion payloads from sources, return JSON: {"events":[{"title":string,"summary":string,"domain":"sports|politics|economics|tech|entertainment|social","resolves_by":string|null,"source_ids":string[]}]}. Only include genuinely market-worthy events. Max 5.`;
  const user = JSON.stringify({ ingestion_logs: sources ?? [] });

  let output: any = null, error: string | null = null, latency_ms = 0;
  try {
    const r = await callNim([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    latency_ms = r.latency_ms;
    output = safeParseJson(r.text) ?? { raw: r.text };
  } catch (e: any) { error = e.message; }

  const run_id = await logRun(client, "ingestion", "detect_events",
    { count: sources?.length ?? 0 }, output, DEFAULT_MODEL, latency_ms,
    error ? "error" : "success", error, triggered_by);

  return { run_id, output, error };
}

async function suggestMarkets(client: ReturnType<typeof db>, payload: any, triggered_by?: string) {
  const event = payload?.event ?? {};
  const sys = `You are LOGIK, a prediction-market builder. Given an event, draft 1-3 binary/multi-outcome market specs. Return JSON: {"markets":[{"question":string,"description":string,"category":string,"domain":string,"outcomes":[{"label":string}],"resolution_criteria":string,"resolves_at":string,"sources":[{"url":string,"name":string}]}]}. Questions must be unambiguous, time-bounded, and verifiable.`;
  const user = JSON.stringify({ event });

  let output: any = null, error: string | null = null, latency_ms = 0;
  try {
    const r = await callNim([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    latency_ms = r.latency_ms;
    output = safeParseJson(r.text) ?? { raw: r.text };
  } catch (e: any) { error = e.message; }

  const run_id = await logRun(client, "suggestion", "suggest_markets",
    { event }, output, DEFAULT_MODEL, latency_ms,
    error ? "error" : "success", error, triggered_by);

  // Persist suggestions (status=draft, awaiting score)
  const inserted: any[] = [];
  if (output?.markets && Array.isArray(output.markets)) {
    for (const m of output.markets) {
      const { data } = await client.from("market_suggestions").insert({
        title: m.question,
        description: m.description,
        category: m.category ?? null,
        domain: m.domain ?? event?.domain ?? null,
        outcomes: m.outcomes ?? null,
        resolution_criteria: m.resolution_criteria ?? null,
        suggested_close: m.resolves_at ?? null,
        source_evidence: m.sources ?? null,
        oracle_run_id: run_id,
        status: "pending",
      }).select("id").single();
      if (data) inserted.push(data.id);
    }
  }

  return { run_id, output, inserted, error };
}

async function scoreQuality(client: ReturnType<typeof db>, payload: any, triggered_by?: string) {
  const suggestion_id = payload?.suggestion_id;
  const market_id = payload?.market_id;
  let subject: any = null;
  if (suggestion_id) {
    const { data } = await client.from("market_suggestions").select("*").eq("id", suggestion_id).single();
    subject = data;
  } else if (market_id) {
    const { data } = await client.from("markets").select("*").eq("id", market_id).single();
    subject = data;
  }
  if (!subject) return { error: "subject_not_found" };

  const sys = `You are LOGIK, scoring prediction-market quality. Return JSON: {"score":0-100,"breakdown":{"clarity":0-100,"resolution_certainty":0-100,"dispute_risk":0-100,"liquidity_potential":0-100,"popularity_potential":0-100},"reasoning":string,"risk_flags":string[]}. Score below 85 means the market needs revision.`;
  const user = JSON.stringify({ subject });

  let output: any = null, error: string | null = null, latency_ms = 0;
  try {
    const r = await callNim([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    latency_ms = r.latency_ms;
    output = safeParseJson(r.text) ?? { raw: r.text };
  } catch (e: any) { error = e.message; }

  const run_id = await logRun(client, "quality", "score_quality",
    { suggestion_id, market_id }, output, DEFAULT_MODEL, latency_ms,
    error ? "error" : "success", error, triggered_by);

  const score = Number(output?.score);
  if (!error && Number.isFinite(score)) {
    await client.from("market_quality_scores").insert({
      market_id: market_id ?? null,
      suggestion_id: suggestion_id ?? null,
      score: Math.round(score),
      breakdown: output?.breakdown ?? {},
      oracle_run_id: run_id,
    });
    if (suggestion_id) {
      await client.from("market_suggestions").update({
        quality_score: Math.round(score),
        quality_breakdown: output?.breakdown ?? {},
        risk_flags: output?.risk_flags ?? null,
        oracle_run_id: run_id,
        status: score < 85 ? "needs_revision" : "pending",
      }).eq("id", suggestion_id);
    }
  }

  return { run_id, output, error };
}

async function analyzeRisk(client: ReturnType<typeof db>, payload: any, triggered_by?: string) {
  const market_id = payload?.market_id;
  const { data: market } = await client.from("markets").select("*").eq("id", market_id).single();
  const { data: trades } = await client.from("trades").select("user_id, shares, price_per_share, created_at")
    .eq("market_id", market_id).order("created_at", { ascending: false }).limit(50);

  const sys = `You are LOGIK risk analyst. Look for fraud, manipulation, wash trading, disputable resolution. Return JSON: {"risk_level":"low|medium|high|critical","signals":[{"type":string,"detail":string,"score":0-100}],"recommendation":string}.`;
  const user = JSON.stringify({ market, recent_trades: trades });

  let output: any = null, error: string | null = null, latency_ms = 0;
  try {
    const r = await callNim([{ role: "system", content: sys }, { role: "user", content: user }]);
    latency_ms = r.latency_ms;
    output = safeParseJson(r.text) ?? { raw: r.text };
  } catch (e: any) { error = e.message; }

  const run_id = await logRun(client, "risk", "analyze_risk",
    { market_id }, output, DEFAULT_MODEL, latency_ms,
    error ? "error" : "success", error, triggered_by);

  if (!error && output?.risk_level && output.risk_level !== "low") {
    for (const s of (output.signals ?? [])) {
      await client.from("risk_signals").insert({
        signal_type: s.type ?? "oracle_flag",
        severity: output.risk_level,
        market_id,
        metadata: { detail: s.detail, score: s.score, oracle_run_id: run_id },
      });
    }
  }
  return { run_id, output, error };
}

async function proposeResolution(client: ReturnType<typeof db>, payload: any, triggered_by?: string) {
  const market_id = payload?.market_id;
  const { data: market } = await client.from("markets").select("*, market_outcomes(*)").eq("id", market_id).single();
  const { data: sources } = await client.from("market_sources").select("*").eq("market_id", market_id);

  const sys = `You are LOGIK resolution oracle. Suggest an outcome only — humans decide. Return JSON: {"suggested_outcome_id":string|null,"confidence":0-100,"evidence":[{"source":string,"excerpt":string}],"reasoning":string}.`;
  const user = JSON.stringify({ market, sources });

  let output: any = null, error: string | null = null, latency_ms = 0;
  try {
    const r = await callNim([{ role: "system", content: sys }, { role: "user", content: user }]);
    latency_ms = r.latency_ms;
    output = safeParseJson(r.text) ?? { raw: r.text };
  } catch (e: any) { error = e.message; }

  const run_id = await logRun(client, "resolution", "propose_resolution",
    { market_id }, output, DEFAULT_MODEL, latency_ms,
    error ? "error" : "success", error, triggered_by);

  // Advisory only — never write to markets.resolved_outcome_id
  if (!error) {
    await client.from("market_audit_log").insert({
      market_id,
      action: "oracle_suggestion",
      details: { ...output, oracle_run_id: run_id },
    });
  }
  return { run_id, output, error };
}

// ---------------- HTTP ----------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as CallReq;
    const client = db();

    let result: any;
    switch (body.action) {
      case "detect_events":      result = await detectEvents(client, body.payload, body.triggered_by); break;
      case "suggest_markets":    result = await suggestMarkets(client, body.payload, body.triggered_by); break;
      case "score_quality":      result = await scoreQuality(client, body.payload, body.triggered_by); break;
      case "analyze_risk":       result = await analyzeRisk(client, body.payload, body.triggered_by); break;
      case "propose_resolution": result = await proposeResolution(client, body.payload, body.triggered_by); break;
      default: return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
