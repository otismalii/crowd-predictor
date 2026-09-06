// Two modes:
//  - Player polling: { transaction_id } with a user bearer token → current state of their own intent.
//  - Reconciliation job (service role, no transaction_id): re-checks deposits pending > 10 min.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPesaPalToken, getTransactionStatus, logPaymentFailure } from "../_shared/pesapal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH = 20;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function resolveOne(db: any, tx: any, token: string) {
  const trackingId = tx.pesapal_tracking_id ?? (tx.metadata as any)?.order_tracking_id;
  if (!trackingId) return "no_tracking_id";

  const status = await getTransactionStatus(token, trackingId);

  if (status.state === "completed") {
    if (status.amount != null && Math.abs(status.amount - Number(tx.amount)) > 0.5) {
      await logPaymentFailure(db, {
        operation: "status_amount_mismatch",
        reference: tx.reference,
        userId: tx.user_id,
        amount: Number(tx.amount),
        error: `Provider amount ${status.amount} != intent ${tx.amount}`,
        payload: status.raw,
      });
      return "review";
    }
    const { error } = await db.rpc("fn_credit_deposit", {
      p_transaction_id: tx.id,
      p_provider_reference: trackingId,
      p_receipt: status.receipt ?? trackingId,
    });
    if (error) {
      await logPaymentFailure(db, {
        operation: "status_credit",
        reference: tx.reference,
        userId: tx.user_id,
        amount: Number(tx.amount),
        error: error.message,
        payload: status.raw,
      });
      return "credit_failed";
    }
    return "completed";
  }

  if (status.state === "failed") {
    await db.from("transactions").update({
      status: "failed",
      metadata: { ...(tx.metadata ?? {}), pesapal_status: status.raw },
      updated_at: new Date().toISOString(),
    }).eq("id", tx.id);
    return "failed";
  }
  return "pending";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const transactionId: string | undefined = body?.transaction_id;

    if (transactionId) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);

      const { data: tx } = await db.from("transactions").select("*").eq("id", transactionId).maybeSingle();
      if (!tx || tx.user_id !== user.id) return json({ error: "Not found" }, 404);
      if (tx.status !== "pending") return json({ state: tx.status, amount: Number(tx.amount), receipt: tx.mpesa_receipt });

      const token = await getPesaPalToken();
      const outcome = await resolveOne(db, tx, token);
      const { data: fresh } = await db.from("transactions").select("status, amount, mpesa_receipt").eq("id", tx.id).maybeSingle();
      return json({ state: fresh?.status ?? "pending", outcome, amount: Number(fresh?.amount ?? tx.amount), receipt: fresh?.mpesa_receipt ?? null });
    }

    // Reconciliation run (bounded batch)
    const { data: stuck } = await db
      .from("transactions")
      .select("*")
      .eq("type", "deposit")
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH);

    if (!stuck?.length) return json({ checked: 0, results: {} });

    const token = await getPesaPalToken();
    const results: Record<string, number> = {};
    for (const tx of stuck) {
      const outcome = await resolveOne(db, tx, token);
      results[outcome] = (results[outcome] ?? 0) + 1;
    }
    return json({ checked: stuck.length, results });
  } catch (e) {
    console.error("pesapal-status error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
