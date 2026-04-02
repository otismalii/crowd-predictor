import { motion } from "framer-motion";

interface MarketOddsBarProps {
  label: string;
  pct: number;
  isSelected?: boolean;
  isWinner?: boolean;
  isResolved?: boolean;
  shares?: number;
  onClick?: () => void;
  onBuy?: () => void;
  onSell?: () => void;
  showActions?: boolean;
}

const MarketOddsBar = ({
  label, pct, isSelected, isWinner, isResolved, shares,
  onClick, onBuy, onSell, showActions,
}: MarketOddsBarProps) => (
  <motion.button
    onClick={onClick}
    className="w-full text-left"
    whileTap={{ scale: 0.99 }}
    whileHover={{ scale: 1.005 }}
    transition={{ type: "spring", stiffness: 400, damping: 25 }}
  >
    <div className={`relative flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-200 ${
      isSelected ? "border-primary/50 bg-card shadow-sm shadow-primary/5" :
      isWinner ? "border-primary/30 bg-primary/5" :
      isResolved && !isWinner ? "border-border/20 bg-muted/20 opacity-50" :
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
          {label}
        </span>
        {shares && shares > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {shares} shares
          </span>
        )}
      </div>
      <div className="relative z-10 flex items-center gap-3">
        <span className={`font-display text-lg font-bold tabular-nums ${pct > 50 ? "text-primary" : "text-muted-foreground"}`}>
          {pct}¢
        </span>
        {showActions && (
          <div className="flex gap-1">
            <span
              onClick={(e) => { e.stopPropagation(); onBuy?.(); }}
              className="px-2.5 py-1 text-[10px] font-semibold rounded-md bg-primary/10 text-primary border border-primary/20 cursor-pointer hover:bg-primary/20 transition-all"
            >
              Buy
            </span>
            {shares && shares > 0 && (
              <span
                onClick={(e) => { e.stopPropagation(); onSell?.(); }}
                className="px-2.5 py-1 text-[10px] font-semibold rounded-md bg-destructive/10 text-destructive border border-destructive/20 cursor-pointer hover:bg-destructive/20 transition-all"
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

export default MarketOddsBar;
