import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import WalletSkeleton from "@/components/skeletons/WalletSkeleton";
import {
  Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Phone, History,
  TrendingUp, TrendingDown, PieChart, Activity, ChevronRight,
  BarChart3, Pencil, Users,
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import SplitText from "@/components/reactbits/SplitText";
import Aurora from "@/components/reactbits/Aurora";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import { lmsrPrice } from "@/components/MarketCard";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import StreakBadge from "@/components/StreakBadge";
import ProfileEdit from "@/components/ProfileEdit";
import PullToRefresh from "@/components/PullToRefresh";

// --- Types ---

interface WalletData { id: string; balance: number; currency: string; }
interface Transaction { id: string; type: string; amount: number; status: string; description: string | null; mpesa_receipt: string | null; created_at: string; }
interface PositionRow { outcome_id: string; market_id: string; shares: number; avg_price: number; total_cost: number; }
interface OutcomeRow { id: string; label: string; pool_shares: number; is_winner: boolean | null; market_id: string; }
interface MarketRow { id: string; title: string; status: string; liquidity_param: number; total_volume: number; closes_at: string | null; }
interface PortfolioItem { market: MarketRow; outcome: OutcomeRow; position: PositionRow; currentPrice: number; currentValue: number; pnl: number; pnlPercent: number; }

const Wallet = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Profile state
  const [profile, setProfile] = useState<any>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  // Wallet state
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [walletAction, setWalletAction] = useState<"deposit" | "withdraw">("deposit");

  // Portfolio state
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [posFilter, setPosFilter] = useState<"all" | "open" | "resolved">("all");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchAll();

    const channelName = `wallet-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "positions", filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "market_outcomes" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchAll = async () => {
    if (!user) return;

    const [walletRes, txRes, posRes, profileRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).single() as any,
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50) as any,
      supabase.from("positions").select("outcome_id, market_id, shares, avg_price, total_cost").eq("user_id", user.id).gt("shares", 0) as any,
      supabase.from("profiles").select("*").eq("id", user.id).single() as any,
    ]);

    if (walletRes.data) setWallet(walletRes.data);
    if (txRes.data) setTransactions(txRes.data);
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
      let currentValue = market.status === "resolved" ? (outcome.is_winner ? pos.shares : 0) : pos.shares * currentPrice;
      const pnl = currentValue - pos.total_cost;
      const pnlPercent = pos.total_cost > 0 ? (pnl / pos.total_cost) * 100 : 0;
      portfolio.push({ market, outcome, position: pos, currentPrice, currentValue, pnl, pnlPercent });
    }
    portfolio.sort((a, b) => b.currentValue - a.currentValue);
    setPortfolioItems(portfolio);
    setLoading(false);
  };

  const handleRefresh = useCallback(async () => { await fetchAll(); }, [user]);

  const handleDeposit = async () => {
    if (!user || !wallet || !amount || !phone) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 10) { toast({ title: "Minimum deposit is KES 10", variant: "destructive" }); return; }
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("mpesa-deposit", { body: { amount: numAmount, phone_number: phone } });
      if (error) throw error;
      toast({ title: "📱 STK Push sent!", description: "Check your phone to complete M-Pesa payment" });
      setAmount("");
      setTimeout(fetchAll, 5000); setTimeout(fetchAll, 15000); setTimeout(fetchAll, 30000);
    } catch (e: any) { toast({ title: "Deposit failed", description: e.message || "Try again", variant: "destructive" }); }
    setProcessing(false);
  };

  const handleWithdraw = async () => {
    if (!user || !wallet || !amount || !phone) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 10) { toast({ title: "Minimum withdrawal is KES 10", variant: "destructive" }); return; }
    if (numAmount > wallet.balance) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("mpesa-withdraw", { body: { amount: numAmount, phone_number: phone } });
      if (error) throw error;
      toast({ title: "💸 Withdrawal initiated!", description: "You'll receive M-Pesa shortly" });
      setAmount(""); fetchAll();
    } catch (e: any) { toast({ title: "Withdrawal failed", description: e.message || "Try again", variant: "destructive" }); }
    setProcessing(false);
  };

  // Helpers
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "deposit": return <ArrowDownLeft className="h-4 w-4 text-primary" />;
      case "withdrawal": return <ArrowUpRight className="h-4 w-4 text-destructive" />;
      case "bet_win": return <TrendingUp className="h-4 w-4 text-primary" />;
      case "bet_stake": return <TrendingDown className="h-4 w-4 text-accent" />;
      case "bet_refund": return <ArrowDownLeft className="h-4 w-4 text-accent" />;
      default: return <WalletIcon className="h-4 w-4 text-muted-foreground" />;
    }
  };
  const getTypeLabel = (type: string) => ({ deposit: "Deposit", withdrawal: "Withdrawal", bet_stake: "Bet Placed", bet_win: "Bet Won", bet_refund: "Bet Refund", house_fee: "House Fee" }[type] || type);
  const getStatusBadge = (status: string) => ({ completed: "bg-primary/20 text-primary", pending: "bg-accent/20 text-accent", failed: "bg-destructive/20 text-destructive", cancelled: "bg-muted text-muted-foreground" }[status] || "bg-muted text-muted-foreground");

  const quickAmounts = [50, 100, 500, 1000, 5000];

  // Portfolio computed
  const filteredPositions = useMemo(() => {
    if (posFilter === "all") return portfolioItems;
    return portfolioItems.filter(i => posFilter === "open" ? i.market.status === "open" : i.market.status === "resolved");
  }, [portfolioItems, posFilter]);

  const totalInvested = portfolioItems.reduce((s, i) => s + i.position.total_cost, 0);
  const totalValue = portfolioItems.reduce((s, i) => s + i.currentValue, 0);
  const totalPnl = totalValue - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const openPositions = portfolioItems.filter(i => i.market.status === "open").length;
  const resolvedPositions = portfolioItems.filter(i => i.market.status === "resolved").length;

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
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero header */}
      <div className="relative border-b border-border/30 overflow-hidden">
        <Aurora />
        <div className="relative container py-6 sm:py-8">
          {/* Profile row */}
          {profile && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 mb-4"
            >
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
                  <span className="text-[10px] text-muted-foreground">
                    {profile.accuracy_rate}% accuracy
                  </span>
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

      <PullToRefresh onRefresh={handleRefresh} className="container py-6">
        {loading ? (
          <WalletSkeleton />
        ) : (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* LEFT: Balance + P&L cards + Positions */}
            <div className="lg:col-span-3 space-y-5">

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              >
                {[
                  { label: "Balance", value: wallet?.balance || 0, icon: WalletIcon, color: "text-primary", suffix: " KES" },
                  { label: "Portfolio", value: totalValue, icon: PieChart, color: "text-accent", suffix: " KES" },
                  { label: "P&L", value: totalPnl, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, color: totalPnl >= 0 ? "text-primary" : "text-destructive", prefix: totalPnl >= 0 ? "+" : "", suffix: " KES" },
                  { label: "Positions", value: portfolioItems.length, icon: Activity, color: "text-foreground", suffix: "" },
                ].map(({ label, value, icon: Icon, color, prefix, suffix }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
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
                      </CardContent>
                    </SpotlightCard>
                  </motion.div>
                ))}
              </motion.div>

              {/* Positions */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg font-bold tracking-wider">POSITIONS</h2>
                  <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30">
                    {([
                      { key: "all" as const, label: "All", count: portfolioItems.length },
                      { key: "open" as const, label: "Open", count: openPositions },
                      { key: "resolved" as const, label: "Done", count: resolvedPositions },
                    ]).map(({ key, label, count }) => (
                      <button
                        key={key}
                        onClick={() => setPosFilter(key)}
                        className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                          posFilter === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {posFilter === key && (
                          <motion.div layoutId="pos-filter-bg" className="absolute inset-0 bg-primary rounded-lg shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                        )}
                        <span className="relative z-10">{label}{count > 0 && ` (${count})`}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {filteredPositions.length === 0 ? (
                  <SpotlightCard className="p-10 text-center" spotlightColor="rgba(120, 255, 120, 0.05)">
                    <PieChart className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                    <p className="text-muted-foreground font-display text-sm">
                      {portfolioItems.length === 0 ? "No positions yet" : "No positions match this filter"}
                    </p>
                    {portfolioItems.length === 0 && (
                      <Link to="/" className="text-primary hover:underline text-xs mt-2 inline-block">Browse Markets</Link>
                    )}
                  </SpotlightCard>
                ) : (
                  <div className="space-y-2">
                    {filteredPositions.map((item, i) => {
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
                          <Link to={`/market/${item.market.id}`}>
                            <div className={`rounded-xl border p-3.5 transition-all hover:shadow-sm group ${
                              isWin ? "border-primary/30 bg-primary/5 hover:border-primary/50" :
                              isLoss ? "border-destructive/20 bg-destructive/5 opacity-70" :
                              "border-border/30 bg-card/50 hover:bg-card hover:border-primary/20"
                            }`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                      item.market.status === "open" ? "bg-primary/20 text-primary" :
                                      item.market.status === "resolved" ? "bg-muted text-muted-foreground" :
                                      "bg-accent/20 text-accent"
                                    }`}>
                                      {item.market.status.toUpperCase()}
                                    </span>
                                    {isWin && <Badge variant="outline" className="text-[9px] border-primary/30 text-primary gap-1 px-1.5 py-0"><ArrowUpRight className="h-2.5 w-2.5" /> Won</Badge>}
                                    {isLoss && <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive gap-1 px-1.5 py-0"><ArrowDownLeft className="h-2.5 w-2.5" /> Lost</Badge>}
                                  </div>
                                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{item.market.title}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {item.position.shares} shares of <span className="font-semibold text-foreground">{item.outcome.label}</span>
                                    {item.market.status === "open" && <span className="ml-2 text-primary font-bold">{pct}c</span>}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="font-display text-base font-bold tabular-nums">
                                    <AnimatedCounter value={Math.round(item.currentValue)} fontSize={16} duration={0.6} />
                                    <span className="text-[10px] text-muted-foreground ml-0.5">KES</span>
                                  </div>
                                  <div className={`text-xs font-bold tabular-nums ${item.pnl >= 0 ? "text-primary" : "text-destructive"}`}>
                                    {item.pnl >= 0 ? "+" : ""}{item.pnl.toFixed(1)}
                                    <span className="text-[10px] ml-0.5 opacity-70">({item.pnlPercent >= 0 ? "+" : ""}{item.pnlPercent.toFixed(0)}%)</span>
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
              </motion.div>
            </div>

            {/* RIGHT: Deposit/Withdraw + History */}
            <div className="lg:col-span-2 space-y-5">
              {/* Deposit / Withdraw */}
              <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.1)">
                  <CardContent className="p-5 space-y-4">
                    {/* Toggle deposit/withdraw */}
                    <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30">
                      {([
                        { key: "deposit" as const, label: "💰 Deposit" },
                        { key: "withdraw" as const, label: "💸 Withdraw" },
                      ]).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setWalletAction(key)}
                          className={`relative flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                            walletAction === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {walletAction === key && (
                            <motion.div layoutId="wallet-action-bg" className="absolute inset-0 bg-primary rounded-lg" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                          )}
                          <span className="relative z-10">{label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="254712345678" className="pl-10 font-display" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">Amount (KES)</label>
                      <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" min={10} className="text-center font-display text-xl font-bold h-12" />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {quickAmounts.map((qa) => (
                        <motion.button key={qa} whileTap={{ scale: 0.95 }} onClick={() => setAmount(String(qa))}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                            amount === String(qa) ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          {qa.toLocaleString()}
                        </motion.button>
                      ))}
                    </div>

                    {walletAction === "withdraw" && wallet && (
                      <p className="text-xs text-muted-foreground">Available: <span className="text-primary font-bold">KES {wallet.balance.toLocaleString()}</span></p>
                    )}

                    <Button
                      onClick={walletAction === "deposit" ? handleDeposit : handleWithdraw}
                      disabled={processing || !amount || !phone}
                      className={`w-full h-11 text-sm font-display tracking-wider ${
                        walletAction === "deposit" ? "neon-glow" : "neon-glow-accent bg-accent text-accent-foreground hover:bg-accent/90"
                      }`}
                    >
                      {processing ? "Processing..." : walletAction === "deposit" ? `💰 Deposit KES ${amount || "0"}` : `💸 Withdraw KES ${amount || "0"}`}
                    </Button>
                  </CardContent>
                </SpotlightCard>
              </motion.div>

              {/* Transaction history */}
              <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                <h2 className="font-display text-sm font-bold tracking-wider text-muted-foreground uppercase mb-3 flex items-center gap-2">
                  <History className="h-3.5 w-3.5" /> Recent Transactions
                </h2>
                {transactions.length === 0 ? (
                  <SpotlightCard className="p-8 text-center" spotlightColor="rgba(120, 255, 120, 0.05)">
                    <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground font-display">No transactions yet</p>
                  </SpotlightCard>
                ) : (
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                    {transactions.slice(0, 20).map((tx, i) => (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                      >
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/20 bg-card/30 hover:bg-card/60 transition-colors">
                          <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                            {getTypeIcon(tx.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold">{getTypeLabel(tx.type)}</p>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getStatusBadge(tx.status)}`}>{tx.status}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {tx.description || tx.mpesa_receipt || format(new Date(tx.created_at), "MMM d, HH:mm")}
                            </p>
                          </div>
                          <p className={`font-display font-bold text-xs ${
                            ["deposit", "bet_win", "bet_refund"].includes(tx.type) ? "text-primary" : "text-destructive"
                          }`}>
                            {["deposit", "bet_win", "bet_refund"].includes(tx.type) ? "+" : "-"}{Math.abs(tx.amount).toLocaleString()}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </PullToRefresh>
      <Footer />
    </div>
  );
};

export default Wallet;
