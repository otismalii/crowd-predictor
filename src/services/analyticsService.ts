import { supabase } from "@/integrations/supabase/client";
import { safeFetch } from "@/lib/api";

export interface PlatformAnalytics {
  totalUsers: number;
  totalMarkets: number;
  openMarkets: number;
  resolvedMarkets: number;
  totalVolume: number;
  totalTrades: number;
  totalDeposits: number;
  totalWithdrawals: number;
  recentSignups: number; // last 7 days
  topMarkets: { id: string; title: string; total_volume: number; status: string }[];
}

export async function fetchPlatformAnalytics(): Promise<{ data: PlatformAnalytics | null; error: string | null }> {
  const [usersRes, marketsRes, tradesRes, txRes] = await Promise.all([
    safeFetch(supabase.from("profiles").select("id, created_at").limit(5000) as any),
    safeFetch(supabase.from("markets").select("id, title, total_volume, status, created_at").limit(5000) as any),
    safeFetch(supabase.from("trades").select("id", { count: "exact", head: true }) as any),
    safeFetch(supabase.from("transactions").select("type, amount, status").limit(5000) as any),
  ]);

  if (usersRes.error || marketsRes.error) {
    return { data: null, error: usersRes.error || marketsRes.error };
  }

  const users = (usersRes.data as any[]) || [];
  const markets = (marketsRes.data as any[]) || [];
  const transactions = (txRes.data as any[]) || [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const recentSignups = users.filter(u => u.created_at >= sevenDaysAgo).length;

  const completedDeposits = transactions.filter(t => t.type === "deposit" && t.status === "completed");
  const completedWithdrawals = transactions.filter(t => t.type === "withdrawal" && t.status === "completed");

  const topMarkets = [...markets]
    .sort((a, b) => b.total_volume - a.total_volume)
    .slice(0, 10)
    .map(m => ({ id: m.id, title: m.title, total_volume: m.total_volume, status: m.status }));

  return {
    data: {
      totalUsers: users.length,
      totalMarkets: markets.length,
      openMarkets: markets.filter(m => m.status === "open").length,
      resolvedMarkets: markets.filter(m => m.status === "resolved").length,
      totalVolume: markets.reduce((s, m) => s + Number(m.total_volume), 0),
      totalTrades: (tradesRes as any)?.count || 0,
      totalDeposits: completedDeposits.reduce((s, t) => s + Number(t.amount), 0),
      totalWithdrawals: completedWithdrawals.reduce((s, t) => s + Number(t.amount), 0),
      recentSignups,
      topMarkets,
    },
    error: null,
  };
}
