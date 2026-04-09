import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowUpRight, ArrowDownLeft, Wallet, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { lmsrCost, lmsrSellReturn } from "@/lib/pricing";

interface TradePanelProps {
  marketId: string;
  marketStatus: string;
  outcomes: { id: string; label: string; pool_shares: number; is_winner: boolean | null }[];
  positions: { outcome_id: string; shares: number; avg_price: number; total_cost: number }[];
  selectedOutcome: string | null;
  walletBalance: number;
  liquidityParam: number;
  prices: number[];
  onTradeComplete: () => void;
  matchScore?: { home: number | null; away: number | null } | null;
}

const TradePanel = ({
  marketId, marketStatus, outcomes, positions, selectedOutcome,
  walletBalance, liquidityParam, prices, onTradeComplete, matchScore,
}: TradePanelProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [shares, setShares] = useState("");
  const [executing, setExecuting] = useState(false);

  const pools = outcomes.map(o => Number(o.pool_shares));
  const b = liquidityParam;
  const numShares = parseFloat(shares) || 0;
  const selectedIdx = outcomes.findIndex(o => o.id === selectedOutcome);
  const myPosition = positions.find(p => p.outcome_id === selectedOutcome);

  let estimatedCost = 0;
  if (numShares > 0 && selectedIdx >= 0) {
    if (side === "buy") {
      estimatedCost = lmsrCost(pools, selectedIdx, numShares, b);
    } else {
      const pos = positions.find(p => p.outcome_id === selectedOutcome);
      if (pos && pos.shares >= numShares) {
        estimatedCost = lmsrSellReturn(pools, selectedIdx, numShares, b);
      }
    }
  }

  const handleTrade = async () => {
    if (!user || !selectedOutcome || numShares <= 0) return;

    // Phone gate
    if (!profile?.phone_number) {
      toast({ title: "Phone required", description: "Add your phone number in profile settings before trading.", variant: "destructive" });
      return;
    }

    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke("execute-trade", {
        body: { market_id: marketId, outcome_id: selectedOutcome, side, shares: numShares },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: side === "buy" ? "🦅 Shares acquired!" : "🦅 Shares sold!",
        description: `${numShares} shares at KES ${data.price_per_share?.toFixed(2)} each`,
      });
      setShares("");
      onTradeComplete();
    } catch (e: any) {
      toast({ title: "Trade failed", description: e.message, variant: "destructive" });
    }
    setExecuting(false);
  };

  if (marketStatus === "resolved") {
    return (
      <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.05)">
        <CardContent className="p-4 text-center space-y-2">
          <p className="font-display text-sm font-bold tracking-wider">🦅 EAGLE HAS LANDED</p>
          {outcomes.filter(o => o.is_winner).map(o => (
            <motion.p key={o.id} className="text-primary font-bold font-display text-lg" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
              <CheckCircle2 className="inline h-4 w-4 mr-1" /> {o.label}
            </motion.p>
          ))}
          {matchScore && matchScore.home !== null && (
            <p className="text-xs text-muted-foreground">Final: {matchScore.home} - {matchScore.away}</p>
          )}
        </CardContent>
      </SpotlightCard>
    );
  }

  if (marketStatus !== "open") {
    return (
      <SpotlightCard className="p-6 text-center" spotlightColor="rgba(120, 255, 120, 0.03)">
        <p className="text-sm text-muted-foreground font-display">Market closed — awaiting resolution</p>
      </SpotlightCard>
    );
  }

  if (!user) {
    return (
      <SpotlightCard className="p-6 text-center" spotlightColor="rgba(120, 255, 120, 0.08)">
        <p className="text-sm text-muted-foreground mb-3">Sign in to trade</p>
        <Link to="/auth"><Button className="neon-glow">Sign In</Button></Link>
      </SpotlightCard>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.1)">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-display text-sm font-bold tracking-wider flex items-center gap-2">
            {side === "buy" ? <><ArrowUpRight className="h-4 w-4 text-primary" /> BUY SHARES</> : <><ArrowDownLeft className="h-4 w-4 text-destructive" /> SELL SHARES</>}
          </h3>

          <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg">
            {(["buy", "sell"] as const).map(s => (
              <motion.button
                key={s}
                onClick={() => setSide(s)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all min-h-[44px] ${
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
              className="text-center font-display text-lg font-bold"
            />
            <div className="flex gap-1">
              {[10, 25, 50, 100].map(q => (
                <motion.button
                  key={q}
                  onClick={() => setShares(String(q))}
                  whileTap={{ scale: 0.95 }}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold border transition-all min-h-[44px] ${
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
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="rounded-lg bg-muted/30 p-3 space-y-1.5 border border-border/30">
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
                    <span className="text-primary font-bold">{((numShares / estimatedCost - 1) * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={Math.min((numShares / estimatedCost) * 50, 100)} className="h-1" />
                </div>
              )}
              <p className="text-[9px] text-muted-foreground pt-1 border-t border-border/20">0% platform fee · LMSR automated pricing</p>
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
            className={`w-full min-h-[44px] font-display tracking-wider text-sm ${
              side === "buy" ? "neon-glow" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            }`}
          >
            {executing ? (
              <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>Executing...</motion.span>
            ) : side === "buy"
              ? `Buy ${numShares || 0} shares — ${estimatedCost.toFixed(2)} KES`
              : `Sell ${numShares || 0} shares — ${estimatedCost.toFixed(2)} KES`}
          </Button>
        </CardContent>
      </SpotlightCard>
    </motion.div>
  );
};

export default TradePanel;