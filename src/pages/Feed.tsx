import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { LogIn, TrendingUp, Search, BarChart3, Flame, Clock } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MarketCard from "@/components/MarketCard";
import type { Market, MarketOutcome } from "@/components/MarketCard";
import { motion, AnimatePresence } from "framer-motion";

const Feed = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"trending" | "newest" | "closing">("trending");

  useEffect(() => {
    fetchMarkets().then(() => setLoading(false));

    const channel = supabase
      .channel("feed-markets")
      .on("postgres_changes", { event: "*", schema: "public", table: "markets" }, () => fetchMarkets())
      .on("postgres_changes", { event: "*", schema: "public", table: "market_outcomes" }, () => fetchMarkets())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchMarkets = async () => {
    const { data: marketsData } = await supabase
      .from("markets")
      .select("*, matches(home_team, away_team, league, kickoff)")
      .in("status", ["open", "closed"])
      .order("created_at", { ascending: false })
      .limit(60) as any;

    if (marketsData) {
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

      setMarkets(marketsData.map((m: any) => ({
        ...m,
        outcomes: outcomesByMarket[m.id] || [],
      })));
    }
  };

  const filtered = useMemo(() => {
    let list = markets;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q) ||
        (m as any).matches?.league?.toLowerCase().includes(q)
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
  }, [markets, search, sort]);

  const totalVolume = markets.reduce((s, m) => s + m.total_volume, 0);
  const openCount = markets.filter(m => m.status === "open").length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Compact hero */}
      <div className="border-b border-border/30 bg-card/30">
        <div className="container py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider text-foreground">
                Prediction Markets
              </h1>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  <strong className="text-primary">{openCount}</strong> open
                </span>
                <span className="h-3 w-px bg-border" />
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-accent" />
                  <strong className="text-accent">{Math.round(totalVolume).toLocaleString()}</strong> KES volume
                </span>
              </div>
            </div>
            {!user && (
              <Button onClick={() => navigate("/auth")} size="sm" className="neon-glow">
                <LogIn className="h-4 w-4 mr-1.5" /> Sign In to Trade
              </Button>
            )}
          </div>

          {/* Search + Sort */}
          <div className="flex items-center gap-3 mt-5">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search markets..."
                className="pl-9 h-9 bg-background/50"
              />
            </div>
            <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg border border-border/30">
              {([
                { key: "trending" as const, label: "Trending", icon: Flame },
                { key: "newest" as const, label: "New", icon: BarChart3 },
                { key: "closing" as const, label: "Closing Soon", icon: Clock },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    sort === key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Market grid */}
      <div className="container py-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
            <p className="text-muted-foreground font-display text-lg">
              {search ? "No markets match your search" : "No markets yet"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Try a different search term" : "Markets are auto-created from upcoming matches."}
            </p>
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
                  transition={{ delay: i * 0.02 }}
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

export default Feed;
