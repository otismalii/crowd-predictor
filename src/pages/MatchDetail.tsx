import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import MarketBoard from "@/components/sportsbook/MarketBoard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Radio } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { fetchFixture, fetchMarketDefinitions, fetchOddsForMatches } from "@/services/sportsbookService";
import type { Fixture, MarketDefinition, MatchOdds } from "@/types/sportsbook";

const MatchDetail = () => {
  const { id } = useParams();
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [odds, setOdds] = useState<MatchOdds[]>([]);
  const [markets, setMarkets] = useState<MarketDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchFixture(id), fetchOddsForMatches([id]), fetchMarketDefinitions()]).then(
      ([f, o, m]) => {
        if (cancelled) return;
        setFixture(f.data);
        setOdds(o.data);
        setMarkets(m.data);
        setLoading(false);
      },
    );
    return () => { cancelled = true; };
  }, [id]);

  const home = fixture?.home_team?.name ?? "Home";
  const away = fixture?.away_team?.name ?? "Away";

  return (
    <div className="min-h-screen bg-background pb-28">
      <SEOHead
        title={fixture ? `${home} v ${away} — Odds & Betting` : "Match — Pagaza Sportsbook"}
        description={
          fixture
            ? `Bet on ${home} v ${away}: match result, double chance, total goals, both teams to score and correct score odds.`
            : "Football match odds and betting markets."
        }
      />
      <Navbar />

      <main className="container max-w-2xl space-y-4 py-4">
        <Link to="/sports" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All fixtures
        </Link>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : !fixture ? (
          <p className="rounded-xl border border-border/60 bg-card/50 p-8 text-center text-sm text-muted-foreground">
            That match could not be found.
          </p>
        ) : (
          <>
            <section className="rounded-xl border border-border/60 bg-card/60 p-4">
              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{fixture.competition?.name ?? "Football"}</span>
                {fixture.status === "live" ? (
                  <Badge variant="destructive" className="h-5 gap-1 px-1.5 text-[10px]">
                    <Radio className="h-2.5 w-2.5 animate-pulse" />
                    {fixture.minute ? `${fixture.minute}'` : "LIVE"}
                  </Badge>
                ) : (
                  <span className="tabular-nums">{formatDateTime(fixture.kickoff_at)}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <h1 className="font-display text-lg font-bold leading-tight">
                  {home} <span className="text-muted-foreground">v</span> {away}
                </h1>
                {(fixture.status === "live" || fixture.status === "finished") && (
                  <span className="font-display text-2xl font-bold tabular-nums">
                    {fixture.home_score ?? 0}–{fixture.away_score ?? 0}
                  </span>
                )}
              </div>
              {fixture.venue && <p className="mt-1 text-xs text-muted-foreground">{fixture.venue}</p>}
            </section>

            <MarketBoard fixture={fixture} odds={odds} markets={markets} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MatchDetail;
