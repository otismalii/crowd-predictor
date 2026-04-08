import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { PieChart, ArrowUpRight, ArrowDownLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";

interface PortfolioItem {
  market: { id: string; title: string; status: string; liquidity_param: number; total_volume: number; closes_at: string | null };
  outcome: { id: string; label: string; pool_shares: number; is_winner: boolean | null; market_id: string };
  position: { outcome_id: string; market_id: string; shares: number; avg_price: number; total_cost: number };
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

interface PositionsPanelProps {
  portfolioItems: PortfolioItem[];
}

const PositionsPanel = ({ portfolioItems }: PositionsPanelProps) => {
  const [posFilter, setPosFilter] = useState<"all" | "open" | "resolved">("all");

  const openPositions = portfolioItems.filter(i => i.market.status === "open").length;
  const resolvedPositions = portfolioItems.filter(i => i.market.status === "resolved").length;

  const filteredPositions = useMemo(() => {
    if (posFilter === "all") return portfolioItems;
    return portfolioItems.filter(i => posFilter === "open" ? i.market.status === "open" : i.market.status === "resolved");
  }, [portfolioItems, posFilter]);

  return (
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
                            {item.market.status === "resolved" ? "🦅 LANDED" : item.market.status.toUpperCase()}
                          </span>
                          {isWin && <Badge variant="outline" className="text-[9px] border-primary/30 text-primary gap-1 px-1.5 py-0"><CheckCircle2 className="h-2.5 w-2.5" /> Won</Badge>}
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
  );
};

export default PositionsPanel;
