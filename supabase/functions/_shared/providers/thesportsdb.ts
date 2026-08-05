// TheSportsDB adapter — the football source already in use by this platform.
import type {
  CanonicalMatchStatus,
  FetchStats,
  FootballProvider,
  ProviderConnection,
  RawCompetition,
  RawFixture,
  RawMatchEvent,
} from "./types.ts";

const DEFAULT_LEAGUES = [4328, 4335, 4332, 4331, 4334, 4337, 4344, 4359, 4346, 4330, 4481];

function mapStatus(status: string | null, home: number | null, away: number | null): CanonicalMatchStatus {
  if (!status || status === "Not Started" || status === "NS") {
    return home !== null && away !== null ? "finished" : "upcoming";
  }
  if (["Match Finished", "FT", "AET", "AP"].includes(status)) return "finished";
  if (["Postponed", "PST"].includes(status)) return "postponed";
  if (["Cancelled", "CANC"].includes(status)) return "cancelled";
  if (["1H", "2H", "HT", "ET", "Live", "P"].includes(status)) return "live";
  if (home !== null && away !== null) return "finished";
  return "upcoming";
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export class TheSportsDbProvider implements FootballProvider {
  readonly provider = "thesportsdb";
  private base: string;
  private leagues: number[];
  private requests = 0;
  private latency = 0;

  constructor(connection: ProviderConnection, apiKey: string) {
    this.base = `${connection.base_url.replace(/\/+$/, "")}/${apiKey}`;
    const configured = (connection.config?.leagues as number[] | undefined) ?? DEFAULT_LEAGUES;
    this.leagues = Array.isArray(configured) && configured.length ? configured : DEFAULT_LEAGUES;
  }

  stats(): FetchStats {
    return { requests: this.requests, latency_ms: Math.round(this.latency) };
  }

  private async get(path: string): Promise<any | null> {
    const started = performance.now();
    this.requests += 1;
    try {
      const res = await fetch(`${this.base}${path}`);
      const text = await res.text();
      this.latency += performance.now() - started;
      if (!res.ok) {
        console.log(`[thesportsdb] ${res.status} ${path}: ${text.slice(0, 160)}`);
        return null;
      }
      return JSON.parse(text);
    } catch (e) {
      this.latency += performance.now() - started;
      console.log(`[thesportsdb] fetch error ${path}: ${e}`);
      return null;
    }
  }

  async listCompetitions(): Promise<RawCompetition[]> {
    const out: RawCompetition[] = [];
    for (const id of this.leagues) {
      const res = await this.get(`/lookupleague.php?id=${id}`);
      const league = res?.leagues?.[0];
      if (!league) continue;
      out.push({
        external_id: String(league.idLeague ?? id),
        name: league.strLeague ?? `League ${id}`,
        country: league.strCountry ?? null,
        logo_url: league.strBadge ?? league.strLogo ?? null,
        competition_type: league.strSport === "Soccer" ? "league" : "league",
      });
    }
    return out;
  }

  private toFixture(ev: any): RawFixture | null {
    if (!ev?.idEvent) return null;
    const home = num(ev.intHomeScore);
    const away = num(ev.intAwayScore);
    const kickoff = ev.strTimestamp || `${ev.dateEvent}T${ev.strTime || "00:00:00"}+00:00`;
    if (!kickoff || kickoff.startsWith("null")) return null;
    return {
      external_id: String(ev.idEvent),
      competition: {
        external_id: String(ev.idLeague ?? ev.strLeague ?? "unknown"),
        name: ev.strLeague || "Unknown",
        country: ev.strCountry ?? null,
      },
      season: ev.strSeason ? { external_id: ev.strSeason, name: ev.strSeason } : null,
      home: { external_id: ev.idHomeTeam ? String(ev.idHomeTeam) : null, name: ev.strHomeTeam || "TBD" },
      away: { external_id: ev.idAwayTeam ? String(ev.idAwayTeam) : null, name: ev.strAwayTeam || "TBD" },
      kickoff_at: kickoff,
      status: mapStatus(ev.strStatus ?? null, home, away),
      minute: num(ev.strProgress),
      home_score: home,
      away_score: away,
      venue: ev.strVenue ?? null,
      round: ev.intRound ? String(ev.intRound) : null,
    };
  }

  async listFixtures(opts?: { window?: "upcoming" | "recent" | "today" }): Promise<RawFixture[]> {
    const window = opts?.window;
    const seen = new Set<string>();
    const out: RawFixture[] = [];
    const push = (events: any[]) => {
      for (const ev of events ?? []) {
        const fixture = this.toFixture(ev);
        if (!fixture || seen.has(fixture.external_id)) continue;
        seen.add(fixture.external_id);
        out.push(fixture);
      }
    };

    if (!window || window === "upcoming") {
      for (const id of this.leagues) push((await this.get(`/eventsnextleague.php?id=${id}`))?.events ?? []);
    }
    if (!window || window === "recent") {
      for (const id of this.leagues) push((await this.get(`/eventspastleague.php?id=${id}`))?.events ?? []);
    }
    if (!window || window === "today") {
      const today = new Date().toISOString().split("T")[0];
      push((await this.get(`/eventsday.php?d=${today}&s=Soccer`))?.events ?? []);
    }
    return out;
  }

  async getFixture(externalId: string): Promise<RawFixture | null> {
    const res = await this.get(`/lookupevent.php?id=${encodeURIComponent(externalId)}`);
    return this.toFixture(res?.events?.[0]);
  }

  async listEvents(externalId: string): Promise<RawMatchEvent[]> {
    const res = await this.get(`/lookuptimeline.php?id=${encodeURIComponent(externalId)}`);
    const timeline = res?.timeline ?? [];
    if (!Array.isArray(timeline)) return [];
    return timeline.map((t: any) => ({
      fixture_external_id: externalId,
      event_type: String(t.strTimeline ?? "unknown").toLowerCase(),
      minute: num(t.intTime),
      team_external_id: t.idTeam ? String(t.idTeam) : null,
      player_name: t.strPlayer ?? null,
      related_player_name: t.strAssist ?? null,
      detail: t.strTimelineDetail ?? null,
    }));
  }
}
