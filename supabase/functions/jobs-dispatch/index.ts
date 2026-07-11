// Generic job dispatcher — invoked by pg_cron every minute.
// Claims queued jobs, invokes handler edge function, records outcome.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_SIZE = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Claim jobs atomically via RPC-less pattern (single UPDATE ... RETURNING).
  const { data: claimed, error: claimErr } = await admin.rpc("claim_jobs", { p_limit: BATCH_SIZE }).select();
  // If RPC doesn't exist yet, fall back to plain query.
  let jobs: any[] = claimed ?? [];
  if (claimErr || !claimed) {
    const { data } = await admin
      .from("system_jobs")
      .select("*")
      .eq("status", "queued")
      .lte("run_after", new Date().toISOString())
      .order("priority", { ascending: true })
      .order("run_after", { ascending: true })
      .limit(BATCH_SIZE);
    jobs = data ?? [];
    for (const j of jobs) {
      await admin.from("system_jobs").update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: (j.attempts ?? 0) + 1,
        locked_until: new Date(Date.now() + 5 * 60_000).toISOString(),
      }).eq("id", j.id).eq("status", "queued");
    }
  }

  const results: any[] = [];
  for (const job of jobs) {
    const started = Date.now();
    const { data: def } = await admin.from("job_definitions").select("*").eq("job_type", job.job_type).maybeSingle();
    const handler = def?.handler ?? job.job_type;
    let ok = false, resultBody: any = null, errMsg: string | null = null;

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/${handler}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ job_id: job.id, payload: job.payload ?? {} }),
      });
      const text = await resp.text();
      try { resultBody = JSON.parse(text); } catch { resultBody = { raw: text }; }
      ok = resp.ok;
      if (!ok) errMsg = `HTTP ${resp.status}: ${text.slice(0, 500)}`;
    } catch (e: any) {
      errMsg = e?.message ?? "handler invocation failed";
    }

    const duration = Date.now() - started;
    const attempts = (job.attempts ?? 0) + 1;
    const maxAttempts = job.max_attempts ?? 5;

    if (ok) {
      await admin.from("system_jobs").update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        result: resultBody,
        last_error: null,
      }).eq("id", job.id);
    } else if (attempts >= maxAttempts) {
      await admin.from("system_jobs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        result: resultBody,
        last_error: errMsg,
      }).eq("id", job.id);
    } else {
      const backoffSec = Math.min(300, 2 ** attempts * 10);
      await admin.from("system_jobs").update({
        status: "queued",
        last_error: errMsg,
        run_after: new Date(Date.now() + backoffSec * 1000).toISOString(),
        locked_until: null,
      }).eq("id", job.id);
    }
    results.push({ id: job.id, type: job.job_type, ok, duration });
  }

  // Enqueue cron-scheduled jobs whose next slot has arrived
  const { data: defs } = await admin.from("job_definitions").select("*").eq("enabled", true).not("cron_expression", "is", null);
  const enqueued: string[] = [];
  for (const d of defs ?? []) {
    // Simple guard: only enqueue if no pending or running row for this type
    const { count } = await admin.from("system_jobs")
      .select("id", { count: "exact", head: true })
      .eq("job_type", d.job_type)
      .in("status", ["queued", "running"]);
    if ((count ?? 0) > 0) continue;
    // Basic cron cadence check: if last succeeded/failed within cadence window, skip.
    const cadenceMs = cronCadenceMs(d.cron_expression);
    const { data: last } = await admin.from("system_jobs")
      .select("finished_at")
      .eq("job_type", d.job_type)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1).maybeSingle();
    if (last?.finished_at && Date.now() - new Date(last.finished_at).getTime() < cadenceMs) continue;

    await admin.from("system_jobs").insert({
      job_type: d.job_type,
      payload: d.default_payload ?? {},
      scheduled_by: "cron",
      max_attempts: 5,
    });
    enqueued.push(d.job_type);
  }

  return new Response(JSON.stringify({ ran: results.length, results, enqueued }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Approximate cadence in ms from a small cron subset ("* * * * *", "*/N * * * *", "0 * * * *", "0 N * * *")
function cronCadenceMs(cron: string): number {
  const parts = cron.trim().split(/\s+/);
  const m = parts[0];
  const h = parts[1];
  if (m.startsWith("*/")) return parseInt(m.slice(2), 10) * 60_000;
  if (m === "0" && h === "*") return 60 * 60_000;
  if (m === "0" && /^\d+$/.test(h)) return 24 * 60 * 60_000;
  return 60_000;
}
