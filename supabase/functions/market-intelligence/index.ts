// Market Intelligence — generates & caches AI briefings for a market.
// Invariant (LDX v4): never moves funds, never publishes, never settles.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPA_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";
const CACHE_TTL_MS = 30 * 60 * 1000;

type Body = {
  market_id?: string;
  force?: boolean;
  lang?: "en" | "sw";
  mode?: "top";
  limit?: number;
};

function safeJson(text: string): any {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }
}

async function callNim(messages: any[]): Promise<{ text: string; latency: number }> {
  const key = Deno.env.get("NVIDIA_API_KEY");
  if (!key) throw new Error("NVIDIA_API_KEY not set");
  const t0 = Date.now();
  const res = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: NVIDIA_MODEL, messages, temperature: 0.3, max_tokens: 1200,
      response_format: { type: "json_object" },
    }),
  });
  const latency = Date.now() - t0;
  if (!res.ok) throw new Error(`NIM ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return { text: j.choices?.[0]?.message?.content ?? "", latency };
}

function computeMetrics(market: any, outcomes: any[], trades: any[]) {
  const now = Date.now();
  const dayAgo = now - 24 * 3600 * 1000;
  const recent = trades.filter(t => new Date(t.created_at).getTime() >= dayAgo);

  let buy = 0, sell = 0;
  for (const t of recent) {
    const cost = Number(t.total_cost || 0);
    if (t.side === "buy") buy += cost; else sell += cost;
  }
  const totalRecent = buy + sell;
  const buy_pressure = totalRecent > 0 ? buy / totalRecent : 0.5;
  const sell_pressure = totalRecent > 0 ? sell / totalRecent : 0.5;

  // momentum: price change of highest-pool outcome over 24h (approx from trades)
  let momentum = 0;
  if (recent.length >= 2) {
    const first = Number(recent[recent.length - 1].price_per_share || 0);
    const last = Number(recent[0].price_per_share || 0);
    momentum = last - first;
  }

  const liquidity_score = Math.min(
    100,
    Math.round(Math.log10(Number(market.total_volume || 1) + Number(market.liquidity_param || 100)) * 20)
  );

  const timeline: Array<{ ts: string; label: string; kind: string }> = [];
  timeline.push({ ts: market.created_at, label: "Market created", kind: "create" });
  if (trades.length > 0) {
    const first = trades[trades.length - 1];
    timeline.push({ ts: first.created_at, label: "First trade", kind: "first_trade" });
  }
  if (market.closes_at) timeline.push({ ts: market.closes_at, label: "Closes", kind: "close" });
  if (market.resolved_at) timeline.push({ ts: market.resolved_at, label: "Resolved", kind: "resolve" });

  return { buy_pressure, sell_pressure, momentum, liquidity_score, timeline };
}

async function refreshOne(admin: ReturnType<typeof createClient>, marketId: string, lang: "en" | "sw" = "en") {
  const [{ data: market }, { data: outcomes }, { data: sources }, { data: trades }, { data: quality }] = await Promise.all([
    admin.from("markets").select("*").eq("id", marketId).single(),
    admin.from("market_outcomes").select("*").eq("market_id", marketId).order("sort_order"),
    admin.from("market_sources").select("url, publisher, source_type, snapshot_excerpt").eq("market_id", marketId).limit(10),
    admin.from("trades").select("side, shares, price_per_share, total_cost, created_at").eq("market_id", marketId).order("created_at", { ascending: false }).limit(200),
    admin.from("market_quality_scores").select("score").eq("market_id", marketId).order("created_at", { ascending: false }).limit(1),
  ]);

  if (!market) throw new Error("market not found");
  const metrics = computeMetrics(market, outcomes ?? [], trades ?? []);
  const confidence = quality?.[0]?.score ?? null;

  const sys = `You are LOGIK, a market analyst for the Pagaza intelligence platform. Respond in ${lang === "sw" ? "Swahili" : "English"}. Return JSON: {"summary":string (2-3 sentences), "bull_case":string (1-2 sentences), "bear_case":string (1-2 sentences), "risk_level":"low"|"medium"|"high"|"critical", "risk_notes":string (1 sentence)}. Ground your analysis in the provided market, outcomes and sources only. Be concise, neutral, and specific.`;
  const userPayload = { market: { title: market.title, description: market.description, category: market.category, closes_at: market.closes_at, status: market.status, total_volume: market.total_volume }, outcomes: (outcomes ?? []).map((o: any) => ({ label: o.label, pool_shares: o.pool_shares })), sources: sources ?? [], metrics };

  let ai: any = { summary: null, bull_case: null, bear_case: null, risk_level: "low", risk_notes: null };
  let oracle_run_id: string | null = null;
  try {
    const r = await callNim([{ role: "system", content: sys }, { role: "user", content: JSON.stringify(userPayload) }]);
    const parsed = safeJson(r.text);
    if (parsed) ai = { ...ai, ...parsed };
    const { data: run } = await admin.from("oracle_runs").insert({
      pipeline_stage: "intelligence", action: "market_briefing",
      input: { market_id: marketId }, output: parsed ?? { raw: r.text },
      model: NVIDIA_MODEL, latency_ms: r.latency, status: parsed ? "success" : "error", error: parsed ? null : "parse_error",
    }).select("id").single();
    oracle_run_id = run?.id ?? null;
  } catch (e: any) {
    await admin.from("oracle_runs").insert({
      pipeline_stage: "intelligence", action: "market_briefing",
      input: { market_id: marketId }, output: null, model: NVIDIA_MODEL,
      latency_ms: 0, status: "error", error: String(e?.message ?? e),
    });
  }

  const row = {
    market_id: marketId,
    summary: ai.summary, bull_case: ai.bull_case, bear_case: ai.bear_case,
    risk_level: ai.risk_level ?? "low", risk_notes: ai.risk_notes,
    confidence,
    momentum: metrics.momentum, buy_pressure: metrics.buy_pressure, sell_pressure: metrics.sell_pressure,
    liquidity_score: metrics.liquidity_score,
    event_timeline: metrics.timeline, sources: sources ?? [],
    generated_by: "logik-oracle", oracle_run_id, lang, generated_at: new Date().toISOString(),
  };
  const { data: upserted } = await admin.from("market_intelligence").upsert(row, { onConflict: "market_id" }).select("*").single();
  return upserted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const admin = createClient(SUPA_URL, SUPA_SERVICE);
    const lang: "en" | "sw" = body.lang === "sw" ? "sw" : "en";

    // Cron mode: refresh top N by 24h volume
    if (body.mode === "top") {
      const limit = Math.min(Math.max(body.limit ?? 25, 1), 100);
      const { data: markets } = await admin.from("markets").select("id, total_volume").eq("status", "open").order("total_volume", { ascending: false }).limit(limit);
      const results: any[] = [];
      for (const m of markets ?? []) {
        try { results.push({ id: m.id, ok: true, row: await refreshOne(admin, m.id, lang) }); }
        catch (e: any) { results.push({ id: m.id, ok: false, error: String(e?.message ?? e) }); }
      }
      return new Response(JSON.stringify({ ok: true, count: results.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const marketId = body.market_id;
    if (!marketId) {
      return new Response(JSON.stringify({ error: "market_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Authorize force: admin only
    let isAdmin = false;
    if (body.force) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (authHeader) {
        const userClient = createClient(SUPA_URL, SUPA_ANON, { global: { headers: { Authorization: authHeader } } });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const { data: ok } = await admin.rpc("has_any_role", { _user_id: user.id, _roles: ["admin", "super_admin"] });
          isAdmin = !!ok;
        }
      }
    }

    const { data: existing } = await admin.from("market_intelligence").select("*").eq("market_id", marketId).maybeSingle();
    const fresh = existing && (Date.now() - new Date(existing.generated_at).getTime() < CACHE_TTL_MS);
    if (existing && fresh && !(body.force && isAdmin)) {
      return new Response(JSON.stringify({ ok: true, cached: true, row: existing }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const row = await refreshOne(admin, marketId, lang);
    return new Response(JSON.stringify({ ok: true, cached: false, row }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
