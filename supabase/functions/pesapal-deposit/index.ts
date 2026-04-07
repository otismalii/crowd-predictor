import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PESAPAL_BASE = "https://pay.pesapal.com/v3/api";

async function getPesaPalToken(): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE}/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: Deno.env.get("PESAPAL_CONSUMER_KEY"),
      consumer_secret: Deno.env.get("PESAPAL_CONSUMER_SECRET"),
    }),
  });
  const data = await res.json();
  if (!data.token) throw new Error("PesaPal auth failed: " + JSON.stringify(data));
  return data.token;
}

async function registerIPN(token: string, callbackUrl: string): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE}/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      url: callbackUrl,
      ipn_notification_type: "GET",
    }),
  });
  const data = await res.json();
  return data.ipn_id;
}

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

    const { amount, phone_number, callback_url } = await req.json();
    if (!amount || amount < 10) {
      return new Response(JSON.stringify({ error: "Minimum deposit is KES 10" }), { status: 400, headers: corsHeaders });
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get wallet
    const { data: wallet } = await db.from("wallets").select("id").eq("user_id", user.id).single();
    if (!wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), { status: 400, headers: corsHeaders });
    }

    // Get PesaPal token
    const token = await getPesaPalToken();

    // Register IPN callback
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const ipnUrl = `${supabaseUrl}/functions/v1/pesapal-callback`;
    const ipnId = await registerIPN(token, ipnUrl);

    // Create pending transaction
    const orderRef = `PAG-${Date.now()}-${user.id.slice(0, 8)}`;
    const { data: tx, error: txError } = await db.from("transactions").insert({
      user_id: user.id,
      wallet_id: wallet.id,
      type: "deposit",
      amount,
      status: "pending",
      phone_number: phone_number || null,
      reference: orderRef,
      description: `PesaPal deposit of KES ${amount}`,
    }).select("id").single();

    if (txError) throw txError;

    // Submit order to PesaPal
    const orderRes = await fetch(`${PESAPAL_BASE}/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: orderRef,
        currency: "KES",
        amount,
        description: `Pagaza Betz Deposit - ${amount} KES`,
        callback_url: callback_url || `${supabaseUrl.replace('supabase.co', 'supabase.co').replace(/\/+$/, '')}/functions/v1/pesapal-callback?source=redirect`,
        notification_id: ipnId,
        billing_address: {
          email_address: user.email || "",
          phone_number: phone_number || "",
        },
      }),
    });

    const orderData = await orderRes.json();

    if (!orderData.redirect_url) {
      // Update tx to failed
      await db.from("transactions").update({ status: "failed", description: `PesaPal error: ${JSON.stringify(orderData)}` }).eq("id", tx.id);
      throw new Error("PesaPal order submission failed: " + JSON.stringify(orderData));
    }

    // Store PesaPal order tracking ID
    await db.from("transactions").update({
      metadata: { pesapal_order_tracking_id: orderData.order_tracking_id, ipn_id: ipnId },
    }).eq("id", tx.id);

    return new Response(
      JSON.stringify({
        success: true,
        redirect_url: orderData.redirect_url,
        order_tracking_id: orderData.order_tracking_id,
        transaction_id: tx.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pesapal-deposit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
