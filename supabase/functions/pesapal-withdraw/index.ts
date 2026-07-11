// Withdrawal request (Phase 2: lock-based, risk-evaluated, ledger-backed).
// Uses lock_for_withdrawal RPC to atomically move balance → locked_balance.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { amount } = await req.json();
    if (!amount || amount < 10) {
      return new Response(JSON.stringify({ error: "Minimum withdrawal is KES 10" }), { status: 400, headers: corsHeaders });
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await db.from("profiles").select("phone_number").eq("id", user.id).single();
    if (!profile?.phone_number) {
      return new Response(JSON.stringify({ error: "No phone number on profile. Add your phone number in profile settings first." }), { status: 400, headers: corsHeaders });
    }
    const phone_number = profile.phone_number;

    // Risk evaluation
    const riskRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evaluate-risk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ user_id: user.id, action: "withdraw", amount }),
    });
    const riskJson = await riskRes.json().catch(() => ({}));
    if (riskJson?.data?.action && riskJson.data.action !== "allow") {
      return new Response(JSON.stringify({ error: riskJson.data.reason }), { status: 403, headers: corsHeaders });
    }

    const { data: wallet } = await db.from("wallets").select("id, balance, locked_balance").eq("user_id", user.id).single();
    if (!wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), { status: 404, headers: corsHeaders });
    }

    // Atomic lock via RPC (enforces 50k/day cap)
    const { data: locked, error: lockErr } = await db.rpc("lock_for_withdrawal", {
      p_user_id: user.id, p_amount: amount,
    });
    if (lockErr || !locked) {
      return new Response(JSON.stringify({ error: "Insufficient balance or daily withdrawal cap reached" }), { status: 400, headers: corsHeaders });
    }

    const correlationId = crypto.randomUUID();
    const reference = `WDR-${Date.now()}-${user.id.slice(0, 8)}`;
    const idempotencyKey = `${user.id}:withdraw:${reference}`;

    // Event envelope
    const { data: ev } = await db.from("event_log").insert({
      event_type: "withdrawal.requested", aggregate_type: "transaction",
      actor_id: user.id, idempotency_key: idempotencyKey,
      payload: { amount, phone_number, reference, correlation_id: correlationId },
    }).select("id").single();

    const { data: tx } = await db.from("transactions").insert({
      user_id: user.id, wallet_id: wallet.id, type: "withdrawal", amount,
      status: "pending", phone_number, reference,
      description: `Withdrawal request of KES ${amount} to ${phone_number}`,
    }).select("id").single();

    // Re-read balance after lock
    const { data: walletAfter } = await db.from("wallets").select("balance").eq("id", wallet.id).single();

    await db.from("ledger_entries").insert({
      user_id: user.id, wallet_id: wallet.id, entry_type: "withdrawal_lock",
      amount: -amount, balance_after: Number(walletAfter?.balance ?? 0),
      reference_id: tx?.id, idempotency_key: `${idempotencyKey}:ledger`, event_id: ev?.id,
      description: `Withdrawal hold — pending admin approval`,
    });

    await db.from("notifications").insert({
      user_id: user.id, type: "withdrawal",
      title: "🦅 Withdrawal Submitted",
      message: `Your withdrawal of KES ${amount.toLocaleString()} is pending approval. Landing confirmed soon.`,
      link: "/wallet",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Withdrawal submitted for admin approval", transaction_id: tx?.id, correlation_id: correlationId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pesapal-withdraw error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
