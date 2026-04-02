import { TrendingUp, TrendingDown, PieChart, Activity, Wallet } from "lucide-react";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { CardContent } from "@/components/ui/card";
import AnimatedCounter from "@/components/reactbits/AnimatedCounter";
import { motion } from "framer-motion";

interface PortfolioSummaryProps {
  balance: number;
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  positionCount: number;
}

const PortfolioSummary = ({ balance, totalValue, totalPnl, totalPnlPercent, positionCount }: PortfolioSummaryProps) => {
  const stats = [
    { label: "Balance", value: balance, icon: Wallet, color: "text-primary", suffix: " KES" },
    { label: "Portfolio", value: totalValue, icon: PieChart, color: "text-accent", suffix: " KES" },
    { label: "P&L", value: totalPnl, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, color: totalPnl >= 0 ? "text-primary" : "text-destructive", prefix: totalPnl >= 0 ? "+" : "", suffix: " KES" },
    { label: "Positions", value: positionCount, icon: Activity, color: "text-foreground", suffix: "" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value, icon: Icon, color, prefix, suffix }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04 }}
        >
          <SpotlightCard spotlightColor="rgba(120, 255, 120, 0.08)" className="h-full">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
              </div>
              <div className={`font-display text-lg font-bold tabular-nums ${color}`}>
                {prefix}
                <AnimatedCounter value={Math.round(Math.abs(value))} fontSize={18} duration={0.8} />
                <span className="text-xs font-normal text-muted-foreground ml-0.5">{suffix}</span>
              </div>
              {label === "P&L" && totalPnlPercent !== 0 && (
                <span className={`text-[10px] tabular-nums ${totalPnl >= 0 ? "text-primary" : "text-destructive"}`}>
                  {totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(1)}%
                </span>
              )}
            </CardContent>
          </SpotlightCard>
        </motion.div>
      ))}
    </div>
  );
};

export default PortfolioSummary;
