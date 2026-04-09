import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_SHARES_PER_TRADE = 10000;
const IDEMPOTENCY_WINDOW_MS = 5000;

function stableExps(pools: number[], b: number): { exps: number[]; maxQ: number } {
  const maxQ = Math.max(...pools);
  const exps = pools.map(q => Math.exp((q - maxQ) / b));
  return { exps, maxQ };
}

function lmsrCost(pools: number[], b: number): number {
  const { exps, maxQ } = stableExps(pools, b);
  const sum = exps.reduce((s, e) => s + e, 0);
  return b * Math.log(sum) + maxQ;
}

function lmsrPrice(pools: number[], outcomeIndex: number, b: number): number {
  const { exps } = stableExps(pools, b);
  const total = exps.reduce((s, e) => s + e, 0);
  const price = exps[outcomeIndex] / total;
  return Math.max(0, Math.min(1, price));
}

function lmsrBuyCost(pools: number[], outcomeIndex: number, shares: number, b: number): number {
  const costBefore = lmsrCost(pools, b);
  const newPools = [...pools];
  newPools[outcomeIndex] += shares;
  const costAfter = lmsrCost(newPools, b);
  const cost = costAfter - costBefore;
  if (!isFinite(cost) || isNaN(cost)) throw new Error("LMSR calculation overflow");
  return cost;
}

function lmsrSellReturn(pools: number[], outcomeIndex: number, shares: number, b: number): number {
  const costBefore = lmsrCost(pools, b);
  const newPools = [...pools];
  newPools[outcomeIndex] -= shares;
  const costAfter = lmsrCost(newPools, b);
  const ret = costBefore - costAfter;
  if (!isFinite(ret) || isNaN(ret)) throw new Error("LMSR calculation overflow");
  return ret;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    const { market_id, outcome_id, side, shares } = await req.json();
    if (!market_id || !outcome_id || !side || !shares || shares <= 0) {
      return new Response(JSON.stringify({ error: "Invalid parameters" }), { status: 400, headers: corsHeaders });
    }
    if (shares > MAX_SHARES_PER_TRADE) {
      return new Response(JSON.stringify({ error: `Max ${MAX_SHARES_PER_TRADE} shares per trade` }), { status: 400, headers: corsHeaders });
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Phone number gate — require phone before trading
    const { data: profile } = await db.from("profiles").select("phone_number").eq("id", userId).single();
    if (!profile?.phone_number) {
      return new Response(JSON.stringify({ error: "Add your phone number in profile settings before trading" }), { status: 400, headers: corsHeaders });
    }

    // Idempotency guard — reject duplicate trades within 5 seconds
    const cutoff = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS).toISOString();
    const { data: recentTrades } = await db.from("trades")
      .select("id")
      .eq("user_id", userId)
      .eq("market_id", market_id)
      .eq("outcome_id", outcome_id)
      .eq("side", side)
      .gte("created_at", cutoff)
      .limit(1);

    if (recentTrades && recentTrades.length > 0) {
      return new Response(JSON.stringify({ error: "Duplicate trade detected. Please wait a moment." }), { status: 429, headers: corsHeaders });
    }

    const { data: market } = await db.from("markets").select("*").eq("id", market_id).single();
    if (!market || market.status !== "open") {
      return new Response(JSON.stringify({ error: "Market not open" }), { status: 400, headers: corsHeaders });
    }

    // closes_at validation
    if (market.closes_at && new Date(market.closes_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Market has closed for trading" }), { status: 400, headers: corsHeaders });
    }

    const { data: outcomes } = await db.from("market_outcomes")
      .select("*").eq("market_id", market_id).order("sort_order");
    if (!outcomes || outcomes.length < 2) {
      return new Response(JSON.stringify({ error: "Invalid market" }), { status: 400, headers: corsHeaders });
    }

    const outcomeIndex = outcomes.findIndex((o: any) => o.id === outcome_id);
    if (outcomeIndex === -1) {
      return new Response(JSON.stringify({ error: "Outcome not found" }), { status: 400, headers: corsHeaders });
    }

    const pools = outcomes.map((o: any) => Number(o.pool_shares));
    const b = Number(market.liquidity_param);
    if (b <= 0 || !isFinite(b)) {
      return new Response(JSON.stringify({ error: "Invalid liquidity parameter" }), { status: 400, headers: corsHeaders });
    }

    let cost: number;
    let pricePerShare: number;

    if (side === "buy") {
      cost = lmsrBuyCost(pools, outcomeIndex, shares, b);
      pricePerShare = cost / shares;

      const { data: wallet } = await db.from("wallets").select("id, balance").eq("user_id", userId).single();
      if (!wallet || wallet.balance < cost) {
        return new Response(JSON.stringify({ error: "Insufficient balance", required: cost, balance: wallet?.balance || 0 }), { status: 400, headers: corsHeaders });
      }

      const newBalance = Number(wallet.balance) - cost;
      await db.from("wallets")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", wallet.id);

      pools[outcomeIndex] += shares;
      await db.from("market_outcomes")
        .update({ pool_shares: pools[outcomeIndex] })
        .eq("id", outcome_id);

      const { data: existingPos } = await db.from("positions")
        .select("*").eq("user_id", userId).eq("outcome_id", outcome_id).single();

      if (existingPos) {
        const newShares = Number(existingPos.shares) + shares;
        const newTotalCost = Number(existingPos.total_cost) + cost;
        await db.from("positions").update({
          shares: newShares,
          total_cost: newTotalCost,
          avg_price: newTotalCost / newShares,
          updated_at: new Date().toISOString(),
        }).eq("id", existingPos.id);
      } else {
        await db.from("positions").insert({
          user_id: userId, market_id, outcome_id,
          shares, avg_price: pricePerShare, total_cost: cost,
        });
      }

      const { data: trade } = await db.from("trades").insert({
        user_id: userId, market_id, outcome_id, side: "buy",
        shares, price_per_share: pricePerShare, total_cost: cost,
      }).select("id").single();

      await db.from("markets")
        .update({ total_volume: Number(market.total_volume) + cost })
        .eq("id", market_id);

      await db.from("transactions").insert({
        user_id: userId, wallet_id: wallet.id, type: "bet_stake",
        amount: cost, status: "completed",
        description: `Bought ${shares} shares of "${outcomes[outcomeIndex].label}"`,
      });

      // Ledger entry for buy
      await db.from("ledger_entries").insert({
        user_id: userId,
        wallet_id: wallet.id,
        entry_type: "trade_buy",
        amount: -cost,
        balance_after: newBalance,
        reference_id: trade?.id || null,
        description: `Buy ${shares} shares "${outcomes[outcomeIndex].label}" @ ${pricePerShare.toFixed(4)}`,
      });

    } else if (side === "sell") {
      const { data: pos } = await db.from("positions")
        .select("*").eq("user_id", userId).eq("outcome_id", outcome_id).single();

      if (!pos || Number(pos.shares) < shares) {
        return new Response(JSON.stringify({ error: "Insufficient shares" }), { status: 400, headers: corsHeaders });
      }

      const returnAmt = lmsrSellReturn(pools, outcomeIndex, shares, b);
      pricePerShare = returnAmt / shares;
      cost = -returnAmt;

      const { data: wallet } = await db.from("wallets").select("id, balance").eq("user_id", userId).single();
      let newBalance = 0;
      if (wallet) {
        newBalance = Number(wallet.balance) + returnAmt;
        await db.from("wallets")
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq("id", wallet.id);
      }

      pools[outcomeIndex] -= shares;
      await db.from("market_outcomes")
        .update({ pool_shares: pools[outcomeIndex] })
        .eq("id", outcome_id);

      const newShares = Number(pos.shares) - shares;
      if (newShares <= 0) {
        await db.from("positions").delete().eq("id", pos.id);
      } else {
        const newTotalCost = Number(pos.total_cost) - (Number(pos.avg_price) * shares);
        await db.from("positions").update({
          shares: newShares,
          total_cost: Math.max(0, newTotalCost),
          updated_at: new Date().toISOString(),
        }).eq("id", pos.id);
      }

      const { data: trade } = await db.from("trades").insert({
        user_id: userId, market_id, outcome_id, side: "sell",
        shares, price_per_share: pricePerShare, total_cost: returnAmt,
      }).select("id").single();

      if (wallet) {
        await db.from("transactions").insert({
          user_id: userId, wallet_id: wallet.id, type: "bet_win",
          amount: returnAmt, status: "completed",
          description: `Sold ${shares} shares of "${outcomes[outcomeIndex].label}"`,
        });

        // Ledger entry for sell
        await db.from("ledger_entries").insert({
          user_id: userId,
          wallet_id: wallet.id,
          entry_type: "trade_sell",
          amount: returnAmt,
          balance_after: newBalance,
          reference_id: trade?.id || null,
          description: `Sell ${shares} shares "${outcomes[outcomeIndex].label}" @ ${pricePerShare.toFixed(4)}`,
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid side" }), { status: 400, headers: corsHeaders });
    }

    const newPrices = outcomes.map((_: any, i: number) => ({
      outcome_id: outcomes[i].id,
      label: outcomes[i].label,
      price: Math.round(lmsrPrice(pools, i, b) * 100) / 100,
    }));

    return new Response(
      JSON.stringify({ success: true, cost: Math.abs(cost), price_per_share: pricePerShare, new_prices: newPrices }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("execute-trade error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});