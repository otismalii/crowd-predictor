// Creates a Pesapal payment intent and returns the checkout redirect url.
// The wallet is NOT credited here — only the verified IPN/status path credits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIpnId, getPesaPalToken, logPaymentFailure, PESAPAL_BASE } from "../_shared/pesapal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
    const phone_number: string | null = body?.phone_number ?? null;
    const callback_url: string | null = body?.callback_url ?? null;

    const { data: settings } = await db
      .from("app_settings")
      .select("key, value")
      .in("key", ["deposit_min_kes", "deposit_max_kes"]);
    const setting = (k: string, d: number) => {
      const v = settings?.find((s) => s.key === k)?.value;
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };
    const min = setting("deposit_min_kes", 10);
    const max = setting("deposit_max_kes", 150000);

    if (!Number.isFinite(amount) || amount < min) return json({ error: `Minimum deposit is KES ${min}` }, 400);
    if (amount > max) return json({ error: `Maximum single deposit is KES ${max.toLocaleString()}` }, 400);

    const { data: wallet } = await db.from("wallets").select("id").eq("user_id", user.id).maybeSingle();
    if (!wallet) return json({ error: "Wallet not found" }, 400);

    const token = await getPesaPalToken();
    const ipnId = await getIpnId(db, token, `${SUPABASE_URL}/functions/v1/pesapal-callback`);

    const reference = `PAG-${Date.now()}-${user.id.slice(0, 8)}`;
    const { data: tx, error: txError } = await db.from("transactions").insert({
      user_id: user.id,
      wallet_id: wallet.id,
      type: "deposit",
      amount,
      status: "pending",
      phone_number,
      reference,
      description: `Pesapal deposit of KES ${amount}`,
      metadata: { provider: "pesapal", ipn_id: ipnId },
    }).select("id").single();
    if (txError) throw txError;

    const orderRes = await fetch(`${PESAPAL_BASE}/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: reference,
        currency: "KES",
        amount,
        description: `Betwise deposit KES ${amount}`,
        callback_url: callback_url || `${SUPABASE_URL}/functions/v1/pesapal-callback?source=redirect`,
        notification_id: ipnId,
        billing_address: { email_address: user.email || "", phone_number: phone_number || "" },
      }),
    });
    const order = await orderRes.json().catch(() => ({}));

    if (!order?.redirect_url) {
      await db.from("transactions").update({
        status: "failed",
        description: `Pesapal rejected the order`,
        metadata: { provider: "pesapal", error: order },
        updated_at: new Date().toISOString(),
      }).eq("id", tx.id);
      await logPaymentFailure(db, {
        operation: "deposit_submit",
        reference,
        userId: user.id,
        amount,
        error: JSON.stringify(order).slice(0, 500),
        payload: order,
      });
      return json({ error: "Could not start the payment. Please try again." }, 502);
    }

    await db.from("transactions").update({
      pesapal_tracking_id: order.order_tracking_id,
      metadata: { provider: "pesapal", ipn_id: ipnId, order_tracking_id: order.order_tracking_id },
      updated_at: new Date().toISOString(),
    }).eq("id", tx.id);

    return json({
      success: true,
      redirect_url: order.redirect_url,
      order_tracking_id: order.order_tracking_id,
      transaction_id: tx.id,
      reference,
    });
  } catch (e) {
    console.error("pesapal-deposit error:", e);
    await logPaymentFailure(db, {
      operation: "deposit_intent",
      error: e instanceof Error ? e.message : "unknown",
    }).catch(() => {});
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
