// Pesapal v3 helpers shared by deposit / callback / status functions.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const PESAPAL_BASE = "https://pay.pesapal.com/v3/api";

export async function getPesaPalToken(): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE}/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: Deno.env.get("PESAPAL_CONSUMER_KEY"),
      consumer_secret: Deno.env.get("PESAPAL_CONSUMER_SECRET"),
    }),
  });
  const data = await res.json();
  if (!data?.token) throw new Error("PESAPAL_AUTH_FAILED: " + JSON.stringify(data).slice(0, 300));
  return data.token as string;
}

/** Registers the IPN url once and caches the id in app_settings. */
export async function getIpnId(db: SupabaseClient, token: string, ipnUrl: string): Promise<string> {
  const { data: setting } = await db.from("app_settings").select("value").eq("key", "pesapal_ipn_id").maybeSingle();
  const cached = setting?.value as unknown;
  if (typeof cached === "string" && cached.length > 0) return cached;

  const res = await fetch(`${PESAPAL_BASE}/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "GET" }),
  });
  const data = await res.json();
  if (!data?.ipn_id) throw new Error("PESAPAL_IPN_REGISTRATION_FAILED: " + JSON.stringify(data).slice(0, 300));

  await db.from("app_settings").upsert({
    key: "pesapal_ipn_id",
    value: data.ipn_id,
    description: "Cached Pesapal IPN registration id",
    category: "finance",
  });
  return data.ipn_id as string;
}

export type PesapalStatus = {
  raw: any;
  state: "completed" | "failed" | "pending";
  receipt: string | null;
  merchantReference: string | null;
  amount: number | null;
};

/** Authoritative status straight from Pesapal — never trust the notification body. */
export async function getTransactionStatus(token: string, orderTrackingId: string): Promise<PesapalStatus> {
  const res = await fetch(
    `${PESAPAL_BASE}/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
  );
  const raw = await res.json();
  const desc = String(raw?.payment_status_description ?? "").toLowerCase();
  const code = Number(raw?.status_code ?? -1);

  let state: PesapalStatus["state"] = "pending";
  if (desc === "completed" || code === 1) state = "completed";
  else if (desc === "failed" || desc === "invalid" || desc === "reversed" || code === 2 || code === 3) state = "failed";

  return {
    raw,
    state,
    receipt: raw?.confirmation_code ?? null,
    merchantReference: raw?.merchant_reference ?? null,
    amount: raw?.amount != null ? Number(raw.amount) : null,
  };
}

export async function logPaymentFailure(
  db: SupabaseClient,
  args: { operation: string; reference?: string | null; userId?: string | null; amount?: number | null; error: string; payload?: unknown },
) {
  await db.from("payment_failures").insert({
    provider: "pesapal",
    operation: args.operation,
    reference: args.reference ?? null,
    user_id: args.userId ?? null,
    amount: args.amount ?? null,
    error_message: args.error.slice(0, 1000),
    payload: (args.payload ?? {}) as any,
    status: "pending",
  });
}
