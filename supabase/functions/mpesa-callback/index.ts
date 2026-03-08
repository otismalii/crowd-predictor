import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// IntaSend sends webhook callbacks when payment status changes
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("IntaSend webhook:", JSON.stringify(body));

    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const invoiceId = body.invoice_id || body.invoice?.invoice_id;
    const state = body.state || body.invoice?.state;
    const mpesaRef = body.mpesa_reference || body.invoice?.mpesa_reference;

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "No invoice ID" }), { status: 400, headers: corsHeaders });
    }

    // Find transaction by reference (invoice_id)
    const { data: tx } = await adminSupabase
      .from("transactions")
      .select("id, user_id, wallet_id, amount, status")
      .eq("reference", invoiceId)
      .single();

    if (!tx) {
      console.log("No transaction found for invoice:", invoiceId);
      return new Response(JSON.stringify({ ok: true, message: "No matching transaction" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (tx.status === "completed") {
      return new Response(JSON.stringify({ ok: true, message: "Already completed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (state === "COMPLETE" || state === "PROCESSING") {
      // Credit wallet
      const { data: wallet } = await adminSupabase
        .from("wallets").select("id, balance").eq("id", tx.wallet_id).single();

      if (wallet) {
        await adminSupabase.from("wallets")
          .update({ balance: wallet.balance + tx.amount, updated_at: new Date().toISOString() })
          .eq("id", wallet.id);
      }

      await adminSupabase.from("transactions")
        .update({ status: "completed", mpesa_receipt: mpesaRef || null, updated_at: new Date().toISOString() })
        .eq("id", tx.id);

      // Notify
      await adminSupabase.from("notifications").insert({
        user_id: tx.user_id,
        type: "deposit_complete",
        title: "💰 Deposit Confirmed!",
        message: `KES ${tx.amount} has been added to your wallet`,
        link: "/wallet",
      });

      console.log(`Deposit ${tx.id} completed: KES ${tx.amount}`);
    } else if (state === "FAILED" || state === "CANCELLED") {
      await adminSupabase.from("transactions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", tx.id);

      console.log(`Deposit ${tx.id} failed`);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("mpesa-callback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
