import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Radio } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import OddsButton from "./OddsButton";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { effectiveOdds, selectionLabel, MARKET_LABELS, type Fixture, type MatchOdds } from "@/types/sportsbook";
import TeamCrest from "./TeamCrest";

export type QuickMarket = "1x2" | "double_chance" | "over_under" | "btts";

const QUICK_SELECTIONS: Record<QuickMarket, string[]> = {
  "1x2": ["home", "draw", "away"],
  double_chance: ["1x", "12", "x2"],
  over_under: ["over", "under"],
  btts: ["yes", "no"],
};

type Props = {
  fixture: Fixture;
  odds: MatchOdds[];
  market?: QuickMarket;
};

const FixtureCard = ({ fixture, odds, market = "1x2" }: Props) => {
  const { toggleSelection, has } = useBetSlip();
  const home = fixture.home_team?.name ?? "Home";
  const away = fixture.away_team?.name ?? "Away";
  const isLive = fixture.status === "live";
  const isFinished = fixture.status === "finished";

  const ouLines = odds.filter((o) => o.market === "over_under").map((o) => o.line ?? 0);
  const line = market === "over_under"
    ? (ouLines.includes(2.5) ? 2.5 : ouLines.sort((a, b) => a - b)[0] ?? null)
    : null;
  const sels = QUICK_SELECTIONS[market];
  const result = sels.map((sel) =>
    odds.find((o) => o.market === market && o.selection === sel && (line === null || o.line === line)) ?? null,
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
            <p className="flex items-center gap-2 truncate text-sm font-semibold group-hover:text-primary">
              <TeamCrest name={home} logoUrl={fixture.home_team?.logo_url} />
              <span className="truncate">{home}</span>
            </p>
            <p className="flex items-center gap-2 truncate text-sm font-semibold group-hover:text-primary">
              <TeamCrest name={away} logoUrl={fixture.away_team?.logo_url} />
              <span className="truncate">{away}</span>
            </p>
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
            const sel = sels[i];
            const hs = fixture.home_team?.short_name ?? home;
            const as = fixture.away_team?.short_name ?? away;
            const shortLabel = market === "double_chance" ? sel.toUpperCase() : selectionLabel(market, sel, line, hs, as);
            return (
              <OddsButton
                key={sel}
                label={shortLabel}
                odds={o ? effectiveOdds(o) : null}
                suspended={o?.is_suspended || fixture.status !== "upcoming"}
                active={has(fixture.id, market, sel, line)}
                onClick={() =>
                  o &&
                  toggleSelection({
                    matchId: fixture.id,
                    market,
                    selection: sel,
                    line,
                    odds: effectiveOdds(o),
                    matchLabel: `${home} v ${away}`,
                    marketLabel: MARKET_LABELS[market] ?? market,
                    selectionLabel: selectionLabel(market, sel, line, home, away),
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
