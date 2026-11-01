// Admin finance actions: withdrawal approve / reject, platform funds seeding.
// Every action requires an admin role and a typed reason, and is audited.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMpesaPayout } from "../_shared/payout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKETS = ["user_funds", "platform_revenue", "liquidity_pool", "settlement_reserve", "operational_reserve"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await db.rpc("has_any_role", {
      _user_id: user.id,
      _roles: ["admin", "super_admin"],
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const reason = String(body?.reason ?? "").trim();
    if (!reason) return json({ error: "A reason is required" }, 400);

    if (action === "approve_withdrawal") {
      const requestId = String(body?.request_id ?? "");
      const { data: wr } = await db.from("withdrawal_requests").select("*").eq("id", requestId).maybeSingle();
      if (!wr) return json({ error: "Request not found" }, 404);
      if (!["pending", "approved", "processing"].includes(wr.status)) {
        return json({ error: "This request is no longer actionable" }, 400);
      }

      await db.from("withdrawal_requests").update({ status: "processing", reviewer_id: user.id, review_reason: reason }).eq("id", requestId);

      const payout = await sendMpesaPayout({
        phone: wr.phone_number ?? "",
        amount: Number(wr.amount),
        narrative: "Betwise withdrawal",
      });
      if (!payout.ok) {
        await db.from("withdrawal_requests").update({ status: "pending", failure_reason: payout.error.slice(0, 500) }).eq("id", requestId);
        return json({ error: `Payout failed: ${payout.error}` }, 502);
      }

      const { error: settleErr } = await db.rpc("fn_admin_settle_withdrawal", {
        p_request_id: requestId,
        p_admin_id: user.id,
        p_reference: payout.reference,
      });
      if (settleErr) return json({ error: settleErr.message }, 500);

      await db.from("notifications").insert({
        user_id: wr.user_id,
        type: "withdrawal",
        title: "Withdrawal paid",
        message: `KES ${Number(wr.amount).toLocaleString()} sent to ${wr.phone_number}`,
        link: "/wallet",
      });
      return json({ success: true, payout_reference: payout.reference });
    }

    if (action === "reject_withdrawal") {
      const requestId = String(body?.request_id ?? "");
      const { error } = await db.rpc("fn_admin_reject_withdrawal", {
        p_request_id: requestId,
        p_admin_id: user.id,
        p_reason: reason,
      });
      if (error) return json({ error: error.message }, 400);

      const { data: wr } = await db.from("withdrawal_requests").select("user_id, amount").eq("id", requestId).maybeSingle();
      if (wr) {
        await db.from("notifications").insert({
          user_id: wr.user_id,
          type: "withdrawal",
          title: "Withdrawal returned",
          message: `KES ${Number(wr.amount).toLocaleString()} is back in your wallet. ${reason}`,
          link: "/wallet",
        });
      }
      return json({ success: true });
    }

    if (action === "seed_treasury") {
      const bucket = String(body?.bucket ?? "");
      const direction = String(body?.direction ?? "in");
      const amount = Number(body?.amount);
      if (!BUCKETS.includes(bucket)) return json({ error: "Unknown fund pot" }, 400);
      if (!["in", "out"].includes(direction)) return json({ error: "Direction must be in or out" }, 400);
      if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Enter a valid amount" }, 400);

      const { data, error } = await db.rpc("fn_seed_platform_funds", {
        p_admin_id: user.id,
        p_bucket: bucket,
        p_amount: amount,
        p_direction: direction,
        p_reason: reason,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, result: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-finance-actions error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
