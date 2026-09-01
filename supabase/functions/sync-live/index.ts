// sync-live — runs every minute via jobs-dispatch.
// 1) Refreshes today's fixtures (scores, minute, status) + in-match events from the provider layer.
// 2) Settles open match bets for every match that has reached "finished".
// Idempotent: provider upserts are keyed on external ids, settlement uses ledger idempotency keys.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const started = Date.now();
  let syncResult: unknown = null;
  let syncError: string | null = null;

  // ---- 1. refresh live/today fixtures via the provider layer
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/provider-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ window: "today", include_events: true, chain_markets: false }),
    });
    const text = await resp.text();
    try { syncResult = JSON.parse(text); } catch { syncResult = { raw: text.slice(0, 500) }; }
    if (!resp.ok) syncError = `provider-sync HTTP ${resp.status}`;
  } catch (e) {
    syncError = e instanceof Error ? e.message : String(e);
  }

  // ---- 2. watchdog: expire fixtures stuck in the wrong state (voids/refunds their bets)
  let expired: unknown = null;
  {
    const { data, error } = await db.rpc("fn_expire_stale_fixtures", {
      p_upcoming_grace_hours: 6,
      p_live_grace_hours: 4,
    });
    expired = error ? { error: error.message } : data;
  }

  // ---- 3. settle bets on finished / cancelled / postponed matches
  const settled: Record<string, unknown>[] = [];
  let betsPaid = 0;
  let betsLost = 0;
  let betsVoided = 0;

  const { data: openBets } = await db
    .from("match_bets")
    .select("match_id")
    .eq("status", "open")
    .limit(1000);

  const matchIds = [...new Set((openBets ?? []).map((b) => b.match_id))];

  if (matchIds.length) {
    const { data: finished } = await db
      .from("platform_matches")
      .select("id")
      .in("id", matchIds)
      .in("status", ["finished", "cancelled", "postponed"]);

    for (const m of finished ?? []) {
      const { data, error } = await db.rpc("fn_settle_match_bets", { p_match_id: m.id });
      if (error) {
        settled.push({ match_id: m.id, error: error.message });
        continue;
      }
      const r = (data ?? {}) as { slips_won?: number; slips_lost?: number; slips_void?: number };
      betsPaid += r.slips_won ?? 0;
      betsLost += r.slips_lost ?? 0;
      betsVoided += r.slips_void ?? 0;
      settled.push({ match_id: m.id, ...r });
    }
  }


  const durationMs = Date.now() - started;

  await db.from("ingestion_logs").insert({
    source_name: "job:sync-live",
    status: syncError ? "error" : "success",
    records_fetched: matchIds.length,
    records_processed: settled.length,
    error_message: syncError,
    raw_data: {
      duration_ms: durationMs,
      matches_settled: settled.length,
      bets_paid: betsPaid,
      bets_lost: betsLost,
      bets_voided: betsVoided,
      provider: syncResult,
    },
  });

  const body = {
    ok: !syncError,
    duration_ms: durationMs,
    provider_sync: syncResult,
    provider_error: syncError,
    matches_with_open_bets: matchIds.length,
    matches_settled: settled.length,
    bets_paid: betsPaid,
    bets_lost: betsLost,
    bets_voided: betsVoided,
    settlements: settled,
  };

  return new Response(JSON.stringify(body), {
    status: syncError ? 500 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
