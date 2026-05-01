import { useEffect, useState, useMemo, useCallback } from "react";
import SEOHead from "@/components/SEOHead";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import WalletSkeleton from "@/components/skeletons/WalletSkeleton";
import {
  Wallet as WalletIcon, TrendingUp, TrendingDown, PieChart, Activity,
  Pencil, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import Aurora from "@/components/reactbits/Aurora";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import { lmsrPrice } from "@/lib/pricing";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import StreakBadge from "@/components/StreakBadge";
import ProfileEdit from "@/components/ProfileEdit";
import PullToRefresh from "@/components/PullToRefresh";
import DepositWithdraw from "@/components/wallet/DepositWithdraw";
import TransactionHistory from "@/components/wallet/TransactionHistory";
import PositionsPanel from "@/components/wallet/PositionsPanel";
import ReconciliationBadge from "@/components/wallet/ReconciliationBadge";
import type { LedgerEntry } from "@/lib/ledger";

// --- Types ---
interface WalletData { id: string; balance: number; currency: string; locked_balance?: number; daily_withdrawal_total?: number; }
interface PositionRow { outcome_id: string; market_id: string; shares: number; avg_price: number; total_cost: number; }
interface OutcomeRow { id: string; label: string; pool_shares: number; is_winner: boolean | null; market_id: string; }
interface MarketRow { id: string; title: string; status: string; liquidity_param: number; total_volume: number; closes_at: string | null; }
interface PortfolioItem { market: MarketRow; outcome: OutcomeRow; position: PositionRow; currentPrice: number; currentValue: number; pnl: number; pnlPercent: number; }

const Wallet = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchAll();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      const channelName = `wallet-${user.id}-${Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on("postgres_changes", { event: "*", schema: "public", table: "positions", filter: `user_id=eq.${user.id}` }, () => fetchAll())
        .on("postgres_changes", { event: "*", schema: "public", table: "market_outcomes" }, () => fetchAll())
        .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => fetchAll())
        .subscribe();
    } catch (e) {
      console.warn("[realtime] Wallet channel setup failed:", e);
    }

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [walletRes, ledgerRes, posRes, profileRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("user_id", user.id).single() as any,
        supabase.from("ledger_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100) as any,
        supabase.from("positions").select("outcome_id, market_id, shares, avg_price, total_cost").eq("user_id", user.id).gt("shares", 0) as any,
        supabase.from("profiles").select("*").eq("id", user.id).single() as any,
      ]);

      if (walletRes.data) setWallet(walletRes.data);
      if (ledgerRes.data) setLedgerEntries(ledgerRes.data);
      if (profileRes.data) setProfile(profileRes.data);

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
    } catch (e: any) {
      toast({ title: "Failed to load data", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, [user]);

  const totalInvested = portfolioItems.reduce((s, i) => s + i.position.total_cost, 0);
  const totalValue = portfolioItems.reduce((s, i) => s + i.currentValue, 0);
  const totalPnl = totalValue - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center text-muted-foreground">
          <WalletIcon className="mx-auto mb-4 h-12 w-12 opacity-20" />
          <p className="font-display text-lg">Sign in to access your dashboard</p>
          <Link to="/auth" className="text-primary hover:underline text-sm mt-2 inline-block">Sign in</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead title="Dashboard | Pagaza" path="/wallet" />
      <Navbar />

      {/* Hero header */}
      <div className="relative border-b border-border/30 overflow-hidden">
        <Aurora />
        <div className="relative container py-6 sm:py-8">
          {profile && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-4">
              <Link to={`/profile/${user!.id}`}>
                <Avatar className="h-14 w-14 ring-2 ring-border/50 hover:ring-primary/40 transition-all">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-display font-bold text-lg">
                    {(profile.username || "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link to={`/profile/${user!.id}`} className="font-display text-lg font-bold tracking-wider text-foreground hover:text-primary transition-colors truncate">
                    {profile.username || "Anonymous"}
                  </Link>
                  <StreakBadge currentStreak={profile.current_streak} bestStreak={profile.best_streak} compact />
                </div>
                {profile.bio && <p className="text-xs text-muted-foreground truncate">{profile.bio}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> {profile.followers_count} followers
                  </span>
                  <span className="text-[10px] text-muted-foreground">{profile.accuracy_rate}% accuracy</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditingProfile(!editingProfile)} className="flex-shrink-0">
                <Pencil className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          <AnimatePresence>
            {editingProfile && profile && (
              <ProfileEdit
                profile={profile}
                onClose={() => setEditingProfile(false)}
                onSaved={(updated) => { setProfile(updated); setEditingProfile(false); }}
              />
            )}
          </AnimatePresence>

          {!editingProfile && (
            <>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider">
                <GradientText className="font-display text-2xl sm:text-3xl font-bold tracking-wider">DASHBOARD</GradientText>
              </h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-xs text-muted-foreground mt-0.5">
                Wallet, positions & transaction history
              </motion.p>
            </>
          )}
        </div>
      </div>

      <PullToRefresh onRefresh={fetchAll} className="container py-6">
        {loading ? (
          <WalletSkeleton />
        ) : (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* LEFT: Stats + Positions */}
            <div className="lg:col-span-3 space-y-5">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Balance", value: wallet?.balance || 0, icon: WalletIcon, color: "text-primary", suffix: " KES", showRecon: true },
                  { label: "Portfolio", value: totalValue, icon: PieChart, color: "text-accent", suffix: " KES" },
                  { label: "P&L", value: totalPnl, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, color: totalPnl >= 0 ? "text-primary" : "text-destructive", prefix: totalPnl >= 0 ? "+" : "", suffix: " KES" },
                  { label: "Positions", value: portfolioItems.length, icon: Activity, color: "text-foreground", suffix: "" },
                ].map(({ label, value, icon: Icon, color, prefix, suffix, showRecon }: any, i) => (
                  <motion.div key={label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
                    <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.08)" className="h-full">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className={`h-3.5 w-3.5 ${color}`} />
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
                        </div>
                        <div className={`font-display text-lg font-bold tabular-nums ${color}`}>
                          {prefix}
                          <AnimatedCounter value={Math.round(Math.abs(value))} fontSize={18} duration={0.8} />
                          <span className="text-xs font-normal text-muted-foreground ml-0.5">{suffix}</span>
                        </div>
                        {label === "P&L" && totalInvested > 0 && (
                          <span className={`text-[10px] tabular-nums ${totalPnl >= 0 ? "text-primary" : "text-destructive"}`}>
                            {totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(1)}%
                          </span>
                        )}
                        {showRecon && wallet && ledgerEntries.length > 0 && (
                          <div className="mt-1">
                            <ReconciliationBadge
                              walletBalance={Number(wallet.balance)}
                              ledgerBalance={Number(ledgerEntries[0].balance_after)}
                            />
                          </div>
                        )}
                      </CardContent>
                    </SpotlightCard>
                  </motion.div>
                ))}
              </motion.div>

              <PositionsPanel portfolioItems={portfolioItems} />
            </div>

            {/* RIGHT: Deposit/Withdraw + History */}
            <div className="lg:col-span-2 space-y-5">
              <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <DepositWithdraw
                  wallet={wallet}
                  phoneNumber={profile?.phone_number || null}
                  onComplete={fetchAll}
                />
              </motion.div>
              <TransactionHistory entries={ledgerEntries} />
            </div>
          </div>
        )}
      </PullToRefresh>
      <Footer />
    </div>
  );
};

export default Wallet;
