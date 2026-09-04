// Pop It (crash) round engine.
// The server owns the round lifecycle, the crash point and every money move.
// Clients only read state and ask to place/cash out — they can never set a price.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BETTING_MS = 8000;
const GROWTH = 0.06; // multiplier = e^(0.06 * seconds)
const HOUSE_EDGE = 0.04;

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Provably fair: crash point is derived from the hashed seed committed before betting. */
async function newRoundSeed() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const seed = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hash = await sha256(seed);
  const u = parseInt(hash.slice(0, 13), 16) / 2 ** 52; // uniform in [0,1)
  const raw = (1 - HOUSE_EDGE) / Math.max(1e-9, 1 - u);
  const crashPoint = Math.min(1000, Math.max(1, Math.floor(raw * 100) / 100));
  return { seed, hash, crashPoint };
}

const multiplierAt = (startedAt: string) =>
  Math.max(1, Math.exp(GROWTH * Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 1000)));

/** Advances whatever round exists and guarantees exactly one live round. */
async function tickEngine() {
  const { data: rounds } = await admin
    .from("crash_rounds")
    .select("*")
    .in("status", ["betting", "running", "crashed"])
    .order("round_no", { ascending: true });

  for (const round of rounds ?? []) {
    if (round.status === "betting" && new Date(round.betting_ends_at).getTime() <= Date.now()) {
      await admin
        .from("crash_rounds")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", round.id)
        .eq("status", "betting");
      continue;
    }

    if (round.status === "running") {
      const crashPoint = Number(round.crash_point);
      const grownFor = (Math.log(crashPoint) / GROWTH) * 1000;
      const crashesAt = new Date(round.started_at!).getTime() + grownFor;
      if (Date.now() >= crashesAt) {
        await admin
          .from("crash_rounds")
          .update({ status: "crashed", crashed_at: new Date(crashesAt).toISOString() })
          .eq("id", round.id)
          .eq("status", "running");
        await admin.rpc("fn_crash_settle_round", { p_round_id: round.id });
      }
      continue;
    }

    if (round.status === "crashed") {
      await admin.rpc("fn_crash_settle_round", { p_round_id: round.id });
    }
  }

  const { data: live } = await admin
    .from("crash_rounds")
    .select("*")
    .in("status", ["betting", "running", "crashed"])
    .order("round_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (live) return live;

  const { seed, hash, crashPoint } = await newRoundSeed();
  const { data: created, error } = await admin
    .from("crash_rounds")
    .insert({
      game_key: "popit",
      status: "betting",
      server_seed: seed,
      seed_hash: hash,
      crash_point: crashPoint,
      betting_ends_at: new Date(Date.now() + BETTING_MS).toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return created;
}

/** Public shape — never leaks the seed or crash point of an unfinished round. */
function publicRound(round: any) {
  const finished = round.status === "crashed" || round.status === "settled";
  return {
    id: round.id,
    round_no: round.round_no,
    status: round.status,
    seed_hash: round.seed_hash,
    betting_ends_at: round.betting_ends_at,
    started_at: round.started_at,
    crashed_at: round.crashed_at,
    total_staked: Number(round.total_staked ?? 0),
    crash_point: finished ? Number(round.crash_point) : null,
    server_seed: finished ? round.server_seed : null,
    multiplier:
      round.status === "running" && round.started_at
        ? Math.min(Number(multiplierAt(round.started_at).toFixed(2)), Number(round.crash_point))
        : finished
          ? Number(round.crash_point)
          : 1,
  };
}

async function userFromRequest(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const { data } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  return data.user ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "state");

    const round = await tickEngine();

    if (action === "state") {
      const [{ data: feed }, { data: history }] = await Promise.all([
        admin.rpc("fn_crash_round_feed", { p_round_id: round.id }),
        admin
          .from("crash_rounds")
          .select("round_no, crash_point")
          .eq("status", "settled")
          .order("round_no", { ascending: false })
          .limit(24),
      ]);

      let myBet = null;
      const user = await userFromRequest(req);
      if (user) {
        const { data } = await admin
          .from("crash_bets")
          .select("*")
          .eq("round_id", round.id)
          .eq("user_id", user.id)
          .maybeSingle();
        myBet = data;
      }

      return json({
        round: publicRound(round),
        feed: feed ?? [],
        history: (history ?? []).map((h: any) => Number(h.crash_point)).reverse(),
        my_bet: myBet,
        server_time: new Date().toISOString(),
      });
    }

    const user = await userFromRequest(req);
    if (!user) return json({ error: "Sign in to play" }, 401);

    if (action === "place_bet") {
      const stake = Number(body.stake);
      const autoCashout = body.auto_cashout == null ? null : Number(body.auto_cashout);
      if (!Number.isFinite(stake) || stake <= 0) return json({ error: "Enter a valid stake" }, 400);
      if (autoCashout != null && (!Number.isFinite(autoCashout) || autoCashout < 1.01)) {
        return json({ error: "Auto cash-out must be at least 1.01x" }, 400);
      }
      if (round.status !== "betting") return json({ error: "Betting is closed for this round" }, 400);

      const { data, error } = await admin.rpc("fn_crash_place_bet", {
        p_user_id: user.id,
        p_round_id: round.id,
        p_stake: stake,
        p_auto_cashout: autoCashout,
        p_idempotency_key: `popit_stake_${round.id}_${user.id}`,
      });
      if (error) return json({ error: friendly(error.message) }, 400);
      return json({ success: true, bet: data, round: publicRound(round) });
    }

    if (action === "cashout") {
      const betId = String(body.bet_id ?? "");
      if (!betId) return json({ error: "Missing bet" }, 400);
      if (round.status !== "running") return json({ error: "Round is not running" }, 400);

      const requested = round.started_at ? multiplierAt(round.started_at) : 1;
      const { data, error } = await admin.rpc("fn_crash_cashout", {
        p_user_id: user.id,
        p_bet_id: betId,
        p_multiplier: Number(requested.toFixed(2)),
        p_idempotency_key: `popit_cashout_${betId}`,
      });
      if (error) return json({ error: friendly(error.message) }, 400);
      return json({ success: true, ...(data as Record<string, unknown>) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[crash-game]", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

function friendly(code: string) {
  const map: Record<string, string> = {
    GAME_DISABLED: "Pop It is currently unavailable",
    STAKE_BELOW_MINIMUM: "Stake is below the minimum",
    STAKE_ABOVE_MAXIMUM: "Stake is above the maximum",
    BETTING_CLOSED: "Betting is closed for this round",
    ALREADY_BET_THIS_ROUND: "You already have a bet in this round",
    ROUND_NOT_RUNNING: "Round is not running",
    BET_NOT_FOUND: "Bet not found",
    BET_ALREADY_SETTLED: "That bet is already settled",
    ALREADY_CRASHED: "Too late — it popped",
    INSUFFICIENT_FUNDS: "Not enough balance",
  };
  for (const key of Object.keys(map)) if (code.includes(key)) return map[key];
  return code.replace(/^.*?:\s*/, "");
}
