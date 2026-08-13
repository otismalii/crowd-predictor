// place-bet — places a single or accumulator bet slip for the authenticated user.
// All validation, odds locking and ledger movement happens inside fn_place_bet_slip.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Selection = {
  match_id: string;
  market: string;
  selection: string;
  line?: number | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Missing auth" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const stake = Number(body.stake);
  const slipType = body.slip_type === "acca" ? "acca" : "single";
  const raw = Array.isArray(body.selections) ? body.selections : [];
  const idempotencyKey = typeof body.idempotency_key === "string" && body.idempotency_key.length > 8
    ? body.idempotency_key
    : crypto.randomUUID();

  if (!Number.isFinite(stake) || stake <= 0) return json({ error: "Stake must be a positive number" }, 400);
  if (raw.length === 0) return json({ error: "At least one selection is required" }, 400);
  if (raw.length > 15) return json({ error: "Too many selections" }, 400);

  const selections: Selection[] = [];
  for (const s of raw) {
    if (!s || typeof s.match_id !== "string" || typeof s.market !== "string" || typeof s.selection !== "string") {
      return json({ error: "Each selection needs match_id, market and selection" }, 400);
    }
    const line = s.line === null || s.line === undefined || s.line === "" ? null : Number(s.line);
    if (line !== null && !Number.isFinite(line)) return json({ error: "Invalid line" }, 400);
    selections.push({ match_id: s.match_id, market: s.market, selection: s.selection, line });
  }

  // Phone verification is required before any money moves.
  const { data: profile } = await admin
    .from("profiles").select("phone_verified, phone_number").eq("id", user.id).maybeSingle();
  if (!profile?.phone_verified) {
    return json({ error: "PHONE_NOT_VERIFIED", message: "Verify your Kenyan phone number before betting." }, 403);
  }

  const { data, error } = await admin.rpc("fn_place_bet_slip", {
    p_user_id: user.id,
    p_selections: selections,
    p_stake: stake,
    p_slip_type: slipType,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    const code = error.message?.replace(/^.*?:\s*/, "") ?? "BET_FAILED";
    const status = code.includes("INSUFFICIENT") || code.includes("STAKE") || code.includes("CLOSED") ? 400 : 500;
    console.error("[place-bet] failed", error.message);
    return json({ error: code, message: humanise(code) }, status);
  }

  return json({ ok: true, ...(data as Record<string, unknown>) });
});

function humanise(code: string): string {
  const map: Record<string, string> = {
    NO_SELECTIONS: "Your bet slip is empty.",
    TOO_MANY_SELECTIONS: "That is more selections than an accumulator allows.",
    SINGLE_REQUIRES_ONE_SELECTION: "A single bet takes exactly one selection.",
    STAKE_BELOW_MINIMUM: "Your stake is below the minimum.",
    STAKE_ABOVE_MAXIMUM: "Your stake is above the maximum.",
    PAYOUT_ABOVE_MAXIMUM: "That slip would exceed the maximum payout — lower your stake.",
    MATCH_NOT_FOUND: "One of those matches no longer exists.",
    BETTING_CLOSED: "Betting has closed on one of those matches.",
    DUPLICATE_MATCH_ON_SLIP: "An accumulator cannot hold two selections from the same match.",
    ODDS_NOT_FOUND: "Those odds are no longer available.",
    MARKET_SUSPENDED: "That market is suspended.",
    INSUFFICIENT_BALANCE: "Your wallet balance is too low for this stake.",
  };
  return map[code] ?? "We could not place that bet. Please try again.";
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
