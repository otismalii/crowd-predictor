import { useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/SEOHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatKES } from "@/lib/format";
import { fetchMySlips, fetchSlipLegs } from "@/services/sportsbookService";
import { selectionLabel, type BetSlip, type BetSlipLeg } from "@/types/sportsbook";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "secondary", won: "default", lost: "destructive", void: "outline", cancelled: "outline",
};

const MyBets = () => {
  const [tab, setTab] = useState<"open" | "settled">("open");
  const [slips, setSlips] = useState<BetSlip[]>([]);
  const [legs, setLegs] = useState<Record<string, BetSlipLeg[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMySlips(tab).then(async ({ data }) => {
      if (cancelled) return;
      setSlips(data);
      const { data: grouped } = await fetchSlipLegs(data.map((s) => s.id));
      if (!cancelled) {
        setLegs(grouped);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [tab]);

  return (
    <div className="min-h-screen bg-background pb-28">
      <SEOHead title="My Bets — Pagaza Sportsbook" description="Track your open and settled football bets, selections and payouts." />
      <Navbar />

      <main className="container max-w-2xl space-y-4 py-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">My bets</h1>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "open" | "settled")}>
          <TabsList className="w-full">
            <TabsTrigger value="open" className="flex-1">Open</TabsTrigger>
            <TabsTrigger value="settled" className="flex-1">Settled</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : slips.length === 0 ? (
          <p className="rounded-xl border border-border/60 bg-card/50 p-8 text-center text-sm text-muted-foreground">
            {tab === "open" ? "You have no open bets." : "No settled bets yet."}
          </p>
        ) : (
          <ul className="space-y-3">
            {slips.map((slip) => (
              <li key={slip.id} className="rounded-xl border border-border/60 bg-card/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {slip.slip_type === "acca" ? `${slip.selection_count}-fold accumulator` : "Single"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{formatDateTime(slip.created_at)}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[slip.status] ?? "outline"} className="uppercase">
                    {slip.status}
                  </Badge>
                </div>

                <ul className="mb-2 space-y-1.5">
                  {(legs[slip.id] ?? []).map((leg) => {
                    const home = leg.fixture?.home_team?.name ?? "Home";
                    const away = leg.fixture?.away_team?.name ?? "Away";
                    return (
                      <li key={leg.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/20 p-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {selectionLabel(leg.market, leg.selection, leg.line, home, away)}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">{home} v {away}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-sm font-bold tabular-nums">
                            {(leg.odds_snapshot ?? leg.odds).toFixed(2)}
                          </p>
                          <p className="text-[10px] uppercase text-muted-foreground">{leg.status}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex items-center justify-between border-t border-border/50 pt-2 text-sm">
                  <span className="text-muted-foreground">
                    Stake KES {formatKES(slip.stake)} @ {slip.combined_odds.toFixed(2)}
                  </span>
                  <span className="font-display font-bold tabular-nums text-primary">
                    {slip.status === "open"
                      ? `To return KES ${formatKES(slip.potential_payout)}`
                      : `Paid KES ${formatKES(slip.payout)}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MyBets;
