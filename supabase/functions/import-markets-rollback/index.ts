// Rollback: cancel markets published from a batch
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
    if (!roleSet.has("admin") && !roleSet.has("super_admin")) return json({ error: "Forbidden" }, 403);

    const { batchId } = await req.json();
    if (!batchId) return json({ error: "batchId required" }, 400);

    const { data: rows } = await admin.from("market_import_rows")
      .select("id, published_market_id").eq("batch_id", batchId)
      .not("published_market_id", "is", null);

    const marketIds = (rows ?? []).map((r: any) => r.published_market_id).filter(Boolean);
    let rolled = 0;
    if (marketIds.length) {
      // Only cancel markets that are still open (never touch resolved/traded outcomes)
      const { data: updated } = await admin.from("markets")
        .update({ status: "cancelled" })
        .in("id", marketIds)
        .eq("status", "open")
        .select("id");
      rolled = updated?.length ?? 0;
    }

    await admin.from("market_import_batches").update({ status: "rolled_back" }).eq("id", batchId);
    await admin.from("market_import_audit").insert({
      batch_id: batchId, operator_id: user.id, action: "rollback",
      payload: { rolledBack: rolled, requested: marketIds.length },
    });

    return json({ rolledBack: rolled });
  } catch (e: any) {
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
