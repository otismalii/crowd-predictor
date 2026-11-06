// Two sports feeds deliver the same match under different team/competition names
// (e.g. "Everton FC" vs "Everton"). Collapse them to one fixture for display.

const SUFFIXES = /\b(fc|cf|afc|sc|ac|bc|sk|fk|cfc|sv|ud|calcio|1913|1963|clube de|de madrid|tilburg|rotterdam)\b/g;
const ALIASES: Record<string, string> = {
  "heart of midlothian": "hearts",
  "athletic club": "athletic bilbao",
  "hamburger": "hamburg",
  "sporting portugal": "sporting cp",
};

export function normalizeTeam(name?: string | null): string {
  let n = (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(SUFFIXES, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ALIASES[n] ?? n;
}

const STATUS_RANK: Record<string, number> = { live: 4, finished: 3, upcoming: 2, postponed: 1 };

type Dedupable = {
  id: string;
  kickoff_at: string;
  status: string;
  home_team?: { name?: string | null } | null;
  away_team?: { name?: string | null } | null;
};

export function fixtureKey(f: Dedupable): string {
  return `${normalizeTeam(f.home_team?.name)}|${normalizeTeam(f.away_team?.name)}|${(f.kickoff_at ?? "").slice(0, 10)}`;
}

/** Keeps one fixture per match, preferring live > finished > upcoming > postponed. Preserves input order. */
export function dedupeFixtures<T extends Dedupable>(list: T[]): T[] {
  const best = new Map<string, T>();
  for (const f of list) {
    if (!f.home_team?.name || !f.away_team?.name) { best.set(`id:${f.id}`, f); continue; }
    const k = fixtureKey(f);
    const cur = best.get(k);
    if (!cur || (STATUS_RANK[f.status] ?? 0) > (STATUS_RANK[cur.status] ?? 0)) best.set(k, f);
  }
  const keep = new Set([...best.values()].map((f) => f.id));
  return list.filter((f) => keep.has(f.id));
}
