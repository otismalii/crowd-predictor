// Canonical football provider contract. Every external data source implements this.
// Adding a provider = one adapter file + one provider_connections row. Nothing else changes.

export type CanonicalMatchStatus = "upcoming" | "live" | "finished" | "postponed" | "cancelled";

export interface RawCompetition {
  external_id: string;
  name: string;
  country?: string | null;
  logo_url?: string | null;
  competition_type?: string | null;
}

export interface RawTeam {
  external_id?: string | null;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
  country?: string | null;
}

export interface RawFixture {
  external_id: string;
  competition: RawCompetition;
  season?: { external_id?: string | null; name: string } | null;
  home: RawTeam;
  away: RawTeam;
  kickoff_at: string;
  status: CanonicalMatchStatus;
  minute?: number | null;
  home_score?: number | null;
  away_score?: number | null;
  venue?: string | null;
  round?: string | null;
}

export interface RawMatchEvent {
  fixture_external_id: string;
  event_type: string;
  minute?: number | null;
  extra_minute?: number | null;
  team_external_id?: string | null;
  player_name?: string | null;
  related_player_name?: string | null;
  detail?: string | null;
}

export interface ProviderConnection {
  id: string;
  provider: string;
  display_name: string;
  base_url: string;
  secret_name: string | null;
  priority: number;
  is_enabled: boolean;
  rate_limit_per_min: number | null;
  config: Record<string, unknown>;
}

export interface FetchStats {
  requests: number;
  latency_ms: number;
}

export interface FootballProvider {
  readonly provider: string;
  listCompetitions(): Promise<RawCompetition[]>;
  listFixtures(opts?: { window?: "upcoming" | "recent" | "today" }): Promise<RawFixture[]>;
  getFixture(externalId: string): Promise<RawFixture | null>;
  listEvents(externalId: string): Promise<RawMatchEvent[]>;
  stats(): FetchStats;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
