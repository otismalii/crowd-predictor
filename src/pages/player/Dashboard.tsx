import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { lmsrPrice } from "@/lib/pricing";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";
import PositionsList from "@/components/portfolio/PositionsList";
import { Wallet, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

interface PositionRow { outcome_id: string; market_id: string; shares: number; avg_price: number; total_cost: number; }
interface OutcomeRow { id: string; label: string; pool_shares: number; is_winner: boolean | null; market_id: string; }
interface MarketRow { id: string; title: string; status: string; liquidity_param: number; total_volume: number; closes_at: string | null; }
interface PortfolioItem {
  market: MarketRow;
  outcome: OutcomeRow;
  position: PositionRow;
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [posFilter, setPosFilter] = useState<"all" | "open" | "resolved">("all");
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    if (!user) return;
    const [walletRes, posRes, profileRes] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", user.id).single() as any,
      supabase.from("positions").select("outcome_id, market_id, shares, avg_price, total_cost").eq("user_id", user.id).gt("shares", 0) as any,
      (supabase as any).rpc("get_own_profile"),
    ]);

    if (walletRes.data) setWallet(walletRes.data);
    const ownProfile = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data;
    if (ownProfile) setProfile(ownProfile);

    const positions: PositionRow[] = posRes.data || [];
    if (positions.length === 0) { setPortfolioItems([]); setLoading(false); return; }

    const marketIds = [...new Set(positions.map(p => p.market_id))];
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
      const currentValue = market.status === "resolved" ? (outcome.is_winner ? pos.shares : 0) : pos.shares * currentPrice;
      const pnl = currentValue - pos.total_cost;
      const pnlPercent = pos.total_cost > 0 ? (pnl / pos.total_cost) * 100 : 0;
      portfolio.push({ market, outcome, position: pos, currentPrice, currentValue, pnl, pnlPercent });
    }
    portfolio.sort((a, b) => b.currentValue - a.currentValue);
    setPortfolioItems(portfolio);
    setLoading(false);
  };

  const totalInvested = portfolioItems.reduce((s, i) => s + i.position.total_cost, 0);
  const totalValue = portfolioItems.reduce((s, i) => s + i.currentValue, 0);
  const totalPnl = totalValue - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center text-muted-foreground">
          <Wallet className="mx-auto mb-4 h-12 w-12 opacity-20" />
          <p className="font-display text-lg">Sign in to access your dashboard</p>
          <Link to="/auth" className="text-primary hover:underline text-sm mt-2 inline-block">Sign in</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Dashboard" path="/dashboard" />
      <Navbar />

      <div className="border-b border-border/30">
        <div className="container py-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider">
            <span className="text-primary">Dashboard</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Your balance, positions & performance</p>
          {profile && (
            <div className="flex items-center gap-3 mt-3">
              <span className="text-sm font-medium">@{profile.username || "anon"}</span>
              <span className="text-xs text-muted-foreground">{profile.accuracy_rate}% accuracy</span>
              {profile.current_streak > 0 && (
                <span className="text-xs text-accent">🔥 {profile.current_streak} streak</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="container py-6 space-y-6 max-w-4xl">
        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : (
          <>
            <PortfolioSummary
              balance={wallet?.balance || 0}
              totalValue={totalValue}
              totalPnl={totalPnl}
              totalPnlPercent={totalPnlPercent}
              positionCount={portfolioItems.length}
            />
            <PositionsList
              items={portfolioItems}
              filter={posFilter}
              onFilterChange={setPosFilter}
            />
            <div className="flex gap-3 text-sm">
              <Link to="/portfolio" className="text-primary hover:underline">Full Portfolio →</Link>
              <Link to="/activity" className="text-primary hover:underline">Activity Log →</Link>
              <Link to="/wallet" className="text-primary hover:underline">Wallet →</Link>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;
