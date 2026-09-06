// Withdrawal request: holds funds atomically, records a reviewable request,
// and pays out immediately for low-risk amounts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMpesaPayout } from "../_shared/payout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const friendly = (msg: string): string => {
  if (msg.startsWith("BELOW_MINIMUM")) return `Minimum withdrawal is KES ${msg.split(":")[1] ?? "100"}`;
  if (msg.includes("PHONE_NOT_VERIFIED")) return "Add a valid Kenyan phone number (2547…) to your profile first";
  if (msg.includes("INSUFFICIENT_OR_CAPPED")) return "Not enough available balance, or you have hit the KES 50,000 daily limit";
  if (msg.includes("WALLET_NOT_FOUND")) return "Wallet not found";
  return msg;
};

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
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Enter a valid amount" }, 400);

    // Risk gate before any money moves.
    const riskRes = await fetch(`${SUPABASE_URL}/functions/v1/evaluate-risk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ user_id: user.id, action: "withdraw", amount }),
    }).catch(() => null);
    const riskJson = riskRes ? await riskRes.json().catch(() => ({})) : {};
    if (riskJson?.data?.action && riskJson.data.action !== "allow") {
      return json({ error: riskJson.data.reason ?? "Withdrawal blocked for review" }, 403);
    }

    const { data: request, error: reqErr } = await db.rpc("fn_request_withdrawal", {
      p_user_id: user.id,
      p_amount: amount,
      p_phone: null,
    });
    if (reqErr) return json({ error: friendly(reqErr.message) }, 400);

    const req_ = request as any;

    await db.from("event_log").insert({
      event_type: "withdrawal.requested",
      aggregate_type: "withdrawal_request",
      aggregate_id: req_.request_id,
      actor_id: user.id,
      idempotency_key: `withdraw_req_${req_.request_id}`,
      payload: { amount, phone: req_.phone, auto_approved: req_.auto_approved },
    }).select("id").maybeSingle();

    if (!req_.auto_approved) {
      return json({
        success: true,
        status: "under_review",
        request_id: req_.request_id,
        message: "Withdrawal submitted for review",
      });
    }

    // Auto path: execute the payout now.
    const { data: profile } = await db.from("profiles").select("username, full_name").eq("id", user.id).maybeSingle();
    const payout = await sendMpesaPayout({
      phone: req_.phone,
      amount,
      name: (profile as any)?.full_name || profile?.username || "Pagaza Bet player",
      narrative: "Pagaza Bet withdrawal",
    });

    if (!payout.ok) {
      // Keep the funds held and hand the request to an admin.
      await db.from("withdrawal_requests").update({
        auto_approved: false,
        failure_reason: payout.error.slice(0, 500),
      }).eq("id", req_.request_id);
      await db.from("payment_failures").insert({
        provider: "intasend",
        operation: "withdrawal_payout",
        reference: req_.reference,
        user_id: user.id,
        amount,
        error_message: payout.error.slice(0, 1000),
        payload: { request_id: req_.request_id },
        status: "pending",
      });
      return json({
        success: true,
        status: "under_review",
        request_id: req_.request_id,
        message: "Withdrawal submitted for review",
      });
    }

    const { error: settleErr } = await db.rpc("fn_admin_settle_withdrawal", {
      p_request_id: req_.request_id,
      p_admin_id: user.id,
      p_reference: payout.reference,
    });
    if (settleErr) {
      await db.from("payment_failures").insert({
        provider: "intasend",
        operation: "withdrawal_settle",
        reference: payout.reference,
        user_id: user.id,
        amount,
        error_message: settleErr.message.slice(0, 1000),
        payload: { request_id: req_.request_id },
        status: "pending",
      });
      return json({ error: "Payout sent but bookkeeping failed — support has been alerted" }, 500);
    }

    await db.from("withdrawal_requests").update({ auto_approved: true, provider: "intasend" }).eq("id", req_.request_id);

    return json({
      success: true,
      status: "paid",
      request_id: req_.request_id,
      payout_reference: payout.reference,
      message: `KES ${amount.toLocaleString()} sent to ${req_.phone}`,
    });
  } catch (e) {
    console.error("pesapal-withdraw error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
