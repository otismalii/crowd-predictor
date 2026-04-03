import { Link } from "react-router-dom";
import { lmsrPrice } from "@/lib/pricing";
import { motion } from "framer-motion";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { CardContent } from "@/components/ui/card";
import TeamBadge from "@/components/TeamBadge";
import { TrendingUp, Users, BarChart3, CheckCircle2 } from "lucide-react";

interface MarketOutcome {
  id: string;
  label: string;
  pool_shares: number;
  is_winner: boolean | null;
  sort_order: number;
}

interface Market {
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
  outcomes: MarketOutcome[];
}

// LMSR price calculation
function lmsrPrice(pools: number[], index: number, b: number): number {
  const exps = pools.map(q => Math.exp(q / b));
  const total = exps.reduce((s, e) => s + e, 0);
  return exps[index] / total;
}

interface MarketCardProps {
  market: Market;
  matchTeams?: { home_team: string; away_team: string } | null;
}

const MarketCard = ({ market, matchTeams }: MarketCardProps) => {
  const pools = market.outcomes.map(o => Number(o.pool_shares));
  const b = Number(market.liquidity_param);
  const prices = market.outcomes.map((_, i) => lmsrPrice(pools, i, b));

  const isResolved = market.status === "resolved";
  const spotlightColor = isResolved
    ? "rgba(120, 255, 120, 0.05)"
    : market.status === "open"
    ? "rgba(120, 255, 120, 0.1)"
    : "rgba(120, 255, 120, 0.03)";

  return (
    <Link to={`/markets/${market.id}`}>
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
        <SpotlightCard spotlightColor={spotlightColor} className="overflow-hidden hover:border-primary/20 transition-all cursor-pointer">
          <CardContent className="p-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/30">
              <div className="flex items-center gap-2">
                {matchTeams && (
                  <>
                    <TeamBadge teamName={matchTeams.home_team} size="sm" />
                    <TeamBadge teamName={matchTeams.away_team} size="sm" />
                  </>
                )}
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                  {market.category === "match_result" ? "Match Result" : "Over/Under"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {market.total_volume > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" /> {Math.round(market.total_volume)} KES
                  </span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  market.status === "open" ? "bg-primary/20 text-primary" :
                  market.status === "closed" ? "bg-accent/20 text-accent" :
                  market.status === "resolved" ? "bg-muted text-muted-foreground" :
                  "bg-destructive/20 text-destructive"
                }`}>
                  {market.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Title */}
            <div className="px-4 py-3">
              <h3 className="font-display text-sm font-bold tracking-wider group-hover:text-primary transition-colors">
                {market.title}
              </h3>
              {market.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{market.description}</p>
              )}
            </div>

            {/* Outcome bars */}
            <div className="px-4 pb-4 space-y-2">
              {market.outcomes.map((outcome, i) => {
                const pct = Math.round(prices[i] * 100);
                const isWinner = outcome.is_winner === true;

                return (
                  <div key={outcome.id} className="relative">
                    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
                      isWinner
                        ? "border-primary/40 bg-primary/10"
                        : isResolved && !isWinner
                        ? "border-border/20 bg-muted/20 opacity-50"
                        : "border-border/30 bg-muted/20 hover:bg-muted/40"
                    }`}>
                      {/* Background fill bar */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 rounded-lg transition-all ${
                          isWinner ? "bg-primary/15" : "bg-primary/5"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                      <span className={`relative text-xs font-semibold z-10 ${isWinner ? "text-primary" : ""}`}>
                        {outcome.label}
                        {isWinner && <CheckCircle2 className="inline h-3 w-3 ml-1" />}
                      </span>
                      <span className={`relative text-sm font-display font-bold z-10 ${
                        isWinner ? "text-primary" : pct > 50 ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {pct}¢
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </SpotlightCard>
      </motion.div>
    </Link>
  );
};

export default MarketCard;
export { lmsrPrice };
export type { Market, MarketOutcome };
