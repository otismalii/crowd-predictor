import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, BarChart3, Flame, Clock, Filter } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MarketCard from "@/components/MarketCard";
import type { Market, MarketOutcome } from "@/components/MarketCard";
import FeedSkeleton from "@/components/skeletons/FeedSkeleton";
import SEOHead from "@/components/SEOHead";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "politics", label: "Politics" },
  { key: "economics", label: "Economics" },
  { key: "social", label: "Social" },
  { key: "local", label: "Local" },
  { key: "regional", label: "Regional" },
  { key: "international", label: "International" },
  { key: "sports", label: "Sports" },
];

const Markets = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"trending" | "newest" | "closing">("trending");

  useEffect(() => {
    fetchMarkets();
  }, []);

  const fetchMarkets = async () => {
    let query = supabase
      .from("markets")
      .select("*, matches(home_team, away_team, league, kickoff)")
      .in("status", ["open", "closed"])
      .order("created_at", { ascending: false })
      .limit(200) as any;

    const { data: marketsData } = await query;
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

  const filtered = useMemo(() => {
    let list = markets;

    if (category !== "all") {
      list = list.filter(m => m.category === category);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case "trending":
        return [...list].sort((a, b) => b.total_volume - a.total_volume);
      case "newest":
        return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "closing":
        return [...list].sort((a, b) => {
          if (!a.closes_at) return 1;
          if (!b.closes_at) return -1;
          return new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime();
        });
      default:
        return list;
    }
  }, [markets, search, category, sort]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="All Markets"
        description="Browse prediction markets across politics, economics, sports, and more. Trade on real-world outcomes with source-backed resolution."
        path="/markets"
      />
      <Navbar />

      <div className="container py-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider mb-4">
          All <span className="text-primary neon-text">Markets</span>
        </h1>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3">
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                category === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border/30 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search + Sort */}
        <div className="flex items-center gap-3 mt-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search markets..."
              className="pl-9 h-10 bg-background/60 border-border/50"
            />
          </div>
          <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30">
            {([
              { key: "trending" as const, label: "Trending", icon: Flame },
              { key: "newest" as const, label: "New", icon: BarChart3 },
              { key: "closing" as const, label: "Closing", icon: Clock },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`relative flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  sort === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {sort === key && (
                  <motion.div layoutId="markets-sort-bg" className="absolute inset-0 bg-primary rounded-lg" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <FeedSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
            <p className="text-muted-foreground font-display text-lg">No markets found</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto">
            <AnimatePresence mode="popLayout">
              {filtered.map((market, i) => (
                <motion.div
                  key={market.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
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

export default Markets;
