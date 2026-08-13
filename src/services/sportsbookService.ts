import { supabase } from "@/integrations/supabase/client";
import { safeFetch } from "@/lib/api";
import type {
  BetSlip,
  BetSlipLeg,
  Fixture,
  MarketDefinition,
  MatchOdds,
  SlipSelection,
} from "@/types/sportsbook";

const FIXTURE_SELECT = `
  id, kickoff_at, status, minute, home_score, away_score, venue, round,
  home_team:teams!platform_matches_home_team_id_fkey (id, name, short_name, logo_url),
  away_team:teams!platform_matches_away_team_id_fkey (id, name, short_name, logo_url),
  competition:competitions (id, name, short_name, slug, country, logo_url)
`;

export type FixtureWindow = "live" | "today" | "upcoming" | "results";

export async function fetchFixtures(opts: {
  window?: FixtureWindow;
  competitionSlug?: string | null;
  limit?: number;
} = {}): Promise<{ data: Fixture[]; error: string | null }> {
  const { window = "upcoming", competitionSlug, limit = 40 } = opts;

  let query = supabase.from("platform_matches").select(FIXTURE_SELECT);

  const now = new Date();
  if (window === "live") {
    query = query.eq("status", "live").order("kickoff_at", { ascending: true });
  } else if (window === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    query = query
      .in("status", ["upcoming", "live"])
      .lte("kickoff_at", end.toISOString())
      .order("kickoff_at", { ascending: true });
  } else if (window === "results") {
    query = query.eq("status", "finished").order("kickoff_at", { ascending: false });
  } else {
    query = query
      .eq("status", "upcoming")
      .gt("kickoff_at", now.toISOString())
      .order("kickoff_at", { ascending: true });
  }

  if (competitionSlug) {
    const { data: comp } = await supabase
      .from("competitions").select("id").eq("slug", competitionSlug).maybeSingle();
    if (comp?.id) query = query.eq("competition_id", comp.id);
  }

  const { data, error } = await safeFetch<any[]>(query.limit(limit));
  return { data: (data ?? []) as Fixture[], error };
}

export async function fetchFixture(id: string) {
  const { data, error } = await safeFetch<any>(
    supabase.from("platform_matches").select(FIXTURE_SELECT).eq("id", id).maybeSingle(),
  );
  return { data: (data ?? null) as Fixture | null, error };
}

export async function fetchCompetitions() {
  const { data, error } = await safeFetch<any[]>(
    supabase.from("competitions").select("id, name, short_name, slug, country, logo_url")
      .eq("is_active", true).order("tier", { ascending: true }).limit(40),
  );
  return { data: data ?? [], error };
}

export async function fetchMarketDefinitions() {
  const { data, error } = await safeFetch<any[]>(
    supabase.from("bet_markets").select("*").eq("enabled", true).order("sort_order"),
  );
  return { data: (data ?? []) as MarketDefinition[], error };
}

export async function fetchOddsForMatches(matchIds: string[]) {
  if (matchIds.length === 0) return { data: [] as MatchOdds[], error: null };
  const { data, error } = await safeFetch<any[]>(
    supabase.from("match_odds").select("*").in("match_id", matchIds),
  );
  return { data: (data ?? []) as MatchOdds[], error };
}

export async function fetchNews(limit = 8) {
  const { data, error } = await safeFetch<any[]>(
    supabase.from("news_items").select("id, title, summary, source, url, published_at, image_url")
      .order("published_at", { ascending: false }).limit(limit),
  );
  return { data: data ?? [], error };
}

export async function placeBet(input: {
  selections: SlipSelection[];
  stake: number;
  idempotencyKey: string;
}): Promise<{ data: { slip_id: string; combined_odds: number; potential_payout: number } | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("place-bet", {
    body: {
      stake: input.stake,
      slip_type: input.selections.length > 1 ? "acca" : "single",
      idempotency_key: input.idempotencyKey,
      selections: input.selections.map((s) => ({
        match_id: s.matchId,
        market: s.market,
        selection: s.selection,
        line: s.line,
      })),
    },
  });

  if (error) {
    // Edge function errors carry the readable message in the response body.
    let message = error.message ?? "Could not place bet";
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        message = body?.message ?? body?.error ?? message;
      }
    } catch { /* keep the fallback message */ }
    return { data: null, error: message };
  }
  if (data?.error) return { data: null, error: data.message ?? data.error };
  return { data, error: null };
}

export async function fetchMySlips(status: "open" | "settled") {
  const statuses = status === "open" ? ["open"] : ["won", "lost", "void", "cancelled"];
  const { data, error } = await safeFetch<any[]>(
    supabase.from("bet_slips").select("*").in("status", statuses)
      .order("created_at", { ascending: false }).limit(50),
  );
  return { data: (data ?? []) as BetSlip[], error };
}

export async function fetchSlipLegs(slipIds: string[]) {
  if (slipIds.length === 0) return { data: {} as Record<string, BetSlipLeg[]>, error: null };
  const { data, error } = await safeFetch<any[]>(
    supabase.from("match_bets")
      .select(`id, slip_id, match_id, market, selection, line, odds, odds_snapshot, status,
        fixture:platform_matches (${FIXTURE_SELECT})`)
      .in("slip_id", slipIds),
  );
  const grouped: Record<string, BetSlipLeg[]> = {};
  for (const row of data ?? []) {
    const key = row.slip_id as string;
    grouped[key] = grouped[key] ?? [];
    grouped[key].push(row as BetSlipLeg);
  }
  return { data: grouped, error };
}
