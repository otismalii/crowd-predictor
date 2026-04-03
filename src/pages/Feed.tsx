import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGuest } from "@/contexts/GuestContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, TrendingUp, Search, BarChart3, Flame, Clock, ArrowRight, Loader2, ChevronRight, CheckCircle2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MarketCard from "@/components/MarketCard";
import type { Market, MarketOutcome } from "@/components/MarketCard";
import FeedSkeleton from "@/components/skeletons/FeedSkeleton";
import SEOHead from "@/components/SEOHead";
import { motion, AnimatePresence } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";

const CATEGORIES = [
  { key: "all", label: "All", emoji: "🌍" },
  { key: "politics", label: "Politics", emoji: "🏛️" },
  { key: "economics", label: "Economics", emoji: "📈" },
  { key: "sports", label: "Sports", emoji: "⚽" },
  { key: "social", label: "Social", emoji: "🤝" },
  { key: "local", label: "Local", emoji: "🇰🇪" },
  { key: "regional", label: "Regional", emoji: "🌍" },
  { key: "international", label: "Global", emoji: "🌐" },
];

const PAGE_SIZE = 20;

const Feed = () => {
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"trending" | "newest" | "closing">("trending");
  const [category, setCategory] = useState("all");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const totalFetched = useRef(0);

  useEffect(() => {
    totalFetched.current = 0;
    setMarkets([]);
    setHasMore(true);
    setLoading(true);
    setFetchError(null);
    fetchMarkets(0).then(() => setLoading(false));
  }, []);

  const fetchMarkets = async (offset: number, replace = false) => {
    const { data: marketsData } = await supabase
      .from("markets")
      .select("*, matches(home_team, away_team, league, kickoff)")
      .in("status", ["open", "closed"])
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1) as any;

    if (!marketsData) return;
    if (marketsData.length < PAGE_SIZE) setHasMore(false);
    totalFetched.current = offset + marketsData.length;

    const marketIds = marketsData.map((m: any) => m.id);
    const { data: outcomesData } = await supabase
      .from("market_outcomes").select("*").in("market_id", marketIds).order("sort_order") as any;

    const outcomesByMarket: Record<string, MarketOutcome[]> = {};
    for (const o of (outcomesData || [])) {
      if (!outcomesByMarket[o.market_id]) outcomesByMarket[o.market_id] = [];
      outcomesByMarket[o.market_id].push(o);
    }

    const newMarkets = marketsData.map((m: any) => ({ ...m, outcomes: outcomesByMarket[m.id] || [] }));

    if (replace || offset === 0) {
      setMarkets(newMarkets);
    } else {
      setMarkets(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        return [...prev, ...newMarkets.filter((m: Market) => !existingIds.has(m.id))];
      });
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchMarkets(totalFetched.current);
    setLoadingMore(false);
  }, [loadingMore, hasMore]);

  const lastCardRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) loadMore();
    }, { rootMargin: "200px" });
    if (node) observerRef.current.observe(node);
  }, [hasMore, loadingMore, loadMore]);

  const filtered = useMemo(() => {
    let list = markets;

    if (category !== "all") {
      const catFilters = category === "sports" ? ["sports", "match_result", "over_under"] : [category];
      list = list.filter(m => catFilters.includes(m.category));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q) ||
        (m as any).matches?.league?.toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case "trending": return [...list].sort((a, b) => b.total_volume - a.total_volume);
      case "newest": return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "closing": return [...list].sort((a, b) => {
        if (!a.closes_at) return 1; if (!b.closes_at) return -1;
        return new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime();
      });
      default: return list;
    }
  }, [markets, search, sort, category]);

  const totalVolume = markets.reduce((s, m) => s + m.total_volume, 0);
  const openCount = markets.filter(m => m.status === "open").length;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={undefined}
        description="Kenya's premier prediction market. Forecast outcomes across politics, economics, sports, and more with source-backed resolution."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Pagaza",
          url: "https://pagaza.vercel.app",
          description: "Kenya's premier prediction market platform",
          potentialAction: { "@type": "SearchAction", target: "https://pagaza.vercel.app/markets?q={search_term_string}" },
        }}
      />
      <Navbar />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/30">
        <div className="absolute inset-0 bg-cover bg-center opacity-20 dark:opacity-30" style={{ backgroundImage: `url(${heroBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="relative container py-10 sm:py-14">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-foreground">
                Prediction <span className="text-primary neon-text">Markets</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Forecast real-world outcomes across Kenya and beyond. Source-backed resolution. No signup required.
              </p>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 bg-muted/30 px-2.5 py-1.5 rounded-lg">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  <strong className="text-primary">{openCount}</strong> open
                </span>
                <span className="flex items-center gap-1.5 bg-muted/30 px-2.5 py-1.5 rounded-lg">
                  <TrendingUp className="h-3.5 w-3.5 text-accent" />
                  <strong className="text-accent">{Math.round(totalVolume).toLocaleString()}</strong> KES vol
                </span>
              </motion.div>
            </div>
            {!user && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="flex flex-col gap-2">
                <Button onClick={() => navigate("/auth")} size="lg" className="neon-glow gap-2 font-display tracking-wider">
                  <LogIn className="h-4 w-4" /> Sign In to Trade <ArrowRight className="h-4 w-4" />
                </Button>
                {isGuest && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Browsing as guest · <Link to="/auth" className="text-primary hover:underline">Save progress</Link>
                  </p>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Category chips */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2 overflow-x-auto scrollbar-none mt-5 pb-1">
            {CATEGORIES.map(({ key, label, emoji }) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  category === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border/30 hover:text-foreground"
                }`}
              >
                <span>{emoji}</span> {label}
              </button>
            ))}
          </motion.div>

          {/* Search + Sort */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search markets..." className="pl-9 h-10 bg-background/60 backdrop-blur-sm border-border/50" />
            </div>
            <div className="flex gap-0.5 p-0.5 bg-muted/50 rounded-xl border border-border/30 backdrop-blur-sm">
              {([
                { key: "trending" as const, label: "Trending", icon: Flame },
                { key: "newest" as const, label: "New", icon: BarChart3 },
                { key: "closing" as const, label: "Closing", icon: Clock },
              ]).map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setSort(key)} className={`relative flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${sort === key ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {sort === key && <motion.div layoutId="feed-sort-bg" className="absolute inset-0 bg-primary rounded-lg shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                  <span className="relative z-10 flex items-center gap-1"><Icon className="h-3 w-3" /><span className="hidden sm:inline">{label}</span></span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Quick links bar */}
      <div className="border-b border-border/20 bg-muted/20">
        <div className="container flex items-center gap-4 py-2 overflow-x-auto scrollbar-none text-xs">
          <Link to="/trending" className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors whitespace-nowrap">
            <Flame className="h-3 w-3" /> Trending <ChevronRight className="h-3 w-3" />
          </Link>
          <Link to="/closing-soon" className="flex items-center gap-1 text-muted-foreground hover:text-accent transition-colors whitespace-nowrap">
            <Clock className="h-3 w-3" /> Closing Soon <ChevronRight className="h-3 w-3" />
          </Link>
          <Link to="/resolved" className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors whitespace-nowrap">
            <CheckCircle2 className="h-3 w-3" /> Resolved <ChevronRight className="h-3 w-3" />
          </Link>
          <Link to="/rules" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap ml-auto">
            Rules & Sources <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Market grid */}
      <div className="container py-6">
        {loading ? (
          <FeedSkeleton />
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
            <p className="text-muted-foreground font-display text-lg">{search ? "No markets match your search" : "No markets yet"}</p>
            <p className="text-sm text-muted-foreground mt-1">{search ? "Try a different search term" : "Markets are auto-created from upcoming events."}</p>
          </motion.div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto">
              <AnimatePresence mode="popLayout">
                {filtered.map((market, i) => (
                  <motion.div
                    key={market.id}
                    ref={i === filtered.length - 1 ? lastCardRef : undefined}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.3 }}
                    layout
                  >
                    <MarketCard
                      market={market}
                      matchTeams={(market as any).matches ? { home_team: (market as any).matches.home_team, away_team: (market as any).matches.away_team } : null}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {loadingMore && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
            {!hasMore && filtered.length > 0 && <p className="text-center text-xs text-muted-foreground py-6">All markets loaded</p>}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Feed;
