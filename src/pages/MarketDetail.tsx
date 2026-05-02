import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import MarketDetailSkeleton from "@/components/skeletons/MarketDetailSkeleton";
import {
  ArrowUpRight, ArrowDownLeft, BarChart3, Clock, TrendingUp,
  MessageCircle, Calendar, Info, Layers, Share2, CheckCircle2,
  Users, ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import TeamBadge from "@/components/TeamBadge";
import { lmsrPrice } from "@/lib/pricing";
import PriceChart from "@/components/PriceChart";
import TradePanel from "@/components/markets/TradePanel";
import TrendSummary from "@/components/markets/TrendSummary";
import CommentThread from "@/components/markets/CommentThread";

interface MarketOutcome {
  id: string; label: string; pool_shares: number; is_winner: boolean | null; sort_order: number;
}
interface MarketData {
  id: string; match_id: string | null; title: string; description: string | null;
  category: string; status: string; liquidity_param: number; total_volume: number;
  closes_at: string | null; created_at: string; resolved_at: string | null;
  matches?: { home_team: string; away_team: string; league: string; kickoff: string; home_score: number | null; away_score: number | null; };
}
interface Position { outcome_id: string; shares: number; avg_price: number; total_cost: number; }
interface Trade {
  id: string; user_id: string; outcome_id: string; side: string; shares: number;
  price_per_share: number; total_cost: number; created_at: string;
  profiles?: { username: string | null };
}
interface Comment {
  id: string; user_id: string; content: string; parent_id: string | null; created_at: string;
  profiles?: { username: string | null; avatar_url: string | null };
}
interface RelatedMarket { id: string; title: string; status: string; total_volume: number; category: string; }
type TabKey = "discussion" | "activity" | "related" | "info";

const tabConfig: { key: TabKey; label: string; icon: typeof MessageCircle }[] = [
  { key: "discussion", label: "Discussion", icon: MessageCircle },
  { key: "activity", label: "Activity", icon: TrendingUp },
  { key: "related", label: "Related", icon: Layers },
  { key: "info", label: "Info", icon: Info },
];

const MarketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [market, setMarket] = useState<MarketData | null>(null);
  const [outcomes, setOutcomes] = useState<MarketOutcome[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [relatedMarkets, setRelatedMarkets] = useState<RelatedMarket[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("discussion");

  useEffect(() => {
    if (!id) return;
    fetchAll();
    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedFetchAll = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => fetchAll(), 300); };
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel(`market-${id}-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "market_outcomes", filter: `market_id=eq.${id}` }, () => debouncedFetchAll())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "trades", filter: `market_id=eq.${id}` }, () => debouncedFetchAll())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "market_comments", filter: `market_id=eq.${id}` }, () => fetchComments())
        .subscribe();
    } catch (e) { console.warn("[realtime] MarketDetail channel setup failed:", e); }
    return () => { clearTimeout(debounceTimer); if (channel) supabase.removeChannel(channel); };
  }, [id, user]);

  const fetchAll = async () => {
    const [mRes, oRes, tRes] = await Promise.all([
      supabase.from("markets").select("*, matches(home_team, away_team, league, kickoff, home_score, away_score)").eq("id", id!).single() as any,
      supabase.from("market_outcomes").select("*").eq("market_id", id!).order("sort_order") as any,
      supabase.from("trades").select("*, profiles:user_id(username)").eq("market_id", id!).order("created_at", { ascending: false }).limit(30) as any,
    ]);
    if (mRes.data) {
      setMarket(mRes.data);
      if (mRes.data.match_id) {
        const relRes = await supabase.from("markets").select("id, title, status, total_volume, category").eq("match_id", mRes.data.match_id).neq("id", id!).limit(10) as any;
        if (relRes.data) setRelatedMarkets(relRes.data);
      }
    }
    if (oRes.data) { setOutcomes(oRes.data); if (!selectedOutcome && oRes.data.length > 0) setSelectedOutcome(oRes.data[0].id); }
    if (tRes.data) setTrades(tRes.data);
    if (user) {
      const [posRes, walletRes] = await Promise.all([
        supabase.from("positions").select("outcome_id, shares, avg_price, total_cost").eq("market_id", id!).eq("user_id", user.id) as any,
        supabase.from("wallets").select("balance").eq("user_id", user.id).single() as any,
      ]);
      if (posRes.data) setPositions(posRes.data);
      if (walletRes.data) setWalletBalance(walletRes.data.balance);
    }
    await fetchComments();
    setLoading(false);
  };

  const fetchComments = async () => {
    const { data } = await supabase.from("market_comments").select("*, profiles:user_id(username, avatar_url)").eq("market_id", id!).order("created_at", { ascending: true }).limit(100) as any;
    if (data) setComments(data);
  };

  const pools = outcomes.map(o => Number(o.pool_shares));
  const b = market ? Number(market.liquidity_param) : 100;
  const prices = outcomes.map((_, i) => lmsrPrice(pools, i, b));
  const uniqueTraders = new Set(trades.map(t => t.user_id)).size;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied!" });
  };

  if (loading) return (<div className="min-h-screen bg-background"><Navbar /><div className="container py-8"><MarketDetailSkeleton /></div></div>);
  if (!market) return (<div className="min-h-screen bg-background"><Navbar /><div className="container py-20 text-center text-muted-foreground">Market not found.</div></div>);

  const timeLeft = market.closes_at ? formatDistanceToNow(new Date(market.closes_at), { addSuffix: true }) : null;

  // JSON-LD for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: market.title,
    description: market.description || `Prediction market on ${market.title}`,
    startDate: market.created_at,
    endDate: market.closes_at || undefined,
    eventStatus: market.status === "open" ? "https://schema.org/EventScheduled" : "https://schema.org/EventCancelled",
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEOHead
        title={market.title}
        description={market.description || `Trade on "${market.title}" — ${Math.round(market.total_volume)} KES volume`}
        path={`/market/${market.id}`}
        jsonLd={jsonLd}
      />
      <Navbar />

      {/* Market header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="border-b border-border/30 bg-card/30 backdrop-blur-sm">
        <div className="container py-6 max-w-4xl">
          <div className="flex items-center gap-3 mb-3">
            {market.matches && (
              <motion.div className="flex items-center gap-2" initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                <TeamBadge teamName={market.matches.home_team} size="md" />
                <span className="text-xs text-muted-foreground font-display">VS</span>
                <TeamBadge teamName={market.matches.away_team} size="md" />
              </motion.div>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              market.status === "open" ? "bg-primary/20 text-primary animate-pulse" :
              market.status === "resolved" ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
            }`}>
              {market.status === "resolved" ? "🦅 LANDED" : market.status.toUpperCase()}
            </span>
            <button onClick={handleCopyLink} className="ml-auto p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground" title="Copy link">
              {copied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Share2 className="h-4 w-4" />}
            </button>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wider text-foreground">{market.title}</h1>
          {market.description && <p className="text-sm text-muted-foreground mt-1">{market.description}</p>}
          <div className="mt-3"><TrendSummary marketId={market.id} /></div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
              <BarChart3 className="h-3 w-3 text-primary" /><span className="font-bold text-foreground">{Math.round(market.total_volume).toLocaleString()}</span> KES
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
              <Users className="h-3 w-3 text-accent" /><span className="font-bold text-foreground">{uniqueTraders}</span> traders
            </div>
            {timeLeft && market.status === "open" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
                <Clock className="h-3 w-3" />Closes {timeLeft}
              </div>
            )}
            {market.matches && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
                <Calendar className="h-3 w-3" />{format(new Date(market.matches.kickoff), "MMM d, HH:mm")}
              </div>
            )}
            {market.matches?.league && <Badge variant="outline" className="text-[10px] border-border/50">{market.matches.league}</Badge>}
          </div>
        </div>
      </motion.div>

      <div className="container py-6 max-w-4xl">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-5">
            {/* Outcomes */}
            <div className="space-y-2">
              {outcomes.map((outcome, i) => {
                const pct = Math.round(prices[i] * 100);
                const isSelected = outcome.id === selectedOutcome;
                const isWinner = outcome.is_winner === true;
                const pos = positions.find(p => p.outcome_id === outcome.id);
                return (
                  <motion.button key={outcome.id} onClick={() => setSelectedOutcome(outcome.id)} className="w-full text-left" whileTap={{ scale: 0.99 }} whileHover={{ scale: 1.005 }}>
                    <div className={`relative flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-200 ${
                      isSelected ? "border-primary/50 bg-card shadow-sm shadow-primary/5" :
                      isWinner ? "border-primary/30 bg-primary/5" : "border-border/30 bg-card/50 hover:bg-card hover:border-border/50"
                    }`}>
                      <motion.div className={`absolute left-0 top-0 bottom-0 rounded-xl ${isWinner ? "bg-primary/10" : "bg-primary/5"}`} initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 100, damping: 20 }} />
                      <div className="relative z-10 flex items-center gap-2">
                        <span className={`font-display text-sm font-bold ${isWinner ? "text-primary" : ""}`}>
                          {outcome.label} {isWinner && <CheckCircle2 className="inline h-3.5 w-3.5 ml-1 text-primary" />}
                        </span>
                        {pos && pos.shares > 0 && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {pos.shares} shares
                          </motion.span>
                        )}
                      </div>
                      <span className={`relative z-10 font-display text-lg font-bold tabular-nums ${pct > 50 ? "text-primary" : "text-muted-foreground"}`}>{pct}¢</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <PriceChart trades={trades} outcomes={outcomes} liquidityParam={b} marketCreatedAt={market.created_at} />

            {/* Tabs */}
            <div>
              <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30 w-fit mb-4 overflow-x-auto">
                {tabConfig.map(({ key, label, icon: Icon }) => {
                  const count = key === "discussion" ? comments.length : key === "activity" ? trades.length : key === "related" ? relatedMarkets.length : 0;
                  return (
                    <button key={key} onClick={() => setActiveTab(key)} className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap min-h-[44px] ${activeTab === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      {activeTab === key && <motion.div layoutId="market-tab-bg" className="absolute inset-0 bg-primary rounded-lg shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                      <span className="relative z-10 flex items-center gap-1.5"><Icon className="h-3 w-3" />{label}{count > 0 && <span className="text-[9px] opacity-70 tabular-nums">({count})</span>}</span>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === "discussion" && (
                  <motion.div key="discussion" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
                    <CommentThread marketId={id!} comments={comments} onRefresh={fetchComments} />
                  </motion.div>
                )}

                {activeTab === "activity" && (
                  <motion.div key="activity" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
                    {trades.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground"><TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-20" /><p className="text-sm">No trades yet</p></div>
                    ) : (
                      <div className="space-y-1.5 max-h-[28rem] overflow-y-auto pr-1 scrollbar-thin">
                        {trades.map((trade, i) => {
                          const outcome = outcomes.find(o => o.id === trade.outcome_id);
                          return (
                            <motion.div key={trade.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg bg-muted/20 border border-border/20 hover:bg-muted/30 transition-colors">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${trade.side === "buy" ? "bg-primary/10" : "bg-destructive/10"}`}>
                                {trade.side === "buy" ? <ArrowUpRight className="h-3 w-3 text-primary" /> : <ArrowDownLeft className="h-3 w-3 text-destructive" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Link to={`/profile/${trade.user_id}`} className="font-medium hover:text-primary truncate">@{(trade.profiles as any)?.username || "anon"}</Link>
                                  <span className="text-muted-foreground">{trade.side === "buy" ? "bought" : "sold"} <strong>{trade.shares}</strong></span>
                                  <span className="font-semibold truncate">{outcome?.label}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}</span>
                              </div>
                              <span className="text-muted-foreground font-bold tabular-nums flex-shrink-0">{trade.total_cost.toFixed(1)} KES</span>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "related" && (
                  <motion.div key="related" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
                    {relatedMarkets.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground"><Layers className="mx-auto mb-2 h-8 w-8 opacity-20" /><p className="text-sm">No related markets</p></div>
                    ) : (
                      <div className="space-y-2">
                        {relatedMarkets.map((rm, i) => (
                          <motion.div key={rm.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                            <Link to={`/market/${rm.id}`} className="flex items-center gap-3 p-3.5 rounded-xl border border-border/30 bg-card/50 hover:bg-card hover:border-primary/20 transition-all group">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><BarChart3 className="h-4 w-4 text-primary" /></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{rm.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">{rm.category === "match_result" ? "Result" : "Over/Under"}</Badge>
                                  <span className="text-[10px] text-muted-foreground">{Math.round(rm.total_volume)} KES</span>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "info" && (
                  <motion.div key="info" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }} className="space-y-4">
                    <div className="rounded-xl border border-border/30 bg-card/50 overflow-hidden">
                      <div className="px-4 py-3 bg-muted/30 border-b border-border/20"><h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Market Details</h4></div>
                      <div className="divide-y divide-border/20">
                        {[
                          { label: "Category", value: market.category === "match_result" ? "Match Result" : "Over/Under" },
                          { label: "Status", value: market.status === "resolved" ? "🦅 Eagle Has Landed" : market.status.charAt(0).toUpperCase() + market.status.slice(1), highlight: market.status === "open" },
                          { label: "Created", value: format(new Date(market.created_at), "MMM d, yyyy HH:mm") },
                          { label: "Closes", value: market.closes_at ? format(new Date(market.closes_at), "MMM d, yyyy HH:mm") : "—" },
                          { label: "Total Volume", value: `${Math.round(market.total_volume).toLocaleString()} KES` },
                          { label: "Liquidity", value: `b = ${market.liquidity_param}` },
                          { label: "Unique Traders", value: String(uniqueTraders) },
                        ].map(({ label, value, highlight }) => (
                          <div key={label} className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <span className={`text-xs font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Trade panel */}
          <div className="lg:col-span-2">
            <div className="sticky top-20 space-y-4">
              <TradePanel
                marketId={id!}
                marketStatus={market.status}
                outcomes={outcomes}
                positions={positions}
                selectedOutcome={selectedOutcome}
                walletBalance={walletBalance}
                liquidityParam={b}
                prices={prices}
                onTradeComplete={fetchAll}
                matchScore={market.matches ? { home: market.matches.home_score, away: market.matches.away_score } : null}
              />

              {/* My positions */}
              {positions.filter(p => p.shares > 0).length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <h3 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Your Positions</h3>
                  <div className="space-y-1.5">
                    {positions.filter(p => p.shares > 0).map(pos => {
                      const outcome = outcomes.find(o => o.id === pos.outcome_id);
                      const idx = outcomes.indexOf(outcome!);
                      const currentPrice = idx >= 0 ? prices[idx] : 0;
                      const pnl = (pos.shares * currentPrice) - pos.total_cost;
                      return (
                        <div key={pos.outcome_id} className="rounded-lg bg-muted/20 border border-border/20 p-3">
                          <div className="flex justify-between text-xs"><span className="font-semibold">{outcome?.label}</span><span className="font-bold tabular-nums">{pos.shares} shares</span></div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>Avg: {pos.avg_price.toFixed(2)} KES</span>
                            <span className={`font-bold ${pnl >= 0 ? "text-primary" : "text-destructive"}`}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(1)} KES</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MarketDetail;