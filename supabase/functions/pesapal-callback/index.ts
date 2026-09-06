// Pesapal IPN + return-redirect handler.
// Re-verifies with Pesapal, then credits through the ledger exactly once.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPesaPalToken, getTransactionStatus, logPaymentFailure } from "../_shared/pesapal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const url = new URL(req.url);
    let orderTrackingId = url.searchParams.get("OrderTrackingId");
    let merchantRef = url.searchParams.get("OrderMerchantReference");

    if (!orderTrackingId && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      orderTrackingId = body?.OrderTrackingId ?? body?.order_tracking_id ?? null;
      merchantRef = body?.OrderMerchantReference ?? body?.merchant_reference ?? merchantRef;
    }
    if (!orderTrackingId) return json({ error: "Missing OrderTrackingId" }, 400);

    const token = await getPesaPalToken();
    const status = await getTransactionStatus(token, orderTrackingId);

    const reference = merchantRef || status.merchantReference;
    let tx: any = null;
    if (reference) {
      const { data } = await db.from("transactions").select("*").eq("reference", reference).maybeSingle();
      tx = data;
    }
    if (!tx) {
      const { data } = await db.from("transactions").select("*").eq("pesapal_tracking_id", orderTrackingId).maybeSingle();
      tx = data;
    }
    if (!tx) {
      await logPaymentFailure(db, {
        operation: "ipn_orphan",
        reference,
        error: `No transaction for tracking id ${orderTrackingId}`,
        payload: status.raw,
      });
      return json({ status: "ok", message: "Transaction not found" });
    }

    if (tx.status === "completed") return json({ status: "ok", state: "completed", replayed: true });

    if (status.state === "completed") {
      if (status.amount != null && Math.abs(status.amount - Number(tx.amount)) > 0.5) {
        await logPaymentFailure(db, {
          operation: "ipn_amount_mismatch",
          reference: tx.reference,
          userId: tx.user_id,
          amount: Number(tx.amount),
          error: `Provider amount ${status.amount} != intent ${tx.amount}`,
          payload: status.raw,
        });
        return json({ status: "ok", state: "review" });
      }

      const { error: creditErr } = await db.rpc("fn_credit_deposit", {
        p_transaction_id: tx.id,
        p_provider_reference: orderTrackingId,
        p_receipt: status.receipt ?? orderTrackingId,
      });
      if (creditErr) {
        await logPaymentFailure(db, {
          operation: "ipn_credit",
          reference: tx.reference,
          userId: tx.user_id,
          amount: Number(tx.amount),
          error: creditErr.message,
          payload: status.raw,
        });
        return json({ error: creditErr.message }, 500);
      }

      await db.from("transactions").update({
        metadata: { ...(tx.metadata ?? {}), pesapal_status: status.raw },
        pesapal_tracking_id: orderTrackingId,
        updated_at: new Date().toISOString(),
      }).eq("id", tx.id);

      return json({ status: "ok", state: "completed" });
    }

    if (status.state === "failed") {
      await db.from("transactions").update({
        status: "failed",
        metadata: { ...(tx.metadata ?? {}), pesapal_status: status.raw },
        updated_at: new Date().toISOString(),
      }).eq("id", tx.id);
      await logPaymentFailure(db, {
        operation: "deposit_failed",
        reference: tx.reference,
        userId: tx.user_id,
        amount: Number(tx.amount),
        error: String(status.raw?.payment_status_description ?? "payment failed"),
        payload: status.raw,
      });
      return json({ status: "ok", state: "failed" });
    }

    return json({ status: "ok", state: "pending" });
  } catch (e) {
    console.error("pesapal-callback error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
