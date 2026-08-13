import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Radio } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import OddsButton from "./OddsButton";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { effectiveOdds, selectionLabel, type Fixture, type MatchOdds } from "@/types/sportsbook";

type Props = {
  fixture: Fixture;
  odds: MatchOdds[];
};

const FixtureCard = ({ fixture, odds }: Props) => {
  const { toggleSelection, has } = useBetSlip();
  const home = fixture.home_team?.name ?? "Home";
  const away = fixture.away_team?.name ?? "Away";
  const isLive = fixture.status === "live";
  const isFinished = fixture.status === "finished";

  const result = ["home", "draw", "away"].map((sel) =>
    odds.find((o) => o.market === "1x2" && o.selection === sel) ?? null,
  );
  const marketCount = new Set(odds.map((o) => `${o.market}${o.line ?? ""}`)).size;

  return (
    <article className="rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm transition-colors hover:border-primary/40">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">
          {fixture.competition?.short_name ?? fixture.competition?.name ?? "Football"}
        </span>
        {isLive ? (
          <Badge variant="destructive" className="h-5 gap-1 px-1.5 text-[10px]">
            <Radio className="h-2.5 w-2.5 animate-pulse" />
            {fixture.minute ? `${fixture.minute}'` : "LIVE"}
          </Badge>
        ) : (
          <span className="shrink-0 tabular-nums">{formatDateTime(fixture.kickoff_at)}</span>
        )}
      </div>

      <Link to={`/match/${fixture.id}`} className="group block">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold group-hover:text-primary">{home}</p>
            <p className="truncate text-sm font-semibold group-hover:text-primary">{away}</p>
          </div>
          <div className="flex items-center gap-2">
            {(isLive || isFinished) && (
              <div className="space-y-1 text-right font-display text-sm font-bold tabular-nums">
                <p>{fixture.home_score ?? 0}</p>
                <p>{fixture.away_score ?? 0}</p>
              </div>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </div>
      </Link>

      {result.some(Boolean) && (
        <div className="mt-3 flex items-stretch gap-1.5">
          {result.map((o, i) => {
            const sel = (["home", "draw", "away"] as const)[i];
            return (
              <OddsButton
                key={sel}
                label={selectionLabel("1x2", sel, null, fixture.home_team?.short_name ?? home, fixture.away_team?.short_name ?? away)}
                odds={o ? effectiveOdds(o) : null}
                suspended={o?.is_suspended || fixture.status !== "upcoming"}
                active={has(fixture.id, "1x2", sel, null)}
                onClick={() =>
                  o &&
                  toggleSelection({
                    matchId: fixture.id,
                    market: "1x2",
                    selection: sel,
                    line: null,
                    odds: effectiveOdds(o),
                    matchLabel: `${home} v ${away}`,
                    marketLabel: "Match Result",
                    selectionLabel: selectionLabel("1x2", sel, null, home, away),
                    kickoffAt: fixture.kickoff_at,
                  })
                }
              />
            );
          })}
          {marketCount > 1 && (
            <Link
              to={`/match/${fixture.id}`}
              className="flex shrink-0 items-center rounded-lg border border-border/60 bg-muted/30 px-2 text-[11px] font-medium text-muted-foreground hover:border-primary/50 hover:text-primary"
            >
              +{marketCount - 1}
            </Link>
          )}
        </div>
      )}
    </article>
  );
};

export default FixtureCard;
