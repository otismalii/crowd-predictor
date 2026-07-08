// Publish selected rows from a batch to markets + market_outcomes + market_sources
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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

    const { batchId, rowIndexes } = await req.json();
    if (!batchId) return json({ error: "batchId required" }, 400);

    await admin.from("market_import_batches").update({ status: "publishing" }).eq("id", batchId);

    let query = admin.from("market_import_rows").select("*").eq("batch_id", batchId).neq("status", "error").neq("status", "published").neq("status", "rejected");
    if (Array.isArray(rowIndexes) && rowIndexes.length) {
      query = query.in("row_index", rowIndexes);
    }
    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) return json({ error: rowsErr.message }, 500);

    let published = 0;
    let failed = 0;
    const results: any[] = [];

    for (const row of rows ?? []) {
      const m = row.normalized_market;
      if (!m) { failed++; continue; }
      try {
        // slug collision check
        const { data: existing } = await admin.from("markets").select("id").eq("slug", m.slug).maybeSingle();
        if (existing) throw new Error(`Slug "${m.slug}" already exists`);

        const { data: market, error: mErr } = await admin.from("markets").insert({
          title: m.question,
          description: m.description ?? null,
          slug: m.slug,
          category: m.category,
          subcategory: m.subcategory ?? null,
          closes_at: m.closesAt,
          resolution_rule: m.resolutionRules ?? null,
          liquidity_param: m.initialLiquidity ?? 500,
          image_url: m.imageUrl ?? null,
          tags: m.tags ?? [],
          created_by: user.id,
          status: "open",
        }).select("id").single();
        if (mErr) throw mErr;

        const outcomes = m.outcomes.map((o: any, i: number) => ({
          market_id: market.id, label: o.label, sort_order: i,
          pool_shares: 100,
        }));
        const { error: oErr } = await admin.from("market_outcomes").insert(outcomes);
        if (oErr) throw oErr;

        if (Array.isArray(m.sources) && m.sources.length) {
          await admin.from("market_sources").insert(m.sources.map((s: any) => ({
            market_id: market.id,
            source_type: s.sourceType ?? "official",
            source_name: s.publisher ?? s.url ?? "source",
            source_url: s.url ?? null,
          })));
        }

        await admin.from("market_import_rows").update({
          status: "published", published_market_id: market.id, published_at: new Date().toISOString(),
        }).eq("id", row.id);

        await admin.from("market_import_audit").insert({
          batch_id: batchId, row_id: row.id, operator_id: user.id, action: "publish",
          payload: { marketId: market.id, slug: m.slug },
        });

        published++;
        results.push({ rowIndex: row.row_index, status: "published", marketId: market.id });
      } catch (e: any) {
        failed++;
        await admin.from("market_import_rows").update({
          status: "failed", error_message: e?.message ?? "publish error",
        }).eq("id", row.id);
        results.push({ rowIndex: row.row_index, status: "failed", error: e?.message });
      }
    }

    // Update batch counters
    const { data: batchSummary } = await admin.from("market_import_rows").select("status").eq("batch_id", batchId);
    const pubTotal = (batchSummary ?? []).filter((r: any) => r.status === "published").length;
    const failTotal = (batchSummary ?? []).filter((r: any) => r.status === "failed").length;
    await admin.from("market_import_batches").update({
      markets_published: pubTotal,
      markets_failed: failTotal,
      status: "completed",
    }).eq("id", batchId);

    return json({ published, failed, rowResults: results });
  } catch (e: any) {
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
