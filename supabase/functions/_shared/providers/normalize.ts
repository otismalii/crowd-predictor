// Maps raw provider payloads onto canonical football entities through provider_mappings.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { slugify } from "./types.ts";
import type { RawCompetition, RawFixture, RawMatchEvent, RawTeam } from "./types.ts";

type EntityType = "competition" | "season" | "team" | "match";

export interface NormalizeResult {
  competitions_upserted: number;
  teams_upserted: number;
  matches_upserted: number;
  events_upserted: number;
  skipped: number;
}

export class Normalizer {
  private cache = new Map<string, string>();

  constructor(private db: SupabaseClient, private provider: string) {}

  private cacheKey(entity: EntityType, externalId: string) {
    return `${entity}:${externalId}`;
  }

  private async lookupMapping(entity: EntityType, externalId: string): Promise<string | null> {
    const key = this.cacheKey(entity, externalId);
    if (this.cache.has(key)) return this.cache.get(key)!;
    const { data } = await this.db
      .from("provider_mappings")
      .select("canonical_id")
      .eq("provider", this.provider)
      .eq("entity_type", entity)
      .eq("external_id", externalId)
      .maybeSingle();
    if (data?.canonical_id) {
      this.cache.set(key, data.canonical_id);
      return data.canonical_id;
    }
    return null;
  }

  private async saveMapping(entity: EntityType, externalId: string, canonicalId: string, label?: string | null) {
    this.cache.set(this.cacheKey(entity, externalId), canonicalId);
    await this.db.from("provider_mappings").upsert(
      {
        provider: this.provider,
        entity_type: entity,
        external_id: externalId,
        canonical_id: canonicalId,
        raw_label: label ?? null,
      },
      { onConflict: "provider,entity_type,external_id" },
    );
  }

  async resolveCompetition(raw: RawCompetition): Promise<string | null> {
    const mapped = await this.lookupMapping("competition", raw.external_id);
    if (mapped) return mapped;

    const slug = slugify(raw.name);
    if (!slug) return null;
    const { data: existing } = await this.db.from("competitions").select("id").eq("slug", slug).maybeSingle();
    let id = existing?.id ?? null;

    if (!id) {
      const { data, error } = await this.db
        .from("competitions")
        .insert({
          slug,
          name: raw.name,
          country: raw.country ?? null,
          logo_url: raw.logo_url ?? null,
          competition_type: raw.competition_type ?? "league",
        })
        .select("id")
        .single();
      if (error) {
        console.log(`[normalize] competition insert failed (${slug}): ${error.message}`);
        return null;
      }
      id = data.id;
    }

    await this.saveMapping("competition", raw.external_id, id!, raw.name);
    return id;
  }

  async resolveSeason(competitionId: string, season: { external_id?: string | null; name: string }): Promise<string | null> {
    const externalId = season.external_id ?? `${competitionId}:${season.name}`;
    const mapped = await this.lookupMapping("season", externalId);
    if (mapped) return mapped;

    const { data: existing } = await this.db
      .from("seasons")
      .select("id")
      .eq("competition_id", competitionId)
      .eq("name", season.name)
      .maybeSingle();
    let id = existing?.id ?? null;

    if (!id) {
      const year = parseInt(season.name.slice(0, 4), 10);
      const { data, error } = await this.db
        .from("seasons")
        .insert({
          competition_id: competitionId,
          name: season.name,
          year: Number.isNaN(year) ? null : year,
        })
        .select("id")
        .single();
      if (error) return null;
      id = data.id;
    }

    await this.saveMapping("season", externalId, id!, season.name);
    return id;
  }

  async resolveTeam(raw: RawTeam): Promise<string | null> {
    const externalId = raw.external_id ?? `slug:${slugify(raw.name)}`;
    const mapped = await this.lookupMapping("team", externalId);
    if (mapped) return mapped;

    const slug = slugify(raw.name);
    if (!slug) return null;
    const { data: existing } = await this.db.from("teams").select("id").eq("slug", slug).maybeSingle();
    let id = existing?.id ?? null;

    if (!id) {
      const { data, error } = await this.db
        .from("teams")
        .insert({
          slug,
          name: raw.name,
          short_name: raw.short_name ?? null,
          country: raw.country ?? null,
          logo_url: raw.logo_url ?? null,
        })
        .select("id")
        .single();
      if (error) {
        console.log(`[normalize] team insert failed (${slug}): ${error.message}`);
        return null;
      }
      id = data.id;
    }

    await this.saveMapping("team", externalId, id!, raw.name);
    return id;
  }

  /** Upsert a canonical fixture and keep the legacy `matches` row in sync. */
  async upsertFixture(raw: RawFixture): Promise<{ id: string | null; created: boolean }> {
    const competitionId = await this.resolveCompetition(raw.competition);
    const seasonId = raw.season && competitionId ? await this.resolveSeason(competitionId, raw.season) : null;
    const homeId = await this.resolveTeam(raw.home);
    const awayId = await this.resolveTeam(raw.away);
    if (!homeId || !awayId) return { id: null, created: false };

    // Legacy table keeps working: markets still reference matches.id.
    const { data: legacy } = await this.db
      .from("matches")
      .upsert(
        {
          external_match_id: raw.external_id,
          league: raw.competition.name,
          home_team: raw.home.name,
          away_team: raw.away.name,
          kickoff: raw.kickoff_at,
          status: raw.status,
          home_score: raw.home_score,
          away_score: raw.away_score,
        },
        { onConflict: "external_match_id" },
      )
      .select("id")
      .maybeSingle();

    const existingId = await this.lookupMapping("match", raw.external_id);
    const payload = {
      competition_id: competitionId,
      season_id: seasonId,
      home_team_id: homeId,
      away_team_id: awayId,
      kickoff_at: raw.kickoff_at,
      status: raw.status,
      minute: raw.minute ?? null,
      home_score: raw.home_score ?? null,
      away_score: raw.away_score ?? null,
      venue: raw.venue ?? null,
      round: raw.round ?? null,
      legacy_match_id: legacy?.id ?? null,
      last_synced_at: new Date().toISOString(),
    };

    if (existingId) {
      const { error } = await this.db.from("platform_matches").update(payload).eq("id", existingId);
      if (error) console.log(`[normalize] match update failed: ${error.message}`);
      return { id: existingId, created: false };
    }

    // A prior legacy backfill may already own this fixture.
    if (legacy?.id) {
      const { data: byLegacy } = await this.db
        .from("platform_matches")
        .select("id")
        .eq("legacy_match_id", legacy.id)
        .maybeSingle();
      if (byLegacy?.id) {
        await this.db.from("platform_matches").update(payload).eq("id", byLegacy.id);
        await this.saveMapping("match", raw.external_id, byLegacy.id, `${raw.home.name} vs ${raw.away.name}`);
        return { id: byLegacy.id, created: false };
      }
    }

    const { data, error } = await this.db.from("platform_matches").insert(payload).select("id").single();
    if (error) {
      console.log(`[normalize] match insert failed: ${error.message}`);
      return { id: null, created: false };
    }
    await this.saveMapping("match", raw.external_id, data.id, `${raw.home.name} vs ${raw.away.name}`);
    return { id: data.id, created: true };
  }

  async replaceEvents(matchId: string, events: RawMatchEvent[]): Promise<number> {
    if (!events.length) return 0;
    await this.db.from("match_events").delete().eq("match_id", matchId);
    const rows = await Promise.all(
      events.map(async (e, index) => ({
        match_id: matchId,
        team_id: e.team_external_id ? await this.lookupMapping("team", e.team_external_id) : null,
        event_type: e.event_type,
        minute: e.minute ?? null,
        extra_minute: e.extra_minute ?? null,
        player_name: e.player_name ?? null,
        related_player_name: e.related_player_name ?? null,
        detail: e.detail ?? null,
        sort_order: index,
      })),
    );
    const { error } = await this.db.from("match_events").insert(rows);
    if (error) {
      console.log(`[normalize] events insert failed: ${error.message}`);
      return 0;
    }
    return rows.length;
  }
}
