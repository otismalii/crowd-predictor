import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MarketCard from "@/components/MarketCard";
import type { Market, MarketOutcome } from "@/components/MarketCard";
import FeedSkeleton from "@/components/skeletons/FeedSkeleton";
import SEOHead from "@/components/SEOHead";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, BarChart3 } from "lucide-react";

const Resolved = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchMarkets(); }, []);

  const fetchMarkets = async () => {
    const { data: marketsData } = await supabase
      .from("markets")
      .select("*, matches(home_team, away_team, league, kickoff)")
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .limit(100) as any;

    if (!marketsData) { setLoading(false); return; }

    const marketIds = marketsData.map((m: any) => m.id);
    const { data: outcomesData } = await supabase
      .from("market_outcomes").select("*").in("market_id", marketIds).order("sort_order") as any;

    const byMarket: Record<string, MarketOutcome[]> = {};
    for (const o of (outcomesData || [])) {
      if (!byMarket[o.market_id]) byMarket[o.market_id] = [];
      byMarket[o.market_id].push(o);
    }

    setMarkets(marketsData.map((m: any) => ({ ...m, outcomes: byMarket[m.id] || [] })));
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Resolved Markets" description="See past market outcomes and how they were resolved with full source transparency." path="/resolved" />
      <Navbar />
      <div className="container py-6">
        <div className="flex items-center gap-2 mb-6">
          <CheckCircle2 className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold tracking-wider">
            Resolved <span className="text-primary neon-text">Markets</span>
          </h1>
        </div>
        {loading ? <FeedSkeleton /> : markets.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
            <p className="text-muted-foreground">No resolved markets yet</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto">
            <AnimatePresence mode="popLayout">
              {markets.map((market, i) => (
                <motion.div key={market.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} layout>
                  <MarketCard market={market} matchTeams={(market as any).matches ? { home_team: (market as any).matches.home_team, away_team: (market as any).matches.away_team } : null} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Resolved;
