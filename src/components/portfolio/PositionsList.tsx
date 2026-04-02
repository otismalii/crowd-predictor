import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { CardContent } from "@/components/ui/card";
import MarketStatusPill from "@/components/markets/MarketStatusPill";
import { motion } from "framer-motion";

interface PortfolioItem {
  market: { id: string; title: string; status: string };
  outcome: { label: string; is_winner: boolean | null };
  position: { shares: number; avg_price: number; total_cost: number };
  currentPrice: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

interface PositionsListProps {
  items: PortfolioItem[];
  filter: "all" | "open" | "resolved";
  onFilterChange: (f: "all" | "open" | "resolved") => void;
}

const PositionsList = ({ items, filter, onFilterChange }: PositionsListProps) => {
  const openCount = items.filter(i => i.market.status === "open").length;
  const resolvedCount = items.filter(i => i.market.status === "resolved").length;

  const filtered = filter === "all" ? items :
    items.filter(i => filter === "open" ? i.market.status === "open" : i.market.status === "resolved");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-bold tracking-wider">POSITIONS</h2>
        <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30">
          {([
            { key: "all" as const, label: "All", count: items.length },
            { key: "open" as const, label: "Open", count: openCount },
            { key: "resolved" as const, label: "Done", count: resolvedCount },
          ]).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => onFilterChange(key)}
              className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                filter === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter === key && (
                <motion.div layoutId="pos-filter-bg" className="absolute inset-0 bg-primary rounded-lg shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10">{label}{count > 0 && ` (${count})`}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No positions</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, i) => (
            <motion.div
              key={`${item.market.id}-${item.outcome.label}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link to={`/markets/${item.market.id}`}>
                <SpotlightCard
                  spotlightColor={item.pnl >= 0 ? "rgba(120, 255, 120, 0.08)" : "rgba(255, 80, 80, 0.06)"}
                  className="hover:border-primary/20 transition-all cursor-pointer"
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MarketStatusPill status={item.market.status} />
                        <span className="text-xs font-medium text-primary">{item.outcome.label}</span>
                      </div>
                      <p className="text-sm font-display font-bold truncate">{item.market.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{item.position.shares} shares</span>
                        <span>Avg {(item.position.avg_price * 100).toFixed(0)}¢</span>
                        <span>Now {(item.currentPrice * 100).toFixed(0)}¢</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className={`font-display text-sm font-bold tabular-nums flex items-center gap-1 ${
                        item.pnl >= 0 ? "text-primary" : "text-destructive"
                      }`}>
                        {item.pnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {item.pnl >= 0 ? "+" : ""}{Math.round(item.pnl)} KES
                      </div>
                      <span className={`text-[10px] ${item.pnl >= 0 ? "text-primary" : "text-destructive"}`}>
                        {item.pnlPercent >= 0 ? "+" : ""}{item.pnlPercent.toFixed(1)}%
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-2" />
                  </CardContent>
                </SpotlightCard>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PositionsList;
