import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import FixtureCard from "@/components/sportsbook/FixtureCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Radio } from "lucide-react";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import {
  fetchCompetitions,
  fetchFixtures,
  fetchOddsForMatches,
  type FixtureWindow,
} from "@/services/sportsbookService";
import type { Fixture, MatchOdds } from "@/types/sportsbook";


const WINDOWS: { key: FixtureWindow; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "results", label: "Results" },
];

const Sportsbook = () => {
  const { competitionSlug } = useParams();
  const [window, setWindow] = useState<FixtureWindow>("today");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [odds, setOdds] = useState<MatchOdds[]>([]);
  const [competitions, setCompetitions] = useState<{ slug: string; name: string; short_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetchCompetitions().then(({ data }) => setCompetitions(data as any[]));
  }, []);

  // Scores, statuses and prices arrive live — no refresh needed.
  const subscriptions = useMemo(
    () => [
      { changes: { event: "*" as const, table: "platform_matches" }, callback: () => setTick((t) => t + 1) },
      { changes: { event: "*" as const, table: "match_odds" }, callback: () => setTick((t) => t + 1) },
    ],
    [],
  );
  useRealtimeChannel("sportsbook-board", subscriptions);

  useEffect(() => {
    let cancelled = false;
    if (tick === 0) setLoading(true);
    setError(null);

    fetchFixtures({ window, competitionSlug: competitionSlug ?? null, limit: 40 }).then(async (res) => {
      if (cancelled) return;
      if (res.error) setError(res.error);
      setFixtures(res.data);
      const { data: oddsRows } = await fetchOddsForMatches(res.data.map((f) => f.id));
      if (!cancelled) {
        setOdds(oddsRows);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [window, competitionSlug, tick]);


  const activeCompetition = competitions.find((c) => c.slug === competitionSlug);

  return (
    <div className="min-h-screen bg-background pb-28">
      <SEOHead
        title="Pagaza Sportsbook — Football Betting in Kenya"
        description="Bet on football with fixed odds: match result, totals, both teams to score and accumulators. Live scores, instant settlement, M-Pesa deposits."
      />
      <Navbar />

      <main className="container max-w-3xl space-y-4 py-4">
        <header className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {activeCompetition ? activeCompetition.name : "Football"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Fixed-odds betting on singles and accumulators. Odds update as the market moves.
          </p>
        </header>

        <Tabs value={window} onValueChange={(v) => setWindow(v as FixtureWindow)}>
          <TabsList className="w-full">
            {WINDOWS.map((w) => (
              <TabsTrigger key={w.key} value={w.key} className="flex-1 text-xs">
                {w.key === "live" && <Radio className="mr-1 h-3 w-3" />}
                {w.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {competitions.length > 0 && (
          <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <Button asChild size="sm" variant={competitionSlug ? "outline" : "secondary"} className="shrink-0 text-xs">
              <Link to="/sports">All</Link>
            </Button>
            {competitions.map((c) => (
              <Button
                key={c.slug}
                asChild
                size="sm"
                variant={competitionSlug === c.slug ? "secondary" : "outline"}
                className="shrink-0 text-xs"
              >
                <Link to={`/sports/${c.slug}`}>{c.short_name ?? c.name}</Link>
              </Button>
            ))}
          </nav>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </p>
        ) : fixtures.length === 0 ? (
          <p className="rounded-xl border border-border/60 bg-card/50 p-8 text-center text-sm text-muted-foreground">
            No fixtures in this view yet. Try another tab.
          </p>
        ) : (
          <section className="space-y-2">
            {fixtures.map((f) => (
              <FixtureCard key={f.id} fixture={f} odds={odds.filter((o) => o.match_id === f.id)} />
            ))}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Sportsbook;
