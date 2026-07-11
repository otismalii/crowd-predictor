// Deno edge function: validate & persist a market import batch
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("super_admin") && !roleSet.has("market_manager")) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const pkg = body?.pkg;
    const rows = body?.rows;
    if (!pkg || !Array.isArray(rows)) return json({ error: "Invalid body" }, 400);

    const payload = JSON.stringify(pkg);
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    const payloadHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const summary = {
      total: rows.length,
      ready: rows.filter((r: any) => r.status === "ready").length,
      warning: rows.filter((r: any) => r.status === "warning").length,
      error: rows.filter((r: any) => r.status === "error").length,
    };

    const { data: batch, error: batchErr } = await admin.from("market_import_batches").insert({
      batch_name: pkg.batchName,
      generated_by: pkg.generatedBy,
      generated_at: pkg.generatedAt ? new Date(pkg.generatedAt).toISOString() : null,
      description: pkg.description ?? null,
      operator_id: user.id,
      source_mode: body?.sourceMode ?? "upload",
      raw_payload: pkg,
      payload_hash: payloadHash,
      markets_total: summary.total,
      markets_ready: summary.ready,
      markets_warned: summary.warning,
      markets_failed: summary.error,
      status: "validated",
    }).select("id").single();
    if (batchErr) return json({ error: batchErr.message }, 500);

    const rowInserts = rows.map((r: any) => ({
      batch_id: batch.id,
      row_index: r.rowIndex,
      raw_market: r.raw,
      normalized_market: r.normalized,
      slug: r.slug,
      question_hash: r.questionHash,
      status: r.status,
      issues: r.issues ?? [],
    }));
    const { error: rowsErr } = await admin.from("market_import_rows").insert(rowInserts);
    if (rowsErr) return json({ error: rowsErr.message }, 500);

    await admin.from("market_import_audit").insert({
      batch_id: batch.id, operator_id: user.id, action: "import",
      payload: { total: summary.total, generatedBy: pkg.generatedBy, sourceMode: body?.sourceMode ?? "upload" },
    });

    return json({ batchId: batch.id, summary });
  } catch (e: any) {
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
