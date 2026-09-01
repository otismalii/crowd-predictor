// football-data.org v4 adapter — primary real-time source.
// Free tier: 10 requests/minute, 12 competitions, no in-match timeline.
// One /matches call covers every configured competition for a date range,
// so a full refresh normally costs 1-3 requests.
import type {
  CanonicalMatchStatus,
  FetchStats,
  FootballProvider,
  ProviderConnection,
  RawCompetition,
  RawFixture,
  RawMatchEvent,
} from "./types.ts";

const DEFAULT_COMPETITIONS = ["PL", "ELC", "BL1", "SA", "PD", "FL1", "DED", "PPL", "BSA", "CL"];
const MIN_REQUEST_GAP_MS = 6_500; // stay under 10 req/min

function mapStatus(status: string | null): CanonicalMatchStatus {
  switch ((status ?? "").toUpperCase()) {
    case "IN_PLAY":
    case "PAUSED":
      return "live";
    case "FINISHED":
    case "AWARDED":
      return "finished";
    case "POSTPONED":
    case "SUSPENDED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "upcoming";
  }
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class FootballDataProvider implements FootballProvider {
  readonly provider = "footballdata";
  private base: string;
  private token: string;
  private competitions: string[];
  private budget: number;
  private requests = 0;
  private latency = 0;
  private lastRequestAt = 0;

  constructor(connection: ProviderConnection, token: string) {
    this.base = connection.base_url.replace(/\/+$/, "");
    this.token = token;
    const configured = (connection.config?.competitions as string[] | undefined) ?? DEFAULT_COMPETITIONS;
    this.competitions = Array.isArray(configured) && configured.length ? configured : DEFAULT_COMPETITIONS;
    this.budget = Number(connection.config?.request_budget ?? 8);
  }

  stats(): FetchStats {
    return { requests: this.requests, latency_ms: Math.round(this.latency) };
  }

  private async get(path: string): Promise<any | null> {
    if (this.requests >= this.budget) {
      console.log(`[footballdata] request budget (${this.budget}) exhausted, skipping ${path}`);
      return null;
    }

    // client-side rate limiting: never exceed the free-tier cadence
    const wait = MIN_REQUEST_GAP_MS - (Date.now() - this.lastRequestAt);
    if (this.lastRequestAt && wait > 0) await new Promise((r) => setTimeout(r, wait));

    const started = performance.now();
    this.requests += 1;
    this.lastRequestAt = Date.now();
    try {
      const res = await fetch(`${this.base}${path}`, { headers: { "X-Auth-Token": this.token } });
      const text = await res.text();
      this.latency += performance.now() - started;
      if (res.status === 429) {
        console.log(`[footballdata] rate limited on ${path}`);
        return null;
      }
      if (!res.ok) {
        console.log(`[footballdata] ${res.status} ${path}: ${text.slice(0, 200)}`);
        return null;
      }
      return JSON.parse(text);
    } catch (e) {
      this.latency += performance.now() - started;
      console.log(`[footballdata] fetch error ${path}: ${e}`);
      return null;
    }
  }

  async listCompetitions(): Promise<RawCompetition[]> {
    const res = await this.get(`/competitions?code=${this.competitions.join(",")}`);
    return ((res?.competitions ?? []) as any[]).map((c) => ({
      external_id: String(c.id),
      name: c.name,
      country: c.area?.name ?? null,
      logo_url: c.emblem ?? null,
      competition_type: (c.type ?? "LEAGUE").toLowerCase(),
    }));
  }

  private toFixture(m: any): RawFixture | null {
    if (!m?.id || !m?.utcDate) return null;
    const score = m.score?.fullTime ?? {};
    return {
      external_id: String(m.id),
      competition: {
        external_id: String(m.competition?.id ?? m.competition?.code ?? "unknown"),
        name: m.competition?.name ?? "Football",
        country: m.area?.name ?? m.competition?.area?.name ?? null,
        logo_url: m.competition?.emblem ?? null,
      },
      season: m.season?.id
        ? { external_id: String(m.season.id), name: `${String(m.season.startDate ?? "").slice(0, 4)}` }
        : null,
      home: {
        external_id: m.homeTeam?.id ? String(m.homeTeam.id) : null,
        name: m.homeTeam?.name ?? m.homeTeam?.shortName ?? "TBD",
        short_name: m.homeTeam?.tla ?? m.homeTeam?.shortName ?? null,
        logo_url: m.homeTeam?.crest ?? null,
      },
      away: {
        external_id: m.awayTeam?.id ? String(m.awayTeam.id) : null,
        name: m.awayTeam?.name ?? m.awayTeam?.shortName ?? "TBD",
        short_name: m.awayTeam?.tla ?? m.awayTeam?.shortName ?? null,
        logo_url: m.awayTeam?.crest ?? null,
      },
      kickoff_at: m.utcDate,
      status: mapStatus(m.status),
      minute: m.minute ?? null,
      home_score: typeof score.home === "number" ? score.home : null,
      away_score: typeof score.away === "number" ? score.away : null,
      venue: m.venue ?? null,
      round: m.matchday ? String(m.matchday) : null,
    };
  }

  async listFixtures(opts?: { window?: "upcoming" | "recent" | "today" }): Promise<RawFixture[]> {
    const comps = this.competitions.join(",");
    const now = new Date();
    const seen = new Set<string>();
    const out: RawFixture[] = [];

    const push = (rows: any[]) => {
      for (const m of rows ?? []) {
        const f = this.toFixture(m);
        if (!f || seen.has(f.external_id)) continue;
        seen.add(f.external_id);
        out.push(f);
      }
    };

    const range = async (from: Date, to: Date) => {
      const res = await this.get(`/matches?competitions=${comps}&dateFrom=${ymd(from)}&dateTo=${ymd(to)}`);
      push(res?.matches ?? []);
    };

    if (opts?.window === "today") {
      // in-play first (cheap, authoritative), then the whole day either side of UTC midnight
      const live = await this.get(`/matches?competitions=${comps}&status=IN_PLAY,PAUSED`);
      push(live?.matches ?? []);
      await range(new Date(now.getTime() - 24 * 3600_000), new Date(now.getTime() + 24 * 3600_000));
    } else if (opts?.window === "recent") {
      await range(new Date(now.getTime() - 4 * 24 * 3600_000), now);
    } else if (opts?.window === "upcoming") {
      await range(now, new Date(now.getTime() + 10 * 24 * 3600_000));
    } else {
      await range(new Date(now.getTime() - 4 * 24 * 3600_000), new Date(now.getTime() + 10 * 24 * 3600_000));
    }

    return out;
  }

  async getFixture(externalId: string): Promise<RawFixture | null> {
    const res = await this.get(`/matches/${encodeURIComponent(externalId)}`);
    return this.toFixture(res?.match ?? res);
  }

  // Free tier exposes no in-match timeline; sync-live falls back to score deltas.
  async listEvents(_externalId: string): Promise<RawMatchEvent[]> {
    return [];
  }
}
