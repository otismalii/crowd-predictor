import { BarChart3 } from "lucide-react";
import MarketCard from "@/components/MarketCard";
import type { Market } from "@/components/MarketCard";
import { motion, AnimatePresence } from "framer-motion";

interface MarketGridProps {
  markets: Market[];
  loading?: boolean;
  emptyMessage?: string;
  lastCardRef?: (node: HTMLDivElement | null) => void;
}

const MarketGrid = ({ markets, loading, emptyMessage = "No markets found", lastCardRef }: MarketGridProps) => {
  if (!loading && markets.length === 0) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
        <p className="text-muted-foreground font-display text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto">
      <AnimatePresence mode="popLayout">
        {markets.map((market, i) => (
          <motion.div
            key={market.id}
            ref={i === markets.length - 1 ? lastCardRef : undefined}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.3 }}
            layout
          >
            <MarketCard
              market={market}
              matchTeams={(market as any).matches ? {
                home_team: (market as any).matches.home_team,
                away_team: (market as any).matches.away_team,
              } : null}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default MarketGrid;
