import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import MarketDetailSkeleton from "@/components/skeletons/MarketDetailSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowUpRight, ArrowDownLeft, BarChart3, Clock, TrendingUp,
  Wallet, MessageCircle, Send, Trash2, Calendar,
  Info, Layers, Share2, CheckCircle2, AlertCircle,
  Users, ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import TeamBadge from "@/components/TeamBadge";
import { lmsrPrice } from "@/components/MarketCard";
import PriceChart from "@/components/PriceChart";

interface MarketOutcome {
  id: string;
  label: string;
  pool_shares: number;
  is_winner: boolean | null;
  sort_order: number;
}

interface MarketData {
  id: string;
  match_id: string | null;
  title: string;
  description: string | null;
  category: string;
  status: string;
  liquidity_param: number;
  total_volume: number;
  closes_at: string | null;
  created_at: string;
  resolved_at: string | null;
  matches?: {
    home_team: string; away_team: string; league: string;
    kickoff: string; home_score: number | null; away_score: number | null;
  };
}

interface Position {
  outcome_id: string;
  shares: number;
  avg_price: number;
  total_cost: number;
}

interface Trade {
  id: string;
  user_id: string;
  outcome_id: string;
  side: string;
  shares: number;
  price_per_share: number;
  total_cost: number;
  created_at: string;
  profiles?: { username: string | null };
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  profiles?: { username: string | null; avatar_url: string | null };
}

interface RelatedMarket {
  id: string;
  title: string;
  status: string;
  total_volume: number;
  category: string;
}

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
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState("");
  const [executing, setExecuting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("discussion");

  useEffect(() => {
    if (!id) return;
    fetchAll();

    const channel = supabase
      .channel(`market-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_outcomes", filter: `market_id=eq.${id}` }, () => fetchAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trades", filter: `market_id=eq.${id}` }, () => fetchAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "market_comments", filter: `market_id=eq.${id}` }, () => fetchComments())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
        const relatedRes = await supabase.from("markets").select("id, title, status, total_volume, category").eq("match_id", mRes.data.match_id).neq("id", id!).limit(10) as any;
        if (relatedRes.data) setRelatedMarkets(relatedRes.data);
      }
    }
    if (oRes.data) {
      setOutcomes(oRes.data);
      if (!selectedOutcome && oRes.data.length > 0) setSelectedOutcome(oRes.data[0].id);
    }
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
    const { data } = await supabase
      .from("market_comments")
      .select("*, profiles:user_id(username, avatar_url)")
      .eq("market_id", id!)
      .order("created_at", { ascending: true })
      .limit(100) as any;
    if (data) setComments(data);
  };

  const pools = outcomes.map(o => Number(o.pool_shares));
  const b = market ? Number(market.liquidity_param) : 100;
  const prices = outcomes.map((_, i) => lmsrPrice(pools, i, b));

  const numShares = parseFloat(shares) || 0;
  const selectedIdx = outcomes.findIndex(o => o.id === selectedOutcome);
  let estimatedCost = 0;
  if (numShares > 0 && selectedIdx >= 0) {
    if (side === "buy") {
      const exps = pools.map(q => Math.exp(q / b));
      const costBefore = b * Math.log(exps.reduce((s, e) => s + e, 0));
      const newPools = [...pools];
      newPools[selectedIdx] += numShares;
      const newExps = newPools.map(q => Math.exp(q / b));
      const costAfter = b * Math.log(newExps.reduce((s, e) => s + e, 0));
      estimatedCost = costAfter - costBefore;
    } else {
      const pos = positions.find(p => p.outcome_id === selectedOutcome);
      if (pos && pos.shares >= numShares) {
        const exps = pools.map(q => Math.exp(q / b));
        const costBefore = b * Math.log(exps.reduce((s, e) => s + e, 0));
        const newPools = [...pools];
        newPools[selectedIdx] -= numShares;
        const newExps = newPools.map(q => Math.exp(q / b));
        const costAfter = b * Math.log(newExps.reduce((s, e) => s + e, 0));
        estimatedCost = costBefore - costAfter;
      }
    }
  }

  const handleTrade = async () => {
    if (!user || !selectedOutcome || numShares <= 0) return;
    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke("execute-trade", {
        body: { market_id: id, outcome_id: selectedOutcome, side, shares: numShares },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: side === "buy" ? "Shares bought!" : "Shares sold!",
        description: `${numShares} shares at KES ${data.price_per_share?.toFixed(2)} each`,
      });
      setShares("");
      fetchAll();
    } catch (e: any) {
      toast({ title: "Trade failed", description: e.message, variant: "destructive" });
    }
    setExecuting(false);
  };

  const handlePostComment = async () => {
    if (!user || !commentText.trim()) return;
    setPostingComment(true);
    const { error } = await supabase.from("market_comments").insert({
      market_id: id!,
      user_id: user.id,
      content: commentText.trim(),
    });
    if (error) {
      toast({ title: "Failed to post", description: error.message, variant: "destructive" });
    } else {
      setCommentText("");
      fetchComments();
    }
    setPostingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from("market_comments").delete().eq("id", commentId);
    fetchComments();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied!" });
  };

  const uniqueTraders = new Set(trades.map(t => t.user_id)).size;

  if (loading) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <MarketDetailSkeleton />
      </div>
    </div>
  );

  if (!market) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-20 text-center text-muted-foreground">Market not found.</div>
    </div>
  );

  const myPosition = positions.find(p => p.outcome_id === selectedOutcome);
  const timeLeft = market.closes_at ? formatDistanceToNow(new Date(market.closes_at), { addSuffix: true }) : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Market header with enhanced polish */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border/30 bg-card/30 backdrop-blur-sm"
      >
        <div className="container py-6 max-w-4xl">
          <div className="flex items-center gap-3 mb-3">
            {market.matches && (
              <motion.div
                className="flex items-center gap-2"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <TeamBadge teamName={market.matches.home_team} size="md" />
                <span className="text-xs text-muted-foreground font-display">VS</span>
                <TeamBadge teamName={market.matches.away_team} size="md" />
              </motion.div>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              market.status === "open" ? "bg-primary/20 text-primary animate-pulse" :
              market.status === "resolved" ? "bg-accent/20 text-accent" :
              "bg-muted text-muted-foreground"
            }`}>
              {market.status === "open" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1.5" />}
              {market.status.toUpperCase()}
            </span>
            <button
              onClick={handleCopyLink}
              className="ml-auto p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
              title="Copy link"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Share2 className="h-4 w-4" />}
            </button>
          </div>

          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wider text-foreground">
            {market.title}
          </h1>
          {market.description && (
            <p className="text-sm text-muted-foreground mt-1">{market.description}</p>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
              <BarChart3 className="h-3 w-3 text-primary" />
              <span className="font-bold text-foreground">{Math.round(market.total_volume).toLocaleString()}</span> KES
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
              <Users className="h-3 w-3 text-accent" />
              <span className="font-bold text-foreground">{uniqueTraders}</span> traders
            </div>
            {timeLeft && market.status === "open" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
                <Clock className="h-3 w-3" />
                Closes {timeLeft}
              </div>
            )}
            {market.matches && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
                <Calendar className="h-3 w-3" />
                {format(new Date(market.matches.kickoff), "MMM d, HH:mm")}
              </div>
            )}
            {market.matches?.league && (
              <Badge variant="outline" className="text-[10px] border-border/50">
                {market.matches.league}
              </Badge>
            )}
          </div>
        </div>
      </motion.div>

      <div className="container py-6 max-w-4xl">
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Main content */}
          <div className="lg:col-span-3 space-y-5">
            {/* Outcome prices with hover effects */}
            <div className="space-y-2">
              {outcomes.map((outcome, i) => {
                const pct = Math.round(prices[i] * 100);
                const isSelected = outcome.id === selectedOutcome;
                const isWinner = outcome.is_winner === true;
                const pos = positions.find(p => p.outcome_id === outcome.id);

                return (
                  <motion.button
                    key={outcome.id}
                    onClick={() => setSelectedOutcome(outcome.id)}
                    className="w-full text-left"
                    whileTap={{ scale: 0.99 }}
                    whileHover={{ scale: 1.005 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <div className={`relative flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-200 ${
                      isSelected ? "border-primary/50 bg-card shadow-sm shadow-primary/5" :
                      isWinner ? "border-primary/30 bg-primary/5" :
                      "border-border/30 bg-card/50 hover:bg-card hover:border-border/50"
                    }`}>
                      <motion.div
                        className={`absolute left-0 top-0 bottom-0 rounded-xl ${isWinner ? "bg-primary/10" : "bg-primary/5"}`}
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: "spring", stiffness: 100, damping: 20 }}
                      />
                      <div className="relative z-10 flex items-center gap-2">
                        <span className={`font-display text-sm font-bold ${isWinner ? "text-primary" : ""}`}>
                          {outcome.label} {isWinner && <CheckCircle2 className="inline h-3.5 w-3.5 ml-1 text-primary" />}
                        </span>
                        {pos && pos.shares > 0 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                          >
                            {pos.shares} shares
                          </motion.span>
                        )}
                      </div>
                      <div className="relative z-10 flex items-center gap-3">
                        <span className={`font-display text-lg font-bold tabular-nums ${pct > 50 ? "text-primary" : "text-muted-foreground"}`}>
                          {pct}¢
                        </span>
                        {market.status === "open" && (
                          <div className="flex gap-1">
                            <span
                              onClick={(e) => { e.stopPropagation(); setSelectedOutcome(outcome.id); setSide("buy"); }}
                              className="px-2.5 py-1 text-[10px] font-semibold rounded-md bg-primary/10 text-primary border border-primary/20 cursor-pointer hover:bg-primary/20 hover:shadow-sm transition-all"
                            >
                              Buy
                            </span>
                            {pos && pos.shares > 0 && (
                              <span
                                onClick={(e) => { e.stopPropagation(); setSelectedOutcome(outcome.id); setSide("sell"); }}
                                className="px-2.5 py-1 text-[10px] font-semibold rounded-md bg-destructive/10 text-destructive border border-destructive/20 cursor-pointer hover:bg-destructive/20 hover:shadow-sm transition-all"
                              >
                                Sell
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Price chart */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <PriceChart
                trades={trades}
                outcomes={outcomes}
                liquidityParam={b}
                marketCreatedAt={market.created_at}
              />
            </motion.div>




            {/* Enhanced Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30 w-fit mb-4 overflow-x-auto">
                {tabConfig.map(({ key, label, icon: Icon }) => {
                  const count =
                    key === "discussion" ? comments.length :
                    key === "activity" ? trades.length :
                    key === "related" ? relatedMarkets.length : 0;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        activeTab === key
                          ? "text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {activeTab === key && (
                        <motion.div
                          layoutId="market-tab-bg"
                          className="absolute inset-0 bg-primary rounded-lg shadow-sm"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <Icon className="h-3 w-3" />
                        {label}
                        {count > 0 && (
                          <span className="text-[9px] opacity-70 tabular-nums">({count})</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {/* Discussion Tab */}
                {activeTab === "discussion" && (
                  <motion.div
                    key="discussion"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3"
                  >
                    {user ? (
                      <div className="flex gap-2">
                        <Textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Share your analysis or opinion..."
                          rows={2}
                          className="text-sm resize-none flex-1 transition-shadow focus:shadow-sm focus:shadow-primary/10"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handlePostComment();
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={handlePostComment}
                          disabled={postingComment || !commentText.trim()}
                          className="self-end neon-glow"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-3 text-sm text-muted-foreground rounded-lg border border-border/20 bg-muted/10">
                        <Link to="/auth" className="text-primary hover:underline font-medium">Sign in</Link> to join the discussion
                      </div>
                    )}

                    {comments.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-20" />
                        <p className="text-sm">No comments yet — be the first to share your take!</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1 scrollbar-thin">
                        {comments.map((comment, i) => (
                          <motion.div
                            key={comment.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="flex gap-2.5 p-3 rounded-lg bg-muted/20 border border-border/20 hover:bg-muted/30 transition-colors"
                          >
                            <Avatar className="h-7 w-7 flex-shrink-0 ring-1 ring-border/30">
                              <AvatarImage src={(comment.profiles as any)?.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px] bg-muted">
                                {((comment.profiles as any)?.username || "?")[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Link
                                  to={`/profile/${comment.user_id}`}
                                  className="text-xs font-semibold text-primary hover:underline"
                                >
                                  @{(comment.profiles as any)?.username || "anon"}
                                </Link>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                </span>
                                {user?.id === comment.user_id && (
                                  <button
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{comment.content}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Activity Tab */}
                {activeTab === "activity" && (
                  <motion.div
                    key="activity"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {trades.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-20" />
                        <p className="text-sm">No trades yet — be the first!</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[28rem] overflow-y-auto pr-1 scrollbar-thin">
                        {trades.map((trade, i) => {
                          const outcome = outcomes.find(o => o.id === trade.outcome_id);
                          return (
                            <motion.div
                              key={trade.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.02 }}
                              className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg bg-muted/20 border border-border/20 hover:bg-muted/30 transition-colors"
                            >
                              {trade.side === "buy" ? (
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <ArrowUpRight className="h-3 w-3 text-primary" />
                                </div>
                              ) : (
                                <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                                  <ArrowDownLeft className="h-3 w-3 text-destructive" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Link to={`/profile/${trade.user_id}`} className="font-medium hover:text-primary transition-colors truncate">
                                    @{(trade.profiles as any)?.username || "anon"}
                                  </Link>
                                  <span className="text-muted-foreground">
                                    {trade.side === "buy" ? "bought" : "sold"} <strong>{trade.shares}</strong>
                                  </span>
                                  <span className="font-semibold truncate">{outcome?.label}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <span className="text-muted-foreground font-bold tabular-nums flex-shrink-0">
                                {trade.total_cost.toFixed(1)} KES
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Related Markets Tab */}
                {activeTab === "related" && (
                  <motion.div
                    key="related"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {relatedMarkets.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <Layers className="mx-auto mb-2 h-8 w-8 opacity-20" />
                        <p className="text-sm">No related markets for this match</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {relatedMarkets.map((rm, i) => (
                          <motion.div
                            key={rm.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                          >
                            <Link
                              to={`/market/${rm.id}`}
                              className="flex items-center gap-3 p-3.5 rounded-xl border border-border/30 bg-card/50 hover:bg-card hover:border-primary/20 hover:shadow-sm transition-all group"
                            >
                              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                                <BarChart3 className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                  {rm.title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                    {rm.category === "match_result" ? "Result" : "Over/Under"}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">{Math.round(rm.total_volume)} KES</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  rm.status === "open" ? "bg-primary/20 text-primary" :
                                  rm.status === "resolved" ? "bg-accent/20 text-accent" :
                                  "bg-muted text-muted-foreground"
                                }`}>
                                  {rm.status.toUpperCase()}
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Market Info Tab */}
                {activeTab === "info" && (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <div className="rounded-xl border border-border/30 bg-card/50 overflow-hidden">
                      <div className="px-4 py-3 bg-muted/30 border-b border-border/20">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Market Details</h4>
                      </div>
                      <div className="divide-y divide-border/20">
                        {[
                          { label: "Market ID", value: market.id.slice(0, 12) + "…" },
                          { label: "Category", value: market.category === "match_result" ? "Match Result" : "Over/Under" },
                          { label: "Status", value: market.status.charAt(0).toUpperCase() + market.status.slice(1), highlight: market.status === "open" },
                          { label: "Created", value: format(new Date(market.created_at), "MMM d, yyyy HH:mm") },
                          { label: "Closes", value: market.closes_at ? format(new Date(market.closes_at), "MMM d, yyyy HH:mm") : "—" },
                          ...(market.resolved_at ? [{ label: "Resolved", value: format(new Date(market.resolved_at), "MMM d, yyyy HH:mm") }] : []),
                          { label: "Total Volume", value: `${Math.round(market.total_volume).toLocaleString()} KES` },
                          { label: "Liquidity", value: `b = ${market.liquidity_param}` },
                          { label: "Unique Traders", value: String(uniqueTraders) },
                          { label: "Total Trades", value: String(trades.length) },
                          { label: "Comments", value: String(comments.length) },
                        ].map(({ label, value, highlight }) => (
                          <div key={label} className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <span className={`text-xs font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {market.matches && (
                      <div className="rounded-xl border border-border/30 bg-card/50 overflow-hidden">
                        <div className="px-4 py-3 bg-muted/30 border-b border-border/20">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Match Details</h4>
                        </div>
                        <div className="divide-y divide-border/20">
                          {[
                            { label: "Home", value: market.matches.home_team },
                            { label: "Away", value: market.matches.away_team },
                            { label: "League", value: market.matches.league },
                            { label: "Kickoff", value: format(new Date(market.matches.kickoff), "MMM d, yyyy HH:mm") },
                            ...(market.matches.home_score !== null ? [
                              { label: "Final Score", value: `${market.matches.home_score} - ${market.matches.away_score}`, highlight: true },
                            ] : []),
                          ].map(({ label, value, highlight }) => (
                            <div key={label} className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-xs text-muted-foreground">{label}</span>
                              <span className={`text-xs font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* How it works */}
                    <div className="rounded-xl border border-border/30 bg-card/50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">How It Works</h4>
                      </div>
                      <div className="space-y-2">
                        {[
                          "Prices reflect the market's estimated probability (0–100¢ = 0–100%).",
                          "Buy shares in the outcome you believe will win.",
                          "If correct, each share pays out 100 KES. If wrong, shares are worth 0.",
                          "Prices adjust automatically using the LMSR market maker.",
                          "You can sell shares anytime before the market resolves.",
                        ].map((text, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full h-4 w-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Trade panel */}
          <div className="lg:col-span-2">
            <div className="sticky top-20 space-y-4">
              {market.status === "open" ? (
                user ? (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.1)">
                      <CardContent className="p-4 space-y-4">
                        <h3 className="font-display text-sm font-bold tracking-wider flex items-center gap-2">
                          {side === "buy" ? (
                            <><ArrowUpRight className="h-4 w-4 text-primary" /> BUY SHARES</>
                          ) : (
                            <><ArrowDownLeft className="h-4 w-4 text-destructive" /> SELL SHARES</>
                          )}
                        </h3>

                        <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg">
                          {(["buy", "sell"] as const).map(s => (
                            <motion.button
                              key={s}
                              onClick={() => setSide(s)}
                              className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${
                                side === s
                                  ? s === "buy" ? "bg-primary text-primary-foreground shadow-sm" : "bg-destructive text-destructive-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              whileTap={{ scale: 0.97 }}
                            >
                              {s === "buy" ? "Buy" : "Sell"}
                            </motion.button>
                          ))}
                        </div>

                        {selectedOutcome && (
                          <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-2.5 border border-border/20">
                            Outcome: <span className="font-semibold text-foreground">{outcomes.find(o => o.id === selectedOutcome)?.label}</span>
                            <span className="ml-2 text-primary font-bold">{selectedIdx >= 0 ? Math.round(prices[selectedIdx] * 100) : 0}¢</span>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground font-medium">Shares</label>
                          <Input
                            type="number"
                            min={1}
                            value={shares}
                            onChange={(e) => setShares(e.target.value)}
                            placeholder="10"
                            className="text-center font-display text-lg font-bold transition-shadow focus:shadow-sm focus:shadow-primary/10"
                          />
                          <div className="flex gap-1">
                            {[10, 25, 50, 100].map(q => (
                              <motion.button
                                key={q}
                                onClick={() => setShares(String(q))}
                                whileTap={{ scale: 0.95 }}
                                className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold border transition-all ${
                                  shares === String(q)
                                    ? "border-primary text-primary bg-primary/10 shadow-sm"
                                    : "border-border text-muted-foreground hover:border-border/80"
                                }`}
                              >
                                {q}
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {numShares > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="rounded-lg bg-muted/30 p-3 space-y-1.5 border border-border/30"
                          >
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Avg price</span>
                              <span className="font-bold tabular-nums">{(estimatedCost / numShares).toFixed(2)} KES</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{side === "buy" ? "Total cost" : "You receive"}</span>
                              <span className="font-bold text-primary tabular-nums">{estimatedCost.toFixed(2)} KES</span>
                            </div>
                            {side === "buy" && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Potential payout</span>
                                <span className="font-bold text-primary tabular-nums">{numShares.toFixed(0)} KES</span>
                              </div>
                            )}
                            {side === "buy" && estimatedCost > 0 && (
                              <div className="pt-1.5">
                                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                  <span>Potential ROI</span>
                                  <span className="text-primary font-bold">
                                    {((numShares / estimatedCost - 1) * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <Progress value={Math.min((numShares / estimatedCost) * 50, 100)} className="h-1" />
                              </div>
                            )}
                          </motion.div>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Wallet className="h-3 w-3" />
                          Balance: <span className="font-bold text-primary tabular-nums">{walletBalance.toLocaleString()} KES</span>
                        </div>

                        {side === "sell" && myPosition && (
                          <div className="text-xs text-muted-foreground">
                            You hold: <span className="font-bold">{myPosition.shares} shares</span>
                          </div>
                        )}

                        <Button
                          onClick={handleTrade}
                          disabled={executing || numShares <= 0 || !selectedOutcome}
                          className={`w-full h-11 font-display tracking-wider text-sm ${
                            side === "buy" ? "neon-glow" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          }`}
                        >
                          {executing ? (
                            <motion.span
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            >
                              Executing...
                            </motion.span>
                          ) : side === "buy"
                            ? `Buy ${numShares || 0} shares — ${estimatedCost.toFixed(2)} KES`
                            : `Sell ${numShares || 0} shares — ${estimatedCost.toFixed(2)} KES`}
                        </Button>
                      </CardContent>
                    </SpotlightCard>
                  </motion.div>
                ) : (
                  <SpotlightCard className="p-6 text-center" spotlightColor="rgba(120, 255, 120, 0.08)">
                    <p className="text-sm text-muted-foreground mb-3">Sign in to trade</p>
                    <Link to="/auth"><Button className="neon-glow">Sign In</Button></Link>
                  </SpotlightCard>
                )
              ) : market.status === "resolved" ? (
                <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.05)">
                  <CardContent className="p-4 text-center space-y-2">
                    <p className="font-display text-sm font-bold tracking-wider">MARKET RESOLVED</p>
                    {outcomes.filter(o => o.is_winner).map(o => (
                      <motion.p
                        key={o.id}
                        className="text-primary font-bold font-display text-lg"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring" }}
                      >
                        <CheckCircle2 className="inline h-4 w-4 mr-1" /> {o.label}
                      </motion.p>
                    ))}
                    {market.matches && market.matches.home_score !== null && (
                      <p className="text-xs text-muted-foreground">
                        Final: {market.matches.home_score} - {market.matches.away_score}
                      </p>
                    )}
                  </CardContent>
                </SpotlightCard>
              ) : (
                <SpotlightCard className="p-6 text-center" spotlightColor="rgba(120, 255, 120, 0.03)">
                  <p className="text-sm text-muted-foreground font-display">Market closed — awaiting result</p>
                </SpotlightCard>
              )}

              {/* My positions */}
              {positions.filter(p => p.shares > 0).length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <h3 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Your Positions</h3>
                  <div className="space-y-1.5">
                    {positions.filter(p => p.shares > 0).map(pos => {
                      const outcome = outcomes.find(o => o.id === pos.outcome_id);
                      const idx = outcomes.indexOf(outcome!);
                      const currentPrice = idx >= 0 ? prices[idx] : 0;
                      const currentValue = pos.shares * currentPrice;
                      const pnl = currentValue - pos.total_cost;
                      return (
                        <motion.div
                          key={pos.outcome_id}
                          className="rounded-lg bg-muted/20 border border-border/20 p-3 hover:bg-muted/30 transition-colors"
                          whileHover={{ scale: 1.01 }}
                        >
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold">{outcome?.label}</span>
                            <span className="font-bold tabular-nums">{pos.shares} shares</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>Avg: {pos.avg_price.toFixed(2)} KES</span>
                            <span className={`font-bold ${pnl >= 0 ? "text-primary" : "text-destructive"}`}>
                              {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)} KES
                            </span>
                          </div>
                        </motion.div>
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
