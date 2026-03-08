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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowUpRight, ArrowDownLeft, BarChart3, Clock, TrendingUp,
  Wallet, MessageCircle, Send, Brain, Trash2, Calendar,
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

const MarketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [market, setMarket] = useState<MarketData | null>(null);
  const [outcomes, setOutcomes] = useState<MarketOutcome[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [insight, setInsight] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState("");
  const [executing, setExecuting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<"activity" | "discussion">("discussion");

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
      // Fetch AI insight for this match
      if (mRes.data.match_id) {
        const { data: insightData } = await supabase
          .from("ai_insights").select("ai_summary")
          .eq("match_id", mRes.data.match_id)
          .order("created_at", { ascending: false }).limit(1).single();
        if (insightData) setInsight(insightData.ai_summary);
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
        title: side === "buy" ? "📈 Shares bought!" : "📉 Shares sold!",
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

  if (loading) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8 max-w-4xl space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Market header */}
      <div className="border-b border-border/30 bg-card/30">
        <div className="container py-6 max-w-4xl">
          <div className="flex items-center gap-3 mb-2">
            {market.matches && (
              <>
                <TeamBadge teamName={market.matches.home_team} size="md" />
                <TeamBadge teamName={market.matches.away_team} size="md" />
              </>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              market.status === "open" ? "bg-primary/20 text-primary" :
              market.status === "resolved" ? "bg-accent/20 text-accent" :
              "bg-muted text-muted-foreground"
            }`}>
              {market.status.toUpperCase()}
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wider text-foreground">
            {market.title}
          </h1>
          {market.description && <p className="text-sm text-muted-foreground mt-0.5">{market.description}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> {Math.round(market.total_volume)} KES volume</span>
            {market.closes_at && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Closes {format(new Date(market.closes_at), "MMM d, HH:mm")}</span>
            )}
            {market.matches && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(market.matches.kickoff), "MMM d, HH:mm")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="container py-6 max-w-4xl">
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Main content */}
          <div className="lg:col-span-3 space-y-5">
            {/* Outcome prices */}
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
                  >
                    <div className={`relative flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      isSelected ? "border-primary/40 bg-card" :
                      isWinner ? "border-primary/30 bg-primary/5" :
                      "border-border/30 bg-card/50 hover:bg-card"
                    }`}>
                      <div
                        className={`absolute left-0 top-0 bottom-0 rounded-xl transition-all ${isWinner ? "bg-primary/10" : "bg-primary/5"}`}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative z-10 flex items-center gap-2">
                        <span className={`font-display text-sm font-bold ${isWinner ? "text-primary" : ""}`}>
                          {outcome.label} {isWinner && "✓"}
                        </span>
                        {pos && pos.shares > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {pos.shares} shares
                          </span>
                        )}
                      </div>
                      <div className="relative z-10 flex items-center gap-3">
                        <span className={`font-display text-lg font-bold ${pct > 50 ? "text-primary" : "text-muted-foreground"}`}>
                          {pct}¢
                        </span>
                        {market.status === "open" && (
                          <div className="flex gap-1">
                            <span
                              onClick={(e) => { e.stopPropagation(); setSelectedOutcome(outcome.id); setSide("buy"); }}
                              className="px-2 py-1 text-[10px] font-semibold rounded bg-primary/10 text-primary border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
                            >
                              Buy
                            </span>
                            {pos && pos.shares > 0 && (
                              <span
                                onClick={(e) => { e.stopPropagation(); setSelectedOutcome(outcome.id); setSide("sell"); }}
                                className="px-2 py-1 text-[10px] font-semibold rounded bg-destructive/10 text-destructive border border-destructive/20 cursor-pointer hover:bg-destructive/20 transition-colors"
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
            <PriceChart
              trades={trades}
              outcomes={outcomes}
              liquidityParam={b}
              marketCreatedAt={market.created_at}
            />

            {/* AI Insight */}
            {insight && (
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold text-accent uppercase tracking-wider">AI Analysis</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-6">
                  {insight}
                </p>
              </div>
            )}

            {/* Tabs: Discussion / Activity */}
            <div>
              <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg border border-border/30 w-fit mb-4">
                {([
                  { key: "discussion" as const, label: "Discussion", icon: MessageCircle, count: comments.length },
                  { key: "activity" as const, label: "Activity", icon: TrendingUp, count: trades.length },
                ]).map(({ key, label, icon: Icon, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      activeTab === key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                    {count > 0 && <span className="text-[10px] opacity-70">({count})</span>}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === "discussion" ? (
                  <motion.div
                    key="discussion"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    {/* Comment input */}
                    {user ? (
                      <div className="flex gap-2">
                        <Textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Share your analysis or opinion..."
                          rows={2}
                          className="text-sm resize-none flex-1"
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
                      <div className="text-center py-3 text-sm text-muted-foreground">
                        <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to join the discussion
                      </div>
                    )}

                    {/* Comments list */}
                    {comments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-20" />
                        <p className="text-sm">No comments yet — be the first to share your take!</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {comments.map((comment) => (
                          <div key={comment.id} className="flex gap-2.5 p-3 rounded-lg bg-muted/20 border border-border/20">
                            <Avatar className="h-7 w-7 flex-shrink-0">
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
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="activity"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {trades.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No trades yet — be the first!</p>
                    ) : (
                      <div className="space-y-1.5 max-h-96 overflow-y-auto">
                        {trades.map((trade) => {
                          const outcome = outcomes.find(o => o.id === trade.outcome_id);
                          return (
                            <div key={trade.id} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-muted/20 border border-border/20">
                              {trade.side === "buy" ? (
                                <ArrowUpRight className="h-3 w-3 text-primary flex-shrink-0" />
                              ) : (
                                <ArrowDownLeft className="h-3 w-3 text-destructive flex-shrink-0" />
                              )}
                              <Link to={`/profile/${trade.user_id}`} className="font-medium hover:text-primary transition-colors">
                                @{(trade.profiles as any)?.username || "anon"}
                              </Link>
                              <span className="text-muted-foreground">
                                {trade.side === "buy" ? "bought" : "sold"} {trade.shares} of
                              </span>
                              <span className="font-semibold">{outcome?.label}</span>
                              <span className="ml-auto text-muted-foreground">
                                {trade.total_cost.toFixed(1)} KES
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Trade panel */}
          <div className="lg:col-span-2">
            <div className="sticky top-20 space-y-4">
              {market.status === "open" ? (
                user ? (
                  <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.1)">
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-display text-sm font-bold tracking-wider">
                        {side === "buy" ? "📈 BUY" : "📉 SELL"} SHARES
                      </h3>

                      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg">
                        {(["buy", "sell"] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setSide(s)}
                            className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${
                              side === s
                                ? s === "buy" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {s === "buy" ? "Buy" : "Sell"}
                          </button>
                        ))}
                      </div>

                      {selectedOutcome && (
                        <div className="text-xs text-muted-foreground">
                          Outcome: <span className="font-semibold text-foreground">{outcomes.find(o => o.id === selectedOutcome)?.label}</span>
                          <span className="ml-2 text-primary font-bold">{selectedIdx >= 0 ? Math.round(prices[selectedIdx] * 100) : 0}¢</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Shares</label>
                        <Input
                          type="number"
                          min={1}
                          value={shares}
                          onChange={(e) => setShares(e.target.value)}
                          placeholder="10"
                          className="text-center font-display text-lg font-bold"
                        />
                        <div className="flex gap-1">
                          {[10, 25, 50, 100].map(q => (
                            <button
                              key={q}
                              onClick={() => setShares(String(q))}
                              className={`flex-1 py-1 rounded text-[10px] font-semibold border transition-all ${
                                shares === String(q) ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"
                              }`}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>

                      {numShares > 0 && (
                        <div className="rounded-lg bg-muted/30 p-3 space-y-1 border border-border/30">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Avg price</span>
                            <span className="font-bold">{(estimatedCost / numShares).toFixed(2)} KES</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{side === "buy" ? "Total cost" : "You receive"}</span>
                            <span className="font-bold text-primary">{estimatedCost.toFixed(2)} KES</span>
                          </div>
                          {side === "buy" && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Potential payout</span>
                              <span className="font-bold text-primary">{numShares.toFixed(0)} KES</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Wallet className="h-3 w-3" />
                        Balance: <span className="font-bold text-primary">{walletBalance.toLocaleString()} KES</span>
                      </div>

                      {side === "sell" && myPosition && (
                        <div className="text-xs text-muted-foreground">
                          You hold: <span className="font-bold">{myPosition.shares} shares</span>
                        </div>
                      )}

                      <Button
                        onClick={handleTrade}
                        disabled={executing || numShares <= 0 || !selectedOutcome}
                        className={`w-full h-10 font-display tracking-wider ${
                          side === "buy" ? "neon-glow" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        }`}
                      >
                        {executing ? "Executing..." : side === "buy"
                          ? `Buy ${numShares || 0} shares — ${estimatedCost.toFixed(2)} KES`
                          : `Sell ${numShares || 0} shares — ${estimatedCost.toFixed(2)} KES`}
                      </Button>
                    </CardContent>
                  </SpotlightCard>
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
                      <p key={o.id} className="text-primary font-bold font-display">✓ {o.label}</p>
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
                <div>
                  <h3 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Your Positions</h3>
                  <div className="space-y-1.5">
                    {positions.filter(p => p.shares > 0).map(pos => {
                      const outcome = outcomes.find(o => o.id === pos.outcome_id);
                      const idx = outcomes.indexOf(outcome!);
                      const currentPrice = idx >= 0 ? prices[idx] : 0;
                      const currentValue = pos.shares * currentPrice;
                      const pnl = currentValue - pos.total_cost;
                      return (
                        <div key={pos.outcome_id} className="rounded-lg bg-muted/20 border border-border/20 p-2.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold">{outcome?.label}</span>
                            <span className="font-bold">{pos.shares} shares</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>Avg: {pos.avg_price.toFixed(2)} KES</span>
                            <span className={pnl >= 0 ? "text-primary" : "text-destructive"}>
                              {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)} KES
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
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
