import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import OddsButton from "./OddsButton";
import { useBetSlip } from "@/contexts/BetSlipContext";
import {
  effectiveOdds,
  selectionLabel,
  MARKET_LABELS,
  type Fixture,
  type MarketDefinition,
  type MatchOdds,
} from "@/types/sportsbook";

type Props = {
  fixture: Fixture;
  odds: MatchOdds[];
  markets: MarketDefinition[];
};

/** Groups odds into betting blocks — one block per market, split per line where lines apply. */
const MarketBoard = ({ fixture, odds, markets }: Props) => {
  const { toggleSelection, has } = useBetSlip();
  const home = fixture.home_team?.name ?? "Home";
  const away = fixture.away_team?.name ?? "Away";
  const bettable = fixture.status === "upcoming";

  const blocks = markets
    .map((market) => {
      const rows = odds.filter((o) => o.market === market.key);
      if (rows.length === 0) return null;
      const lines = Array.from(new Set(rows.map((r) => r.line))).sort((a, b) => (a ?? 0) - (b ?? 0));
      return { market, lines, rows };
    })
    .filter(Boolean) as { market: MarketDefinition; lines: (number | null)[]; rows: MatchOdds[] }[];

  if (blocks.length === 0) {
    return (
      <p className="rounded-xl border border-border/60 bg-card/50 p-6 text-center text-sm text-muted-foreground">
        Odds for this match are not published yet. Check back shortly.
      </p>
    );
  }

  return (
    <Accordion type="multiple" defaultValue={blocks.slice(0, 3).map((b) => b.market.key)} className="space-y-2">
      {blocks.map(({ market, lines, rows }) => (
        <AccordionItem
          key={market.key}
          value={market.key}
          className="overflow-hidden rounded-xl border border-border/60 bg-card/60"
        >
          <AccordionTrigger className="px-3 py-3 text-sm font-semibold hover:no-underline">
            {MARKET_LABELS[market.key] ?? market.display_name}
          </AccordionTrigger>
          <AccordionContent className="space-y-2 px-3 pb-3">
            {lines.map((line) => {
              const lineRows = rows
                .filter((r) => r.line === line)
                .sort((a, b) => a.selection.localeCompare(b.selection));
              return (
                <div key={String(line)} className="space-y-1.5">
                  {line !== null && (
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Line {line}</p>
                  )}
                  <div className={market.key === "correct_score" ? "grid grid-cols-4 gap-1.5" : "flex gap-1.5"}>
                    {lineRows.map((o) => {
                      const label = selectionLabel(
                        o.market,
                        o.selection,
                        o.line,
                        fixture.home_team?.short_name ?? home,
                        fixture.away_team?.short_name ?? away,
                      );
                      return (
                        <OddsButton
                          key={o.id}
                          label={label}
                          odds={effectiveOdds(o)}
                          suspended={o.is_suspended || !bettable}
                          active={has(fixture.id, o.market, o.selection, o.line)}
                          onClick={() =>
                            toggleSelection({
                              matchId: fixture.id,
                              market: o.market,
                              selection: o.selection,
                              line: o.line,
                              odds: effectiveOdds(o),
                              matchLabel: `${home} v ${away}`,
                              marketLabel: MARKET_LABELS[o.market] ?? market.display_name,
                              selectionLabel: selectionLabel(o.market, o.selection, o.line, home, away),
                              kickoffAt: fixture.kickoff_at,
                            })
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default MarketBoard;
