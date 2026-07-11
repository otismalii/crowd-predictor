// Inline risk evaluator. Called by execute-trade and pesapal-withdraw.
// Returns { action: 'allow'|'limit'|'hold'|'block', reason, max_amount? }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, serviceClient, ok, err } from "../_shared/envelope.ts";

interface RiskCtx {
  user_id: string;
  action: "trade" | "deposit" | "withdraw";
  amount: number;
}

const ROLE_CAPS = {
  user: 1000,             // unverified
  verified_user: 10000,
  risk_flagged: 100,
  admin: 50000,
  super_admin: 50000,
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await req.json() as RiskCtx;
    if (!ctx.user_id || !ctx.action || ctx.amount === undefined) return err("Invalid input");

    const db = serviceClient();

    // 1. Determine highest tier
    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", ctx.user_id);
    const roleSet = new Set((roles || []).map(r => r.role));
    let cap: number = ROLE_CAPS.user;
    if (roleSet.has("super_admin")) cap = ROLE_CAPS.super_admin;
    else if (roleSet.has("admin")) cap = ROLE_CAPS.admin;
    else if (roleSet.has("risk_flagged")) cap = ROLE_CAPS.risk_flagged;
    else if (roleSet.has("verified_user")) cap = ROLE_CAPS.verified_user;

    // 2. Per-trade cap check
    if (ctx.amount > cap) {
      await db.from("risk_signals").insert({
        user_id: ctx.user_id, signal_type: "trade_velocity", severity: "medium",
        metric_value: ctx.amount, threshold: cap, action_taken: "limit",
        details: { reason: "exceeds_role_cap", role_set: [...roleSet] },
      });
      return ok({ action: "limit", reason: `Maximum ${cap} KES per ${ctx.action}. Verify your account to increase your limit.`, max_amount: cap });
    }

    // 3. Velocity: trades in last hour
    if (ctx.action === "trade") {
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await db.from("trades").select("id", { count: "exact", head: true })
        .eq("user_id", ctx.user_id).gte("created_at", oneHourAgo);
      if ((count || 0) > 30) {
        await db.from("risk_signals").insert({
          user_id: ctx.user_id, signal_type: "trade_velocity", severity: "high",
          metric_value: count, threshold: 30, action_taken: "hold",
        });
        return ok({ action: "hold", reason: "Trade velocity too high. Try again in 5 minutes." });
      }
    }

    // 4. Withdrawal velocity (DB function lock_for_withdrawal already enforces 50k/day)
    if (ctx.action === "withdraw") {
      const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
      const { count } = await db.from("transactions").select("id", { count: "exact", head: true })
        .eq("user_id", ctx.user_id).eq("type", "withdrawal").gte("created_at", oneDayAgo);
      if ((count || 0) > 5) {
        return ok({ action: "hold", reason: "Withdrawal limit reached for today (5 per day)." });
      }
    }

    return ok({ action: "allow" });
  } catch (e) {
    console.error("evaluate-risk error:", e);
    return err(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
