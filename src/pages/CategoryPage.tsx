import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MarketCard from "@/components/MarketCard";
import type { Market, MarketOutcome } from "@/components/MarketCard";
import FeedSkeleton from "@/components/skeletons/FeedSkeleton";
import SEOHead from "@/components/SEOHead";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, ArrowLeft } from "lucide-react";

const CATEGORY_META: Record<string, { title: string; description: string }> = {
  politics: { title: "Politics", description: "Predict outcomes of elections, policy decisions, and political events across Kenya and the world." },
  economics: { title: "Economics", description: "Forecast economic indicators, market trends, and financial developments." },
  social: { title: "Social", description: "Predict social trends, cultural events, and public opinion shifts." },
  local: { title: "Local", description: "Markets focused on local Kenyan events, county developments, and community outcomes." },
  regional: { title: "Regional", description: "Predict outcomes across East Africa and the broader African continent." },
  international: { title: "International", description: "Global events, international relations, and worldwide developments." },
  sports: { title: "Sports", description: "Football, athletics, and sports predictions with real-time resolution." },
};

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  const meta = slug ? CATEGORY_META[slug] : null;

  useEffect(() => {
    if (!slug) return;
    fetchMarkets();
  }, [slug]);

  const fetchMarkets = async () => {
    setLoading(true);
    // Map old categories to new ones for sports
    const categoryFilters = slug === "sports"
      ? ["sports", "match_result", "over_under"]
      : [slug!];

    const { data: marketsData } = await supabase
      .from("markets")
      .select("*, matches(home_team, away_team, league, kickoff)")
      .in("category", categoryFilters)
      .in("status", ["open", "closed"])
      .order("total_volume", { ascending: false })
      .limit(100) as any;

    if (!marketsData) { setLoading(false); return; }

    const marketIds = marketsData.map((m: any) => m.id);
    const { data: outcomesData } = await supabase
      .from("market_outcomes")
      .select("*")
      .in("market_id", marketIds)
      .order("sort_order") as any;

    const outcomesByMarket: Record<string, MarketOutcome[]> = {};
    for (const o of (outcomesData || [])) {
      if (!outcomesByMarket[o.market_id]) outcomesByMarket[o.market_id] = [];
      outcomesByMarket[o.market_id].push(o);
    }

    setMarkets(marketsData.map((m: any) => ({ ...m, outcomes: outcomesByMarket[m.id] || [] })));
    setLoading(false);
  };

  if (!meta) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">Category not found</p>
          <Link to="/markets" className="text-primary hover:underline text-sm mt-2 inline-block">Browse all markets</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${meta.title} Markets`}
        description={meta.description}
        path={`/categories/${slug}`}
      />
      <Navbar />

      <div className="border-b border-border/30 bg-card/30">
        <div className="container py-8">
          <Link to="/markets" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
            <ArrowLeft className="h-3 w-3" /> All Markets
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider">
            {meta.title} <span className="text-primary neon-text">Markets</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">{meta.description}</p>
        </div>
      </div>

      <div className="container py-6">
        {loading ? (
          <FeedSkeleton />
        ) : markets.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
            <p className="text-muted-foreground font-display text-lg">No {meta.title.toLowerCase()} markets yet</p>
            <p className="text-sm text-muted-foreground mt-1">Check back soon for new markets.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto">
            <AnimatePresence mode="popLayout">
              {markets.map((market, i) => (
                <motion.div
                  key={market.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
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
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CategoryPage;
