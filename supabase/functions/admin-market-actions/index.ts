// Admin market lifecycle actions: update / clone / close / publish / resolve / refund
// All actions require an admin/super_admin/market_manager role and a reason (audited).
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
    const isMgr = roleSet.has("admin") || roleSet.has("super_admin") || roleSet.has("market_manager");
    if (!isMgr) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { action, marketId, reason, patch, winningOutcomeId } = body as {
      action: string;
      marketId: string;
      reason?: string;
      patch?: Record<string, unknown>;
      winningOutcomeId?: string;
    };

    if (!action || !marketId) return json({ error: "action and marketId required" }, 400);
    if (["update", "close", "publish", "resolve", "refund", "cancel"].includes(action) && !reason?.trim()) {
      return json({ error: "reason is required" }, 400);
    }

    const audit = async (entryAction: string, details: Record<string, unknown>) => {
      await admin.from("market_audit_log").insert({
        market_id: marketId,
        action: entryAction,
        performed_by: user.id,
        details: { reason, ...details },
      });
      await admin.from("audit_logs").insert({
        actor_id: user.id,
        action: entryAction,
        resource_type: "market",
        resource_id: marketId,
        metadata: { reason, ...details },
      });
    };

    if (action === "update") {
      const allowed: Record<string, unknown> = {};
      const fields = ["title", "description", "category", "subcategory", "closes_at", "resolution_rule", "resolution_source", "tags", "image_url"];
      for (const k of fields) if (patch && k in patch) allowed[k] = (patch as any)[k];
      const { error } = await admin.from("markets").update(allowed).eq("id", marketId);
      if (error) return json({ error: error.message }, 500);
      await audit("market_updated", { fields: Object.keys(allowed) });
      return json({ ok: true });
    }

    if (action === "publish") {
      const { error } = await admin.from("markets").update({ status: "open" }).eq("id", marketId);
      if (error) return json({ error: error.message }, 500);
      await audit("market_published", {});
      return json({ ok: true });
    }

    if (action === "close") {
      const { error } = await admin.from("markets").update({ status: "closed" }).eq("id", marketId);
      if (error) return json({ error: error.message }, 500);
      await audit("market_closed", {});
      return json({ ok: true });
    }

    if (action === "cancel") {
      const { error } = await admin.from("markets").update({ status: "cancelled" }).eq("id", marketId);
      if (error) return json({ error: error.message }, 500);
      await audit("market_cancelled", {});
      return json({ ok: true });
    }

    if (action === "clone") {
      const { data: src, error: sErr } = await admin.from("markets").select("*").eq("id", marketId).single();
      if (sErr || !src) return json({ error: sErr?.message ?? "not found" }, 404);
      const { data: outcomes } = await admin.from("market_outcomes").select("label,sort_order").eq("market_id", marketId).order("sort_order");
      const cloneSlug = `${src.slug ?? "market"}-copy-${Date.now().toString(36)}`;
      const { data: clone, error: cErr } = await admin.from("markets").insert({
        title: `${src.title} (copy)`,
        description: src.description,
        slug: cloneSlug,
        category: src.category,
        subcategory: src.subcategory,
        closes_at: src.closes_at,
        resolution_rule: src.resolution_rule,
        resolution_source: src.resolution_source,
        liquidity_param: src.liquidity_param,
        tags: src.tags,
        image_url: src.image_url,
        created_by: user.id,
        status: "draft",
      }).select("id").single();
      if (cErr) return json({ error: cErr.message }, 500);
      if (outcomes?.length) {
        await admin.from("market_outcomes").insert(outcomes.map((o: any) => ({
          market_id: clone.id, label: o.label, sort_order: o.sort_order, pool_shares: 100,
        })));
      }
      await audit("market_cloned", { clonedFrom: marketId, newMarketId: clone.id });
      return json({ ok: true, newMarketId: clone.id });
    }

    if (action === "resolve") {
      if (!winningOutcomeId) return json({ error: "winningOutcomeId required" }, 400);
      // Evidence check enforced by DB trigger; add explicit source count sanity check
      const { count } = await admin.from("market_sources").select("id", { count: "exact", head: true }).eq("market_id", marketId);
      if (!count || count < 1) return json({ error: "Cannot resolve without at least one source" }, 400);

      // Write audit log FIRST so the resolution trigger sees it
      await audit("resolve", { winningOutcomeId });

      // Mark winning outcome
      const { data: outcomes } = await admin.from("market_outcomes").select("id").eq("market_id", marketId);
      for (const o of outcomes ?? []) {
        await admin.from("market_outcomes").update({ is_winner: o.id === winningOutcomeId }).eq("id", o.id);
      }

      const { error: mErr } = await admin.from("markets")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", marketId);
      if (mErr) return json({ error: mErr.message }, 500);

      // Enqueue settlement via system_jobs (handler runs the double-entry payout)
      await admin.from("system_jobs").insert({
        job_type: "settle-market",
        payload: { marketId, winningOutcomeId },
        status: "queued",
        scheduled_by: user.id,
      });

      return json({ ok: true });
    }

    if (action === "refund") {
      await audit("refund", {});
      const { error } = await admin.from("markets")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("id", marketId);
      if (error) return json({ error: error.message }, 500);
      await admin.from("system_jobs").insert({
        job_type: "refund-market",
        payload: { marketId },
        status: "queued",
        scheduled_by: user.id,
      });
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    console.error("admin-market-actions error", e);
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
