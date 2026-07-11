import { supabase } from "@/integrations/supabase/client";
import { safeFetch } from "@/lib/api";

export async function fetchWatchlist(userId: string) {
  return safeFetch(
    supabase
      .from("watchlist")
      .select("id, alert_price, created_at, market_id, markets(id, title, slug, status, category, image_url, total_volume)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }) as any
  );
}

export async function addToWatchlist(userId: string, marketId: string, alertPrice?: number) {
  return safeFetch(
    supabase
      .from("watchlist")
      .insert({ user_id: userId, market_id: marketId, alert_price: alertPrice ?? null })
      .select()
      .single() as any
  );
}

export async function removeFromWatchlist(userId: string, marketId: string) {
  return safeFetch(
    supabase.from("watchlist").delete().eq("user_id", userId).eq("market_id", marketId) as any
  );
}

export async function isOnWatchlist(userId: string, marketId: string): Promise<boolean> {
  const { data } = await supabase
    .from("watchlist")
    .select("id")
    .eq("user_id", userId)
    .eq("market_id", marketId)
    .maybeSingle();
  return !!data;
}
