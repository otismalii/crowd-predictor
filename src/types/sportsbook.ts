export type MatchStatus = "upcoming" | "live" | "finished" | "postponed" | "cancelled";

export type TeamRef = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
};

export type CompetitionRef = {
  id: string;
  name: string;
  short_name: string | null;
  slug: string;
  country: string | null;
  logo_url: string | null;
};

export type Fixture = {
  id: string;
  kickoff_at: string;
  status: MatchStatus;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  round: string | null;
  home_team: TeamRef | null;
  away_team: TeamRef | null;
  competition: CompetitionRef | null;
};

export type MarketDefinition = {
  key: string;
  display_name: string;
  description: string | null;
  supports_line: boolean;
  selections: string[];
  sort_order: number;
  enabled: boolean;
};

export type MatchOdds = {
  id: string;
  match_id: string;
  market: string;
  selection: string;
  line: number | null;
  probability: number | null;
  generated_odds: number;
  override_odds: number | null;
  is_suspended: boolean;
  margin_bps: number;
};

export type SlipSelection = {
  matchId: string;
  market: string;
  selection: string;
  line: number | null;
  odds: number;
  /** Denormalised for display so the slip survives navigation. */
  matchLabel: string;
  marketLabel: string;
  selectionLabel: string;
  kickoffAt: string;
};

export type BetSlip = {
  id: string;
  slip_type: "single" | "acca";
  stake: number;
  combined_odds: number;
  potential_payout: number;
  selection_count: number;
  status: "open" | "won" | "lost" | "void" | "cancelled";
  payout: number;
  created_at: string;
  settled_at: string | null;
};

export type BetSlipLeg = {
  id: string;
  match_id: string;
  market: string;
  selection: string;
  line: number | null;
  odds_snapshot: number | null;
  odds: number;
  status: string;
  fixture?: Fixture | null;
};

/** Effective price for a selection: an admin override always wins. */
export const effectiveOdds = (o: Pick<MatchOdds, "generated_odds" | "override_odds">) =>
  o.override_odds ?? o.generated_odds;

export const MARKET_LABELS: Record<string, string> = {
  "1x2": "Match Result",
  double_chance: "Double Chance",
  over_under: "Total Goals",
  btts: "Both Teams To Score",
  correct_score: "Correct Score",
};

export function selectionLabel(
  market: string,
  selection: string,
  line: number | null,
  home?: string | null,
  away?: string | null,
): string {
  switch (market) {
    case "1x2":
      if (selection === "home") return home ?? "Home";
      if (selection === "away") return away ?? "Away";
      return "Draw";
    case "double_chance":
      if (selection === "1x") return `${home ?? "Home"} or Draw`;
      if (selection === "12") return `${home ?? "Home"} or ${away ?? "Away"}`;
      return `Draw or ${away ?? "Away"}`;
    case "over_under":
      return `${selection === "over" ? "Over" : "Under"} ${line ?? ""}`.trim();
    case "btts":
      return selection === "yes" ? "Yes" : "No";
    case "correct_score":
      return selection;
    default:
      return selection;
  }
}
