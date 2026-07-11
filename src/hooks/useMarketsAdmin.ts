import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AdminMarket = {
  id: string;
  title: string;
  slug: string | null;
  category: string;
  status: string;
  total_volume: number;
  closes_at: string | null;
  resolved_at: string | null;
  created_at: string;
  created_by: string | null;
  image_url: string | null;
};

const STATUS_TABS = {
  draft: ["draft", "review"],
  scheduled: ["published"],
  live: ["open", "active"],
  closed: ["closed", "frozen"],
  resolved: ["resolved", "settled", "cancelled", "archived"],
} as const;

export type LifecycleTab = keyof typeof STATUS_TABS;

export function useMarketsAdmin(tab: LifecycleTab) {
  const [markets, setMarkets] = useState<AdminMarket[]>([]);
  const [counts, setCounts] = useState<Record<LifecycleTab, number>>({
    draft: 0, scheduled: 0, live: 0, closed: 0, resolved: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    const statuses = STATUS_TABS[tab] as unknown as string[];
    const { data, error } = await supabase
      .from("markets")
      .select("id,title,slug,category,status,total_volume,closes_at,resolved_at,created_at,created_by,image_url")
      .in("status", statuses as any)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setMarkets((data as any) ?? []);
    setLoading(false);
  }, [tab]);

  const fetchCounts = useCallback(async () => {
    const results = await Promise.all(
      (Object.keys(STATUS_TABS) as LifecycleTab[]).map(async (t) => {
        const { count } = await supabase
          .from("markets")
          .select("id", { count: "exact", head: true })
          .in("status", STATUS_TABS[t] as any);
        return [t, count ?? 0] as const;
      })
    );
    setCounts(Object.fromEntries(results) as Record<LifecycleTab, number>);
  }, []);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  return { markets, counts, loading, refresh: () => { fetchMarkets(); fetchCounts(); } };
}

export async function callAdminAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-market-actions", { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}
