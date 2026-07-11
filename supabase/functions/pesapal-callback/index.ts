import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (!data.token) throw new Error("PesaPal auth failed");
  return data.token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const orderTrackingId = url.searchParams.get("OrderTrackingId");
    const orderMerchantRef = url.searchParams.get("OrderMerchantReference");

    if (!orderTrackingId) {
      return new Response(JSON.stringify({ error: "Missing OrderTrackingId" }), { status: 400, headers: corsHeaders });
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get transaction status from PesaPal
    const token = await getPesaPalToken();
    const statusRes = await fetch(
      `${PESAPAL_BASE}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const statusData = await statusRes.json();
    console.log("PesaPal status response:", JSON.stringify(statusData));

    // Find our transaction by reference
    const merchantRef = orderMerchantRef || statusData.merchant_reference;
    const { data: tx } = await db.from("transactions")
      .select("*, wallets:wallet_id(id, balance, user_id)")
      .eq("reference", merchantRef)
      .single();

    if (!tx) {
      console.error("Transaction not found for ref:", merchantRef);
      return new Response(JSON.stringify({ status: "ok", message: "Transaction not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already processed
    if (tx.status === "completed") {
      return new Response(JSON.stringify({ status: "ok", message: "Already processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pesapalStatus = statusData.payment_status_description?.toLowerCase();

    if (pesapalStatus === "completed" || statusData.status_code === 1) {
      // Credit wallet
      const wallet = (tx as any).wallets;
      if (wallet) {
        await db.from("wallets").update({
          balance: Number(wallet.balance) + Number(tx.amount),
          updated_at: new Date().toISOString(),
        }).eq("id", wallet.id);
      }

      // Update transaction
      await db.from("transactions").update({
        status: "completed",
        mpesa_receipt: statusData.confirmation_code || orderTrackingId,
        metadata: { ...((tx.metadata as any) || {}), pesapal_status: statusData },
        updated_at: new Date().toISOString(),
      }).eq("id", tx.id);

      // Create ledger entry
      await db.from("ledger_entries").insert({
        user_id: tx.user_id,
        wallet_id: tx.wallet_id,
        entry_type: "deposit",
        amount: tx.amount,
        balance_after: Number(wallet?.balance || 0) + Number(tx.amount),
        reference_id: tx.id,
        description: `PesaPal deposit completed`,
      });

      // Create notification
      await db.from("notifications").insert({
        user_id: tx.user_id,
        type: "deposit",
        title: "Deposit Successful",
        message: `KES ${Number(tx.amount).toLocaleString()} has been added to your wallet`,
        link: "/wallet",
      });

    } else if (pesapalStatus === "failed" || pesapalStatus === "invalid") {
      await db.from("transactions").update({
        status: "failed",
        metadata: { ...((tx.metadata as any) || {}), pesapal_status: statusData },
        updated_at: new Date().toISOString(),
      }).eq("id", tx.id);
    }
    // For "pending" status, do nothing — wait for next callback

    return new Response(
      JSON.stringify({ status: "ok" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pesapal-callback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
