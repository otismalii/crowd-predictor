import { supabase } from "@/integrations/supabase/client";
import { safeFetch } from "@/lib/api";

export async function fetchMarkets(options: {
  status?: string[];
  category?: string;
  limit?: number;
  offset?: number;
} = {}) {
  let query = supabase
    .from("markets")
    .select("*, matches(home_team, away_team, league, kickoff)")
    .order("created_at", { ascending: false });

  if (options.status?.length) {
    query = query.in("status", options.status as any);
  }
  if (options.category) {
    query = query.eq("category", options.category as any);
  }

  const offset = options.offset || 0;
  const limit = options.limit || 20;
  query = query.range(offset, offset + limit - 1);

  return safeFetch(query as any);
}

export async function fetchMarketOutcomes(marketIds: string[]) {
  return safeFetch(
    supabase
      .from("market_outcomes")
      .select("*")
      .in("market_id", marketIds)
      .order("sort_order") as any
  );
}

export async function fetchMarketById(id: string) {
  return safeFetch(
    supabase
      .from("markets")
      .select("*, matches(home_team, away_team, league, kickoff, home_score, away_score)")
      .eq("id", id)
      .single() as any
  );
}

export async function fetchPositions(userId: string, marketId?: string) {
  let query = supabase
    .from("positions")
    .select("outcome_id, market_id, shares, avg_price, total_cost")
    .eq("user_id", userId)
    .gt("shares", 0);

  if (marketId) {
    query = query.eq("market_id", marketId);
  }

  return safeFetch(query as any);
}
