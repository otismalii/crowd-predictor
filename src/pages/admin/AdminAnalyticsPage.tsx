import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { fetchPlatformAnalytics, type PlatformAnalytics } from "@/services/analyticsService";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardContent } from "@/components/ui/card";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import {
  BarChart3, Users, TrendingUp, Layers, RefreshCw,
  DollarSign, ArrowDownLeft, ArrowUpRight, Activity,
} from "lucide-react";
import { motion } from "framer-motion";

const AdminAnalyticsPage = () => {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await fetchPlatformAnalytics();
    if (data) setAnalytics(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Admin - Analytics" path="/admin/analytics" />
      <Navbar />
      <div className="border-b border-border/30">
        <div className="container py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-wider">Platform <span className="text-primary">Analytics</span></h1>
              <p className="text-xs text-muted-foreground mt-0.5">Users, volume, markets & revenue metrics</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>
      <div className="container py-6 space-y-6">
        {loading || !analytics ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Users", value: analytics.totalUsers, icon: Users, color: "text-primary" },
                { label: "New (7d)", value: analytics.recentSignups, icon: TrendingUp, color: "text-primary" },
                { label: "Total Markets", value: analytics.totalMarkets, icon: Layers, color: "text-accent" },
                { label: "Open Markets", value: analytics.openMarkets, icon: Activity, color: "text-primary" },
                { label: "Total Volume", value: analytics.totalVolume, icon: BarChart3, color: "text-primary", suffix: " KES" },
                { label: "Total Trades", value: analytics.totalTrades, icon: TrendingUp, color: "text-foreground" },
                { label: "Deposits", value: analytics.totalDeposits, icon: ArrowDownLeft, color: "text-primary", suffix: " KES" },
                { label: "Withdrawals", value: analytics.totalWithdrawals, icon: ArrowUpRight, color: "text-destructive", suffix: " KES" },
              ].map(({ label, value, icon: Icon, color, suffix }, i) => (
                <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.08)" className="h-full">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`h-3.5 w-3.5 ${color}`} />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
                      </div>
                      <div className={`font-display text-lg font-bold tabular-nums ${color}`}>
                        <AnimatedCounter value={Math.round(value)} fontSize={18} duration={0.8} />
                        {suffix && <span className="text-xs font-normal text-muted-foreground ml-0.5">{suffix}</span>}
                      </div>
                    </CardContent>
                  </SpotlightCard>
                </motion.div>
              ))}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-wider mb-3">Top Markets by Volume</h2>
              <div className="rounded-xl border border-border/30 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Market</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Volume (KES)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topMarkets.map((m, i) => (
                      <tr key={m.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-display font-bold text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">
                          <Link to={`/markets/${m.id}`} className="font-medium text-foreground hover:text-primary transition-colors">{m.title}</Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            m.status === "open" ? "bg-primary/20 text-primary" :
                            m.status === "resolved" ? "bg-muted text-muted-foreground" :
                            "bg-accent/20 text-accent"
                          }`}>{m.status.toUpperCase()}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-display font-bold tabular-nums">{Math.round(m.total_volume).toLocaleString()}</td>
                      </tr>
                    ))}
                    {analytics.topMarkets.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No markets yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default AdminAnalyticsPage;
