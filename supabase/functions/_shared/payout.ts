// M-Pesa payout execution via IntaSend send-money (B2C).
const INTASEND_BASE = "https://payment.intasend.com/api/v1";

export type PayoutResult =
  | { ok: true; reference: string; raw: any }
  | { ok: false; error: string; raw?: any };

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.length === 9) return "254" + digits;
  return digits;
}

/**
 * Sends money to an M-Pesa number. Two-step: initiate, then approve.
 * Returns the provider tracking id as the payout reference.
 */
export async function sendMpesaPayout(args: {
  phone: string;
  amount: number;
  name?: string;
  narrative?: string;
}): Promise<PayoutResult> {
  const token = Deno.env.get("INTASEND_API_TOKEN");
  if (!token) return { ok: false, error: "PAYOUT_PROVIDER_NOT_CONFIGURED" };

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    const initRes = await fetch(`${INTASEND_BASE}/send-money/initiate/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        provider: "MPESA-B2C",
        currency: "KES",
        requires_approval: "NO",
        transactions: [
          {
            name: args.name ?? "Betwise player",
            account: normalisePhone(args.phone),
            amount: Math.round(args.amount),
            narrative: args.narrative ?? "Betwise withdrawal",
          },
        ],
      }),
    });
    const init = await initRes.json().catch(() => ({}));
    if (!initRes.ok || !init?.tracking_id) {
      return { ok: false, error: `PAYOUT_INITIATE_FAILED: ${JSON.stringify(init).slice(0, 400)}`, raw: init };
    }

    const trackingId = init.tracking_id as string;

    // requires_approval NO still needs the approve call on some accounts; ignore a
    // "already approved" style rejection.
    const approveRes = await fetch(`${INTASEND_BASE}/send-money/approve/`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tracking_id: trackingId }),
    });
    const approve = await approveRes.json().catch(() => ({}));

    const status = String(approve?.status ?? init?.status ?? "").toUpperCase();
    if (approveRes.ok || status.includes("PROCESS") || status.includes("COMPLETE") || status.includes("APPROV")) {
      return { ok: true, reference: trackingId, raw: { init, approve } };
    }
    return { ok: false, error: `PAYOUT_APPROVE_FAILED: ${JSON.stringify(approve).slice(0, 400)}`, raw: { init, approve } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "PAYOUT_UNKNOWN_ERROR" };
  }
}
