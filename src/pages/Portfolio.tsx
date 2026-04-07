import { useEffect, useState, useMemo } from "react";
import SEOHead from "@/components/SEOHead";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PortfolioSkeleton from "@/components/skeletons/PortfolioSkeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, BarChart3, Wallet, ChevronRight,
  PieChart, ArrowUpRight, ArrowDownLeft, Activity,
} from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import { lmsrPrice } from "@/lib/pricing";

interface PositionRow {
  outcome_id: string;
  market_id: string;
  shares: number;
  avg_price: number;
  total_cost: number;
}

interface OutcomeRow {
  id: string;
  label: string;
  pool_shares: number;
  is_winner: boolean | null;
  market_id: string;
}

interface MarketRow {
  id: string;
  title: string;
  status: string;
  liquidity_param: number;
  total_volume: number;
  closes_at: string | null;
}

interface PortfolioItem {
  market: MarketRow;
  outcome: OutcomeRow;
  position: PositionRow;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  allOutcomes: OutcomeRow[];
}

const Portfolio = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchPortfolio();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      const channelName = `portfolio-${user.id}-${Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on("postgres_changes", { event: "*", schema: "public", table: "positions", filter: `user_id=eq.${user.id}` }, () => fetchPortfolio())
        .on("postgres_changes", { event: "*", schema: "public", table: "market_outcomes" }, () => fetchPortfolio())
        .subscribe();
    } catch (e) {
      console.warn("[realtime] Portfolio channel setup failed:", e);
    }

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user]);

  const fetchPortfolio = async () => {
    if (!user) return;

    const [posRes, walletRes] = await Promise.all([
      supabase.from("positions").select("outcome_id, market_id, shares, avg_price, total_cost").eq("user_id", user.id).gt("shares", 0) as any,
      supabase.from("wallets").select("balance").eq("user_id", user.id).single() as any,
    ]);

    if (walletRes.data) setWalletBalance(walletRes.data.balance);

    const positions: PositionRow[] = posRes.data || [];
    if (positions.length === 0) { setItems([]); setLoading(false); return; }

    const marketIds = [...new Set(positions.map(p => p.market_id))];
    const outcomeIds = positions.map(p => p.outcome_id);

    const [marketsRes, outcomesRes] = await Promise.all([
      supabase.from("markets").select("id, title, status, liquidity_param, total_volume, closes_at").in("id", marketIds) as any,
      supabase.from("market_outcomes").select("id, label, pool_shares, is_winner, market_id").in("market_id", marketIds).order("sort_order") as any,
    ]);

    const marketsMap: Record<string, MarketRow> = {};
    for (const m of (marketsRes.data || [])) marketsMap[m.id] = m;

    const outcomesByMarket: Record<string, OutcomeRow[]> = {};
    const outcomeMap: Record<string, OutcomeRow> = {};
    for (const o of (outcomesRes.data || [])) {
      outcomeMap[o.id] = o;
      if (!outcomesByMarket[o.market_id]) outcomesByMarket[o.market_id] = [];
      outcomesByMarket[o.market_id].push(o);
    }

    const portfolio: PortfolioItem[] = [];
    for (const pos of positions) {
      const market = marketsMap[pos.market_id];
      const outcome = outcomeMap[pos.outcome_id];
      if (!market || !outcome) continue;

      const allOutcomes = outcomesByMarket[pos.market_id] || [];
      const pools = allOutcomes.map(o => Number(o.pool_shares));
      const b = Number(market.liquidity_param);
      const idx = allOutcomes.findIndex(o => o.id === pos.outcome_id);
      const currentPrice = idx >= 0 ? lmsrPrice(pools, idx, b) : 0;

      let currentValue: number;
      if (market.status === "resolved") {
        currentValue = outcome.is_winner ? pos.shares : 0;
      } else {
        currentValue = pos.shares * currentPrice;
      }

      const pnl = currentValue - pos.total_cost;
      const pnlPercent = pos.total_cost > 0 ? (pnl / pos.total_cost) * 100 : 0;

      portfolio.push({ market, outcome, position: pos, currentPrice, currentValue, pnl, pnlPercent, allOutcomes });
    }

    portfolio.sort((a, b) => b.currentValue - a.currentValue);
    setItems(portfolio);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(i => filter === "open" ? i.market.status === "open" : i.market.status === "resolved");
  }, [items, filter]);

  const totalInvested = items.reduce((s, i) => s + i.position.total_cost, 0);
  const totalValue = items.reduce((s, i) => s + i.currentValue, 0);
  const totalPnl = totalValue - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const openPositions = items.filter(i => i.market.status === "open").length;
  const resolvedPositions = items.filter(i => i.market.status === "resolved").length;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center text-muted-foreground">
          <PieChart className="mx-auto mb-4 h-12 w-12 opacity-20" />
          <p className="font-display text-lg">Sign in to view your portfolio</p>
          <Link to="/auth" className="text-primary hover:underline text-sm mt-2 inline-block">Sign in</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Portfolio | Pagaza" path="/portfolio" />
      <Navbar />

      <div className="container py-8 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold tracking-wider text-foreground mb-1">
            <GradientText className="font-display text-3xl font-bold tracking-wider">Portfolio</GradientText>
          </h1>
          <p className="text-sm text-muted-foreground mb-6">Track your positions and P&L across all markets</p>
        </motion.div>

        {/* Summary cards */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
        >
          {[
            {
              label: "Portfolio Value",
              value: totalValue,
              icon: PieChart,
              color: "text-primary",
              suffix: " KES",
            },
            {
              label: "Total P&L",
              value: totalPnl,
              icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
              color: totalPnl >= 0 ? "text-primary" : "text-destructive",
              prefix: totalPnl >= 0 ? "+" : "",
              suffix: " KES",
            },
            {
              label: "Wallet",
              value: walletBalance,
              icon: Wallet,
              color: "text-accent",
              suffix: " KES",
            },
            {
              label: "Positions",
              value: items.length,
              icon: Activity,
              color: "text-foreground",
              suffix: "",
            },
          ].map(({ label, value, icon: Icon, color, prefix, suffix }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 + i * 0.03 }}
            >
              <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.08)" className="h-full">
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
                  </div>
                  <div className={`font-display text-lg font-bold tabular-nums ${color}`}>
                    {prefix}
                    <AnimatedCounter value={Math.round(Math.abs(value))} fontSize={18} duration={0.8} />
                    <span className="text-xs font-normal text-muted-foreground ml-0.5">{suffix}</span>
                  </div>
                  {label === "Total P&L" && totalInvested > 0 && (
                    <span className={`text-[10px] tabular-nums ${totalPnl >= 0 ? "text-primary" : "text-destructive"}`}>
                      {totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(1)}%
                    </span>
                  )}
                </CardContent>
              </SpotlightCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30 w-fit mb-5"
        >
          {([
            { key: "all" as const, label: "All", count: items.length },
            { key: "open" as const, label: "Open", count: openPositions },
            { key: "resolved" as const, label: "Resolved", count: resolvedPositions },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === key
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter === key && (
                <motion.div
                  layoutId="portfolio-filter-bg"
                  className="absolute inset-0 bg-primary rounded-lg shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {label}
                {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
              </span>
            </button>
          ))}
        </motion.div>

        {/* Positions list */}
        {loading ? (
          <PortfolioSkeleton />
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <PieChart className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
            <p className="text-muted-foreground font-display text-lg">
              {items.length === 0 ? "No positions yet" : "No positions match this filter"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {items.length === 0 ? "Buy shares in a market to start tracking your portfolio." : "Try a different filter."}
            </p>
            {items.length === 0 && (
              <Link to="/" className="text-primary hover:underline text-sm mt-3 inline-block">Browse Markets</Link>
            )}
          </motion.div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((item, i) => {
              const pct = Math.round(item.currentPrice * 100);
              const isWin = item.outcome.is_winner === true;
              const isLoss = item.market.status === "resolved" && !isWin;

              return (
                <motion.div
                  key={`${item.position.market_id}-${item.position.outcome_id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link to={`/markets/${item.market.id}`}>
                    <div className={`rounded-xl border p-4 transition-all hover:shadow-sm group ${
                      isWin ? "border-primary/30 bg-primary/5 hover:border-primary/50" :
                      isLoss ? "border-destructive/20 bg-destructive/5 opacity-70" :
                      "border-border/30 bg-card/50 hover:bg-card hover:border-primary/20"
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              item.market.status === "open" ? "bg-primary/20 text-primary" :
                              item.market.status === "resolved" ? "bg-muted text-muted-foreground" :
                              "bg-accent/20 text-accent"
                            }`}>
                              {item.market.status.toUpperCase()}
                            </span>
                            {isWin && (
                              <Badge variant="outline" className="text-[9px] border-primary/30 text-primary gap-1 px-1.5 py-0">
                                <ArrowUpRight className="h-2.5 w-2.5" /> Won
                              </Badge>
                            )}
                            {isLoss && (
                              <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive gap-1 px-1.5 py-0">
                                <ArrowDownLeft className="h-2.5 w-2.5" /> Lost
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {item.market.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.position.shares} shares of <span className="font-semibold text-foreground">{item.outcome.label}</span>
                            {item.market.status === "open" && (
                              <span className="ml-2 text-primary font-bold">{pct}c</span>
                            )}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="font-display text-base font-bold tabular-nums">
                            <AnimatedCounter value={Math.round(item.currentValue)} fontSize={16} duration={0.6} />
                            <span className="text-[10px] text-muted-foreground ml-0.5">KES</span>
                          </div>
                          <div className={`text-xs font-bold tabular-nums ${item.pnl >= 0 ? "text-primary" : "text-destructive"}`}>
                            {item.pnl >= 0 ? "+" : ""}{item.pnl.toFixed(1)}
                            <span className="text-[10px] ml-0.5 opacity-70">
                              ({item.pnlPercent >= 0 ? "+" : ""}{item.pnlPercent.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Cost: {item.position.total_cost.toFixed(1)}
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1 flex-shrink-0" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Portfolio;
