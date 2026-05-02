import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface TrendSummaryProps { marketId: string; }

interface Trend {
  window: string;
  volume_delta: number;
  price_delta: number;
  unique_traders: number;
  trade_count: number;
}

/**
 * Plain-language explanation of recent market movement.
 * Rule-based, NO AI per project memory.
 */
const TrendSummary = ({ marketId }: TrendSummaryProps) => {
  const [trend, setTrend] = useState<Trend | null>(null);

  useEffect(() => {
    supabase.from("market_trends")
      .select("window, volume_delta, price_delta, unique_traders, trade_count")
      .eq("market_id", marketId).eq("window", "1h")
      .order("computed_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setTrend(data as Trend | null));
  }, [marketId]);

  if (!trend || trend.trade_count === 0) return null;

  const priceUp = trend.price_delta > 0.01;
  const priceDown = trend.price_delta < -0.01;
  const Icon = priceUp ? TrendingUp : priceDown ? TrendingDown : Activity;
  const colorClass = priceUp ? "text-primary" : priceDown ? "text-destructive" : "text-accent";

  // Plain-language explainer
  let why = "";
  if (trend.unique_traders > 5 && Math.abs(trend.price_delta) > 0.05) {
    why = `${trend.unique_traders} traders moved this market in the last hour.`;
  } else if (trend.trade_count > 10) {
    why = `Heavy trading volume — ${trend.trade_count} trades in the last hour.`;
  } else if (Math.abs(trend.price_delta) > 0.05) {
    why = `Sharp price move on low volume — keep an eye on this one.`;
  } else {
    why = `Quiet hour — ${trend.trade_count} trades.`;
  }

  return (
    <div className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <span className="font-display text-xs font-bold tracking-wider">LAST HOUR</span>
        <span className={`text-xs tabular-nums font-bold ${colorClass}`}>
          {priceUp ? "+" : ""}{(trend.price_delta * 100).toFixed(1)}¢
        </span>
        <span className="text-xs text-muted-foreground tabular-nums ml-auto">
          {Number(trend.volume_delta).toLocaleString()} KES vol
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">{why}</p>
    </div>
  );
};

export default TrendSummary;
