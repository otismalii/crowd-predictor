import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, BarChart3, Users, Scale, RefreshCw, Landmark, ShieldAlert,
  Clock, TrendingUp, Wallet, Activity, DollarSign, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdminPageHeader, AdminPageBody, AdminStatGrid, AdminSectionCard, AdminEmptyState,
} from "@/components/admin/primitives";
import { formatDistanceToNow } from "date-fns";

interface FinStats {
  totalUsers: number;
  openMarkets: number;
  totalVolume: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  todayTrades: number;
  totalWalletBalances: number;
  pendingDisputes: number;
  platformRevenue: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString();
const kes = (n: number) => `KES ${fmt(n)}`;

const AdminOverviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FinStats>({
    totalUsers: 0, openMarkets: 0, totalVolume: 0,
    pendingDeposits: 0, pendingWithdrawals: 0, todayTrades: 0,
    totalWalletBalances: 0, pendingDisputes: 0, platformRevenue: 0,
  });
  const [recentAudit, setRecentAudit] = useState<any[]>([]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [usersRes, marketsRes, txRes, walletsRes, tradesRes, disputesRes, feesRes, auditRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("markets").select("status, total_volume").limit(1000),
        supabase.from("transactions").select("type, amount, status").eq("status", "pending").limit(500),
        supabase.from("wallets").select("balance").limit(5000),
        supabase.from("trades").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("market_disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("ledger_entries").select("amount").eq("entry_type", "house_fee").limit(5000),
        supabase.from("market_audit_log").select("id, action, created_at, market_id").order("created_at", { ascending: false }).limit(8),
      ]);

      const markets = marketsRes.data || [];
      const txs = (txRes.data || []) as any[];
      const wallets = (walletsRes.data || []) as any[];
      const fees = (feesRes.data || []) as any[];

      setStats({
        totalUsers: usersRes.count || 0,
        openMarkets: markets.filter((m: any) => m.status === "open").length,
        totalVolume: markets.reduce((s: number, m: any) => s + Number(m.total_volume || 0), 0),
        pendingDeposits: txs.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0),
        pendingWithdrawals: txs.filter(t => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0),
        todayTrades: tradesRes.count || 0,
        totalWalletBalances: wallets.reduce((s, w) => s + Number(w.balance), 0),
        pendingDisputes: disputesRes.count || 0,
        platformRevenue: fees.reduce((s, f) => s + Math.abs(Number(f.amount)), 0),
      });
      setRecentAudit(auditRes.data || []);
    } catch (e) { console.error("Admin stats error:", e); }
    setLoading(false);
  };

  const netTreasury = stats.totalVolume - stats.totalWalletBalances;
  const reserveRatio = stats.totalWalletBalances > 0 ? ((netTreasury / stats.totalWalletBalances) * 100) : 0;
  const reserveTone = reserveRatio >= 100 ? "primary" : reserveRatio >= 50 ? "accent" : "destructive";

  const liquidityStats = [
    { label: "Net Treasury", value: kes(netTreasury), icon: Landmark, tone: netTreasury >= 0 ? "primary" : "destructive", hint: "Volume − user balances" } as const,
    { label: "Reserve Ratio", value: `${reserveRatio.toFixed(1)}%`, icon: TrendingUp, tone: reserveTone, hint: "Treasury / liabilities" } as const,
    { label: "Platform Revenue", value: kes(stats.platformRevenue), icon: DollarSign, tone: "primary", hint: "Lifetime house fees" } as const,
    { label: "User Liabilities", value: kes(stats.totalWalletBalances), icon: Wallet, tone: "default", hint: "Sum of all wallets" } as const,
  ];

  const activityStats = [
    { label: "Total Users", value: fmt(stats.totalUsers), icon: Users, tone: "default" } as const,
    { label: "Open Markets", value: fmt(stats.openMarkets), icon: BarChart3, tone: "primary" } as const,
    { label: "Trades Today", value: fmt(stats.todayTrades), icon: Activity, tone: "accent" } as const,
    { label: "Total Volume", value: kes(stats.totalVolume), icon: TrendingUp, tone: "primary" } as const,
  ];

  const riskStats = [
    { label: "Pending Deposits", value: kes(stats.pendingDeposits), icon: Clock, tone: stats.pendingDeposits > 0 ? "accent" : "muted" } as const,
    { label: "Pending Withdrawals", value: kes(stats.pendingWithdrawals), icon: Clock, tone: stats.pendingWithdrawals > 0 ? "destructive" : "muted" } as const,
    { label: "Open Disputes", value: fmt(stats.pendingDisputes), icon: ShieldAlert, tone: stats.pendingDisputes > 0 ? "destructive" : "muted" } as const,
  ];

  const pendingActions = [
    stats.pendingDeposits > 0 && { label: "Pending Deposits", count: kes(stats.pendingDeposits), to: "/admin/finance/treasury" },
    stats.pendingWithdrawals > 0 && { label: "Pending Withdrawals", count: kes(stats.pendingWithdrawals), to: "/admin/finance/treasury" },
    stats.pendingDisputes > 0 && { label: "Open Disputes", count: String(stats.pendingDisputes), to: "/admin/risk/disputes" },
  ].filter(Boolean) as { label: string; count: string; to: string }[];

  return (
    <>
      <AdminPageHeader
        icon={LayoutDashboard}
        title="Overview"
        subtitle="Fintech operations, settlement, and risk at a glance"
        actions={
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />
      <AdminPageBody>
        <AdminSectionCard title="Liquidity & Solvency">
          <AdminStatGrid stats={liquidityStats} cols={4} />
        </AdminSectionCard>

        <AdminSectionCard title="Activity">
          <AdminStatGrid stats={activityStats} cols={4} />
        </AdminSectionCard>

        <AdminSectionCard title="Risk">
          <AdminStatGrid stats={riskStats} cols={3} />
        </AdminSectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AdminSectionCard
            title="Pending Actions"
            action={pendingActions.length > 0 && (
              <span className="text-[10px] text-destructive uppercase font-medium">{pendingActions.length} item(s)</span>
            )}
          >
            {pendingActions.length === 0 ? (
              <AdminEmptyState title="All caught up" description="No pending operations require attention right now." />
            ) : (
              <ul className="space-y-1.5">
                {pendingActions.map(({ label, count, to }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-card/50 hover:bg-card hover:border-primary/30 transition-all"
                    >
                      <span className="text-sm">{label}</span>
                      <span className="flex items-center gap-2 font-display text-sm font-bold">
                        {count} <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminSectionCard>

          <AdminSectionCard
            title="Recent Audit Events"
            action={<Link to="/admin/system/audit" className="text-[10px] uppercase font-medium text-primary hover:underline">View all</Link>}
          >
            {recentAudit.length === 0 ? (
              <AdminEmptyState icon={Scale} title="No recent events" />
            ) : (
              <ul className="space-y-1">
                {recentAudit.map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/20 last:border-0">
                    <span className="font-mono text-muted-foreground">{e.action}</span>
                    <span className="text-muted-foreground">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
                  </li>
                ))}
              </ul>
            )}
          </AdminSectionCard>
        </div>
      </AdminPageBody>
    </>
  );
};

export default AdminOverviewPage;
