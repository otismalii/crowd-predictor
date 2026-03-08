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
    const INTASEND_PUBLISHABLE = Deno.env.get("INTASEND_PUBLISHABLE_KEY");
    if (!INTASEND_TOKEN) {
      return new Response(JSON.stringify({ error: "IntaSend not configured" }), { status: 500, headers: corsHeaders });
    }

    // Use service role for DB operations
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get user wallet
    const { data: wallet } = await adminSupabase
      .from("wallets").select("id").eq("user_id", userId).single();

    if (!wallet) {
      return new Response(JSON.stringify({ error: "Wallet not found" }), { status: 404, headers: corsHeaders });
    }

    // Create pending transaction
    const { data: tx } = await adminSupabase.from("transactions").insert({
      user_id: userId,
      wallet_id: wallet.id,
      type: "deposit",
      amount,
      status: "pending",
      phone_number,
      description: `M-Pesa deposit of KES ${amount}`,
    }).select("id").single();

    // Initiate IntaSend STK Push
    const stkRes = await fetch(`${INTASEND_BASE}/payment/mpesa-stk-push/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${INTASEND_TOKEN}`,
      },
      body: JSON.stringify({
        amount,
        phone_number,
        api_ref: tx?.id || "deposit",
        narrative: "PagazaBetz Wallet Deposit",
      }),
    });

    const stkData = await stkRes.json();

    if (!stkRes.ok) {
      // Mark transaction as failed
      if (tx?.id) {
        await adminSupabase.from("transactions").update({ status: "failed" }).eq("id", tx.id);
      }
      console.error("IntaSend STK error:", JSON.stringify(stkData));
      return new Response(
        JSON.stringify({ error: "STK Push failed", details: stkData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store IntaSend invoice ID for callback matching
    if (tx?.id && stkData.invoice?.invoice_id) {
      await adminSupabase.from("transactions")
        .update({ reference: stkData.invoice.invoice_id })
        .eq("id", tx.id);
    }

    return new Response(
      JSON.stringify({ success: true, transaction_id: tx?.id, invoice: stkData.invoice }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("mpesa-deposit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
