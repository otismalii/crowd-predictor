import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchIntelligence, requestIntelligence, type MarketIntelligence } from "@/services/marketIntelligenceService";

const STALE_MS = 30 * 60 * 1000;

export function useMarketIntelligence(marketId: string | undefined) {
  const [data, setData] = useState<MarketIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const cached = await fetchIntelligence(marketId);
        if (!cancelled) setData(cached);
        const stale = !cached || (Date.now() - new Date(cached.generated_at).getTime() > STALE_MS);
        if (stale) {
          setRefreshing(true);
          try {
            const fresh = await requestIntelligence(marketId);
            if (!cancelled && fresh) setData(fresh);
          } catch (e: any) {
            if (!cancelled) setError(String(e?.message ?? e));
          } finally {
            if (!cancelled) setRefreshing(false);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`mkt-intel-${marketId}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_intelligence", filter: `market_id=eq.${marketId}` },
        (payload) => { if (payload.new) setData(payload.new as MarketIntelligence); })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [marketId]);

  const refresh = async (force = false) => {
    if (!marketId) return;
    setRefreshing(true);
    try {
      const fresh = await requestIntelligence(marketId, { force });
      if (fresh) setData(fresh);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setRefreshing(false);
    }
  };

  return { data, loading, refreshing, error, refresh };
}
