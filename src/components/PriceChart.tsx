import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { lmsrPrice } from "@/components/MarketCard";

interface Trade {
  outcome_id: string;
  side: string;
  shares: number;
  created_at: string;
}

interface Outcome {
  id: string;
  label: string;
  pool_shares: number;
  sort_order: number;
}

// Chart-friendly colors using HSL strings
const OUTCOME_COLORS = [
  "hsl(142, 72%, 45%)",   // green
  "hsl(38, 92%, 50%)",    // amber
  "hsl(220, 70%, 55%)",   // blue
  "hsl(0, 84%, 60%)",     // red
];

interface PriceChartProps {
  trades: Trade[];
  outcomes: Outcome[];
  liquidityParam: number;
  marketCreatedAt: string;
}

const PriceChart = ({ trades, outcomes, liquidityParam, marketCreatedAt }: PriceChartProps) => {
  const chartData = useMemo(() => {
    if (outcomes.length === 0) return [];

    const b = liquidityParam;
    const sortedOutcomes = [...outcomes].sort((a, b) => a.sort_order - b.sort_order);

    // Reconstruct initial pools by reversing all trades from current state
    const currentPools = sortedOutcomes.map(o => Number(o.pool_shares));
    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // To find initial pools: reverse all trades from current state
    const initialPools = [...currentPools];
    for (let i = sortedTrades.length - 1; i >= 0; i--) {
      const t = sortedTrades[i];
      const idx = sortedOutcomes.findIndex(o => o.id === t.outcome_id);
      if (idx < 0) continue;
      if (t.side === "buy") {
        initialPools[idx] -= t.shares;
      } else {
        initialPools[idx] += t.shares;
      }
    }

    // Build data points
    const points: Record<string, any>[] = [];
    const pools = [...initialPools];

    // Initial point
    const initialPoint: Record<string, any> = {
      time: new Date(marketCreatedAt).getTime(),
      timeLabel: format(new Date(marketCreatedAt), "MMM d HH:mm"),
    };
    sortedOutcomes.forEach((o, i) => {
      initialPoint[o.label] = Math.round(lmsrPrice(pools, i, b) * 100);
    });
    points.push(initialPoint);

    // Apply each trade
    for (const trade of sortedTrades) {
      const idx = sortedOutcomes.findIndex(o => o.id === trade.outcome_id);
      if (idx < 0) continue;

      if (trade.side === "buy") {
        pools[idx] += trade.shares;
      } else {
        pools[idx] -= trade.shares;
      }

      const point: Record<string, any> = {
        time: new Date(trade.created_at).getTime(),
        timeLabel: format(new Date(trade.created_at), "MMM d HH:mm"),
      };
      sortedOutcomes.forEach((o, i) => {
        point[o.label] = Math.round(lmsrPrice(pools, i, b) * 100);
      });
      points.push(point);
    }

    return points;
  }, [trades, outcomes, liquidityParam, marketCreatedAt]);

  const sortedOutcomes = [...outcomes].sort((a, b) => a.sort_order - b.sort_order);

  if (chartData.length < 2) {
    return (
      <div className="rounded-xl border border-border/30 bg-card/50 p-6 text-center">
        <p className="text-xs text-muted-foreground">Chart will appear after the first trade</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/30 bg-card/50 p-4">
      <h3 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
        Probability Over Time
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="timeLabel"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}¢`}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              fontSize: "12px",
              boxShadow: "0 4px 12px hsl(var(--background) / 0.5)",
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
            formatter={(value: number, name: string) => [`${value}¢`, name]}
          />
          {sortedOutcomes.map((outcome, i) => (
            <Line
              key={outcome.id}
              type="stepAfter"
              dataKey={outcome.label}
              stroke={OUTCOME_COLORS[i % OUTCOME_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        {sortedOutcomes.map((outcome, i) => (
          <div key={outcome.id} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
            />
            <span className="text-[10px] text-muted-foreground font-medium">{outcome.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PriceChart;
