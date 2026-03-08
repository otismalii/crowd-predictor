import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownLeft, BarChart3, Clock, Users, TrendingUp, Wallet } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GradientText from "@/components/reactbits/GradientText";
import Aurora from "@/components/reactbits/Aurora";
import TeamBadge from "@/components/TeamBadge";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import { lmsrPrice } from "@/components/MarketCard";

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
  matches?: { home_team: string; away_team: string; league: string; kickoff: string; home_score: number | null; away_score: number | null };
}

interface Position {
  outcome_id: string;
  shares: number;
  avg_price: number;
  total_cost: number;
}

interface Trade {
  id: string;
  outcome_id: string;
  side: string;
  shares: number;
  price_per_share: number;
  total_cost: number;
  created_at: string;
  profiles?: { username: string | null };
}

const MarketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [market, setMarket] = useState<MarketData | null>(null);
  const [outcomes, setOutcomes] = useState<MarketOutcome[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState("");
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchAll();
  }, [id, user]);

  const fetchAll = async () => {
    const [mRes, oRes, tRes] = await Promise.all([
      supabase.from("markets").select("*, matches(home_team, away_team, league, kickoff, home_score, away_score)").eq("id", id!).single() as any,
      supabase.from("market_outcomes").select("*").eq("market_id", id!).order("sort_order") as any,
      supabase.from("trades").select("*, profiles:user_id(username)").eq("market_id", id!).order("created_at", { ascending: false }).limit(50) as any,
    ]);

    if (mRes.data) setMarket(mRes.data);
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

    setLoading(false);
  };

  const pools = outcomes.map(o => Number(o.pool_shares));
  const b = market ? Number(market.liquidity_param) : 100;
  const prices = outcomes.map((_, i) => lmsrPrice(pools, i, b));

  // Estimate cost
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

  if (loading) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8 max-w-3xl space-y-4">
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

      {/* Hero */}
      <div className="relative border-b border-border/30 overflow-hidden">
        <Aurora />
        <div className="relative container py-8 sm:py-12 max-w-3xl">
          <div className="flex items-center gap-3 mb-3">
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
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider">
            <GradientText>{market.title}</GradientText>
          </h1>
          {market.description && <p className="text-sm text-muted-foreground mt-1">{market.description}</p>}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> {Math.round(market.total_volume)} KES volume</span>
            {market.closes_at && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Closes {format(new Date(market.closes_at), "MMM d, HH:mm")}</span>
            )}
          </div>
        </div>
      </div>

      <div className="container py-6 max-w-3xl">
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Outcomes + Trading */}
          <div className="lg:col-span-3 space-y-4">
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
                    <SpotlightCard
                      spotlightColor={isSelected ? "rgba(120, 255, 120, 0.15)" : "rgba(120, 255, 120, 0.05)"}
                      className={`overflow-hidden transition-all ${
                        isSelected ? "ring-1 ring-primary/40" : ""
                      } ${isWinner ? "ring-1 ring-primary/60" : ""}`}
                    >
                      <CardContent className="p-0">
                        <div className="relative flex items-center justify-between px-4 py-3">
                          <div
                            className={`absolute left-0 top-0 bottom-0 rounded-l-xl transition-all ${isWinner ? "bg-primary/15" : "bg-primary/5"}`}
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
                            <span className={`font-display text-xl font-bold ${pct > 50 ? "text-primary" : "text-muted-foreground"}`}>
                              {pct}¢
                            </span>
                            {market.status === "open" && (
                              <div className="flex gap-1">
                                <motion.span
                                  whileHover={{ scale: 1.1 }}
                                  onClick={(e) => { e.stopPropagation(); setSelectedOutcome(outcome.id); setSide("buy"); }}
                                  className="px-2 py-1 text-[10px] font-semibold rounded bg-primary/10 text-primary border border-primary/20 cursor-pointer hover:bg-primary/20"
                                >
                                  Buy
                                </motion.span>
                                {pos && pos.shares > 0 && (
                                  <motion.span
                                    whileHover={{ scale: 1.1 }}
                                    onClick={(e) => { e.stopPropagation(); setSelectedOutcome(outcome.id); setSide("sell"); }}
                                    className="px-2 py-1 text-[10px] font-semibold rounded bg-destructive/10 text-destructive border border-destructive/20 cursor-pointer hover:bg-destructive/20"
                                  >
                                    Sell
                                  </motion.span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </SpotlightCard>
                  </motion.button>
                );
              })}
            </div>

            {/* Trade activity */}
            <div>
              <h3 className="font-display text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Recent Trades</h3>
              {trades.length === 0 ? (
                <p className="text-xs text-muted-foreground">No trades yet — be the first!</p>
              ) : (
                <div className="space-y-1.5">
                  {trades.slice(0, 20).map((trade) => {
                    const outcome = outcomes.find(o => o.id === trade.outcome_id);
                    return (
                      <div key={trade.id} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-muted/20 border border-border/20">
                        {trade.side === "buy" ? (
                          <ArrowUpRight className="h-3 w-3 text-primary flex-shrink-0" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3 text-destructive flex-shrink-0" />
                        )}
                        <Link to={`/profile/${(trade as any).user_id}`} className="font-medium hover:text-primary transition-colors">
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
            </div>
          </div>

          {/* Trade panel */}
          <div className="lg:col-span-2">
            <div className="sticky top-20">
              {market.status === "open" ? (
                user ? (
                  <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.1)">
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-display text-sm font-bold tracking-wider">
                        {side === "buy" ? "📈 BUY" : "📉 SELL"} SHARES
                      </h3>

                      {/* Side toggle */}
                      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
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

                      {/* Selected outcome */}
                      {selectedOutcome && (
                        <div className="text-xs text-muted-foreground">
                          Outcome: <span className="font-semibold text-foreground">{outcomes.find(o => o.id === selectedOutcome)?.label}</span>
                          <span className="ml-2 text-primary font-bold">{selectedIdx >= 0 ? Math.round(prices[selectedIdx] * 100) : 0}¢</span>
                        </div>
                      )}

                      {/* Shares input */}
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

                      {/* Cost estimate */}
                      {numShares > 0 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="rounded-lg bg-muted/30 p-3 space-y-1 border border-border/30"
                        >
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
                        </motion.div>
                      )}

                      {/* Balance */}
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
                    {market.matches && (
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
              {positions.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Your Positions</h3>
                  <div className="space-y-1.5">
                    {positions.filter(p => p.shares > 0).map(pos => {
                      const outcome = outcomes.find(o => o.id === pos.outcome_id);
                      const currentPrice = outcome ? prices[outcomes.indexOf(outcome)] : 0;
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
