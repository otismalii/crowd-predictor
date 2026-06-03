import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/SEOHead";
import { Link } from "react-router-dom";
import { Shield, BarChart3, Users, Database, Scale, RefreshCw, Landmark, ShieldAlert, Clock, TrendingUp, Wallet, Activity, FileText, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import { motion } from "framer-motion";

const adminLinks = [
  { to: "/admin/treasury", label: "Treasury", icon: Landmark },
  { to: "/admin/fraud", label: "Fraud", icon: ShieldAlert },
  { to: "/admin/markets", label: "Markets", icon: BarChart3 },
  { to: "/admin/markets/new", label: "New Market", icon: Database },
  { to: "/admin/resolution", label: "Resolution", icon: Scale },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/audit", label: "Audit Log", icon: FileText },
];

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

const AdminOverviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FinStats>({
    totalUsers: 0, openMarkets: 0, totalVolume: 0,
    pendingDeposits: 0, pendingWithdrawals: 0, todayTrades: 0,
    totalWalletBalances: 0, pendingDisputes: 0, platformRevenue: 0,
  });

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [usersRes, marketsRes, txRes, walletsRes, tradesRes, disputesRes, feesRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("markets").select("status, total_volume").limit(1000),
        supabase.from("transactions").select("type, amount, status").eq("status", "pending").limit(500),
        supabase.from("wallets").select("balance").limit(5000),
        supabase.from("trades").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("market_disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("ledger_entries").select("amount").eq("entry_type", "house_fee").limit(5000),
      ]);

      const markets = marketsRes.data || [];
      const txs = (txRes.data || []) as any[];
      const wallets = (walletsRes.data || []) as any[];
      const fees = (feesRes.data || []) as any[];

      const totalWalletBalances = wallets.reduce((s, w) => s + Number(w.balance), 0);
      const platformRevenue = fees.reduce((s, f) => s + Math.abs(Number(f.amount)), 0);

      setStats({
        totalUsers: usersRes.count || 0,
        openMarkets: markets.filter((m: any) => m.status === "open").length,
        totalVolume: markets.reduce((s: number, m: any) => s + Number(m.total_volume || 0), 0),
        pendingDeposits: txs.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0),
        pendingWithdrawals: txs.filter(t => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0),
        todayTrades: tradesRes.count || 0,
        totalWalletBalances,
        pendingDisputes: disputesRes.count || 0,
        platformRevenue,
      });
    } catch (e) {
      console.error("Admin stats error:", e);
    }
    setLoading(false);
  };

  const netTreasury = stats.totalVolume - stats.totalWalletBalances;
  const reserveRatio = stats.totalWalletBalances > 0 ? ((netTreasury / stats.totalWalletBalances) * 100) : 0;

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Open Markets", value: stats.openMarkets, icon: BarChart3, color: "text-primary" },
    { label: "Total Volume", value: stats.totalVolume, icon: TrendingUp, color: "text-accent", suffix: " KES" },
    { label: "Platform Revenue", value: stats.platformRevenue, icon: DollarSign, color: "text-primary", suffix: " KES" },
    { label: "Pending Deposits", value: stats.pendingDeposits, icon: Clock, color: "text-accent", suffix: " KES" },
    { label: "Pending Withdrawals", value: stats.pendingWithdrawals, icon: Clock, color: "text-destructive", suffix: " KES" },
    { label: "User Liabilities", value: stats.totalWalletBalances, icon: Wallet, color: "text-foreground", suffix: " KES" },
    { label: "Today's Trades", value: stats.todayTrades, icon: Activity, color: "text-primary" },
    { label: "Open Disputes", value: stats.pendingDisputes, icon: ShieldAlert, color: stats.pendingDisputes > 0 ? "text-destructive" : "text-muted-foreground" },
  ];

  const pendingActions = [
    stats.pendingDeposits > 0 && { label: "Pending Deposits", count: `KES ${Math.round(stats.pendingDeposits).toLocaleString()}`, to: "/admin/treasury", color: "text-accent" },
    stats.pendingWithdrawals > 0 && { label: "Pending Withdrawals", count: `KES ${Math.round(stats.pendingWithdrawals).toLocaleString()}`, to: "/admin/treasury", color: "text-destructive" },
    stats.pendingDisputes > 0 && { label: "Open Disputes", count: String(stats.pendingDisputes), to: "/admin/resolution", color: "text-destructive" },
  ].filter(Boolean) as { label: string; count: string; to: string; color: string }[];

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead title="Admin" path="/admin" />
      
      <div className="border-b border-border/30">
        <div className="container py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold tracking-wider">
                  Admin <span className="text-primary">Control Room</span>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">Fintech operations & settlement console</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>
      </div>
      <div className="container py-6 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map(({ label, value, icon: Icon, color, suffix }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.08)" className="h-full">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
                  </div>
                  <div className={`font-display text-lg font-bold tabular-nums ${color}`}>
                    <AnimatedCounter value={Math.round(Math.abs(value))} fontSize={18} duration={0.8} />
                    {suffix && <span className="text-xs font-normal text-muted-foreground ml-0.5">{suffix}</span>}
                  </div>
                </CardContent>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>

        {/* Reserve Ratio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/30 bg-card/50 p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Reserve Ratio</p>
            <p className={`font-display text-2xl font-bold ${reserveRatio >= 100 ? "text-primary" : reserveRatio >= 50 ? "text-accent" : "text-destructive"}`}>
              {reserveRatio.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Net treasury vs user liabilities</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-card/50 p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Net Treasury</p>
            <p className={`font-display text-2xl font-bold ${netTreasury >= 0 ? "text-primary" : "text-destructive"}`}>
              {Math.round(netTreasury).toLocaleString()} KES
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total volume minus user balances</p>
          </div>
        </div>

        {/* Pending Actions */}
        {pendingActions.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-display text-sm font-bold tracking-wider text-muted-foreground uppercase">⚠️ Pending Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {pendingActions.map(({ label, count, to, color }) => (
                <Link key={label} to={to}>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-card/50 hover:bg-card hover:border-primary/20 transition-all">
                    <span className="text-xs font-medium">{label}</span>
                    <span className={`font-display text-sm font-bold ${color}`}>{count}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {adminLinks.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}>
              <motion.div
                whileHover={{ y: -2 }}
                className="flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-card/50 hover:bg-card hover:border-primary/20 transition-all cursor-pointer"
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{label}</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
      
    </div>
  );
};

export default AdminOverviewPage;