import { supabase } from "@/integrations/supabase/client";
import { safeFetch } from "@/lib/api";

export interface MarketTrend {
  id: string;
  market_id: string;
  window: string; // "1h" | "24h" | "7d"
  volume_delta: number;
  trade_count: number;
  price_delta: number;
  unique_traders: number;
  computed_at: string;
  details: Record<string, unknown> | null;
}

/** Latest trend row per window for a market. */
export async function fetchTrendsForMarket(marketId: string) {
  return safeFetch(
    supabase
      .from("market_trends")
      .select("*")
      .eq("market_id", marketId)
      .order("computed_at", { ascending: false })
      .limit(10) as any
  );
}

/** Top movers (highest |price_delta|) in a window. */
export async function fetchTopMovers(window: "1h" | "24h" | "7d" = "24h", limit = 10) {
  return safeFetch(
    supabase
      .from("market_trends")
      .select("*, markets(id, title, slug, status, category, image_url)")
      .eq("window", window)
      .order("price_delta", { ascending: false })
      .limit(limit) as any
  );
}

/** Trending = highest volume_delta. */
export async function fetchTrending(window: "1h" | "24h" | "7d" = "24h", limit = 10) {
  return safeFetch(
    supabase
      .from("market_trends")
      .select("*, markets(id, title, slug, status, category, image_url)")
      .eq("window", window)
      .order("volume_delta", { ascending: false })
      .limit(limit) as any
  );
}
