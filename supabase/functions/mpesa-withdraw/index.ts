import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INTASEND_BASE = "https://payment.intasend.com/api/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const { amount, phone_number } = await req.json();
    if (!amount || !phone_number || amount < 10) {
      return new Response(JSON.stringify({ error: "Invalid amount or phone" }), { status: 400, headers: corsHeaders });
    }

    const INTASEND_TOKEN = Deno.env.get("INTASEND_API_TOKEN");
    if (!INTASEND_TOKEN) {
      return new Response(JSON.stringify({ error: "IntaSend not configured" }), { status: 500, headers: corsHeaders });
    }

    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get wallet and check balance
    const { data: wallet } = await adminSupabase
      .from("wallets").select("id, balance").eq("user_id", userId).single();

    if (!wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), { status: 404, headers: corsHeaders });
    }

    if (wallet.balance < amount) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), { status: 400, headers: corsHeaders });
    }

    // Deduct balance first
    await adminSupabase.from("wallets")
      .update({ balance: wallet.balance - amount, updated_at: new Date().toISOString() })
      .eq("id", wallet.id);

    // Create transaction
    const { data: tx } = await adminSupabase.from("transactions").insert({
      user_id: userId,
      wallet_id: wallet.id,
      type: "withdrawal",
      amount,
      status: "pending",
      phone_number,
      description: `M-Pesa withdrawal of KES ${amount}`,
    }).select("id").single();

    // Initiate IntaSend B2C (Send Money)
    const b2cRes = await fetch(`${INTASEND_BASE}/send-money/initiate/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${INTASEND_TOKEN}`,
      },
      body: JSON.stringify({
        currency: "KES",
        transactions: [{
          account: phone_number,
          amount: String(amount),
          narrative: "PagazaBetz Withdrawal",
        }],
      }),
    });

    const b2cData = await b2cRes.json();

    if (!b2cRes.ok) {
      // Refund balance
      await adminSupabase.from("wallets")
        .update({ balance: wallet.balance, updated_at: new Date().toISOString() })
        .eq("id", wallet.id);
      if (tx?.id) {
        await adminSupabase.from("transactions").update({ status: "failed" }).eq("id", tx.id);
      }
      console.error("IntaSend B2C error:", JSON.stringify(b2cData));
      return new Response(
        JSON.stringify({ error: "Withdrawal failed", details: b2cData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark completed
    if (tx?.id) {
      await adminSupabase.from("transactions")
        .update({ status: "completed", reference: b2cData.tracking_id || null })
        .eq("id", tx.id);
    }

    // Notify user
    await adminSupabase.from("notifications").insert({
      user_id: userId,
      type: "withdrawal",
      title: "💸 Withdrawal Sent",
      message: `KES ${amount} sent to ${phone_number} via M-Pesa`,
      link: "/wallet",
    });

    return new Response(
      JSON.stringify({ success: true, transaction_id: tx?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("mpesa-withdraw error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
