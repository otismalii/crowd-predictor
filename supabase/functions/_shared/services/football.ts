// FootballService — canonical football reads shared by every product.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MATCH_SELECT = `
  id, kickoff_at, status, minute, home_score, away_score, venue, round, legacy_match_id,
  competition:competitions ( id, slug, name, country, logo_url ),
  season:seasons ( id, name, year ),
  home_team:teams!platform_matches_home_team_id_fkey ( id, slug, name, short_name, logo_url ),
  away_team:teams!platform_matches_away_team_id_fkey ( id, slug, name, short_name, logo_url )
`;

export interface MatchQuery {
  status?: string;
  competition?: string;
  team?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export class FootballService {
  constructor(private db: SupabaseClient) {}

  async listCompetitions() {
    const { data, error } = await this.db
      .from("competitions")
      .select("id, slug, name, short_name, country, logo_url, competition_type, tier, is_active")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async listTeams(search?: string, limit = 50) {
    let query = this.db
      .from("teams")
      .select("id, slug, name, short_name, country, logo_url, venue_name")
      .order("name")
      .limit(Math.min(limit, 200));
    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getTeam(idOrSlug: string) {
    const column = idOrSlug.includes("-") ? "slug" : "id";
    const { data, error } = await this.db
      .from("teams")
      .select("id, slug, name, short_name, country, logo_url, venue_name, founded")
      .eq(column, idOrSlug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async listMatches(q: MatchQuery) {
    const limit = Math.min(q.limit ?? 50, 200);
    const offset = q.offset ?? 0;
    let query = this.db
      .from("platform_matches")
      .select(MATCH_SELECT)
      .order("kickoff_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (q.status) query = query.eq("status", q.status);
    if (q.competition) query = query.eq("competition_id", q.competition);
    if (q.from) query = query.gte("kickoff_at", q.from);
    if (q.to) query = query.lte("kickoff_at", q.to);
    if (q.team) query = query.or(`home_team_id.eq.${q.team},away_team_id.eq.${q.team}`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getMatch(id: string) {
    const { data, error } = await this.db.from("platform_matches").select(MATCH_SELECT).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async listMatchEvents(matchId: string) {
    const { data, error } = await this.db
      .from("match_events")
      .select("id, event_type, minute, extra_minute, player_name, related_player_name, detail, team_id")
      .eq("match_id", matchId)
      .order("minute", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
