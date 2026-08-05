# Shared Football Platform Backend

Turn this project's Supabase backend into the single source of truth that both Pagaza Markets (this app) and the separate LOGIK Betwise PWA consume. No second backend, no duplicated logic: Betwise is built later as a presentation layer only, talking to the same `/api/v1` gateway.

Confirmed decisions: canonical football core + provider mappings only (players/coaches/timelines/statistics deferred), reuse the football API already in use (TheSportsDB, currently hardcoded inside `sync-matches`), absorb-and-rename existing overlapping subsystems rather than deleting them.

## Current state (verified)

- `matches` is a thin table: `league`, `home_team`, `away_team` as free text, plus `external_match_id`. No teams, competitions, seasons, or match events tables exist.
- The only football provider is TheSportsDB, hardcoded in `supabase/functions/sync-matches/index.ts` (key + league IDs inline). `source_registry` exists but is used for market resolution sources, not football data ingestion.
- Business logic is split between `src/services/*` (client-side, hits Supabase directly), edge functions, and SQL functions. Many pages also query Supabase directly, so there is no single reusable interface a second app could consume.
- Job infrastructure already exists (`system_jobs`, `job_definitions`, `jobs-dispatch` on pg_cron) and can become the Sync Center rather than being rebuilt.

## Phase 1 — Canonical football core + provider mappings

One migration adding:

- `competitions`, `seasons`, `teams` — canonical UUID primary keys, slug, country, logo, plus display metadata.
- `platform_matches` — canonical fixture table with `competition_id`, `season_id`, `home_team_id`, `away_team_id`, kickoff, status, scores, venue.
- `match_events` — goals/cards/subs with minute, team, player name (text for now, no players table yet).
- `provider_connections` — one row per provider (name, base URL, priority, enabled, health, rate limit, last latency). Credentials stay in Supabase secrets; only the secret's *name* is stored here.
- `provider_mappings` — `(provider, entity_type, external_id) -> canonical_id`. This is the only place external IDs live.
- `sync_jobs` / `sync_logs` views over the existing `system_jobs` tables so the Sync Center reads one surface.
- `feature_flags` (product-scoped: `pagaza`, `betwise`, `all`).
- `api_keys` — hashed keys with scopes, for server-to-server platform consumers.

Existing `matches` stays in place and is backfilled into `platform_matches` + `teams` + `competitions` via a one-time normalizer, so current markets keep working. `markets.match_id` gets a nullable `platform_match_id` alongside it; the old column is retired once backfill is verified.

Every new public table gets explicit GRANTs, RLS enabled, and read policies (football data is public-readable; provider/api-key/sync tables are admin-only).

## Phase 2 — Provider Manager

- `packages`-style directory `supabase/functions/_shared/providers/`: a `FootballProvider` interface (`listCompetitions`, `listFixtures`, `getFixture`, `listEvents`), a `thesportsdb.ts` adapter, and a `normalize.ts` that maps raw payloads to canonical entities via `provider_mappings`.
- New `provider-sync` edge function replaces the ingest half of `sync-matches`: reads enabled providers by priority from `provider_connections`, runs adapter → normalizer → upsert, writes a `sync_logs` row with raw + normalized payload for the inspector, and emits events.
- `sync-matches` becomes a thin shim that enqueues `provider-sync` so the existing cron keeps working.
- Adding a provider later = one adapter file + one `provider_connections` row. Zero frontend change.

## Phase 3 — Platform API `/api/v1`

A single edge function `api` with internal routing, so both apps share one versioned surface:

```text
/api/v1/auth/session        /api/v1/matches      /api/v1/markets
/api/v1/profile             /api/v1/teams        /api/v1/predictions
/api/v1/users               /api/v1/leagues      /api/v1/slips
/api/v1/intelligence        /api/v1/events       /api/v1/comments
/api/v1/notifications       /api/v1/search       /api/v1/system
/api/v1/providers           /api/v1/admin/*
```

- Auth: Supabase JWT via `getClaims()` for user calls, or `x-api-key` for server consumers; RBAC enforced by the existing `has_role`.
- Every handler delegates to a service in `supabase/functions/_shared/services/*` — the service layer is the only place business rules live. Money-moving paths keep calling the existing SQL functions and the event envelope.
- Response shape is uniform (`{ ok, data, error, meta }`) and versioned; CORS open so the Betwise PWA on another origin can call it.
- Read endpoints get short-TTL caching through a `cache_entries` table with tag-based invalidation driven off the event bus.

## Phase 4 — Client SDK for both apps

- `src/platform/` in this repo: generated-style typed API client + hooks (`useMatches`, `useMarkets`, `useIntelligence`, …) plus shared canonical types.
- This app's `src/services/*` and pages are migrated onto the client so no component talks to Supabase or a provider directly.
- `src/platform/` is written to be copy-portable into the Betwise PWA (no Pagaza-specific imports, no design tokens), and I'll export a small README describing base URL + auth so Betwise needs zero backend work.

## Phase 5 — Absorb and rename, admin consoles

- LOGIK Oracle → `IntelligenceService`; Market Foundry import → `MarketService.import*`; `system_jobs` → Sync Center; treasury/creator economy stay but are exposed only through `SettlementService` / `CreatorService`.
- New admin pages under the existing shell: **Providers** (connection test, latency, health, priority, raw vs normalized payload viewer, replay request), **Sync Monitor** (queued/running/failed/dead-letter, bulk re-sync, worker health), **Feature Flags**, **API Keys**. Existing Automation page is folded into Sync Monitor.
- Football core admin: Competitions, Teams, Matches (canonical, read-mostly with manual override + re-sync per row).

## Technical notes

- The directive's `apps/` + `packages/` monorepo can't run here — this stack builds one Vite SPA. The equivalent separation is: Supabase (DB + `/api/v1` + service layer) is the platform; this repo's `src/` is `apps/pagaza-web`; your Betwise PWA is a second repo consuming the same API. `src/platform/` plays the role of `packages/api-client` + `shared-types` + `shared-hooks` and is duplicated by copy, not by npm, until you want a published package.
- Event bus reuses `event_log`; new event types (`match.*`, `provider.*`, `sync.*`, `cache.invalidated`) get emitted through the existing `emitEvent` envelope, and workers subscribe by polling `system_jobs` — no new infrastructure.
- Webhook verification, signed requests, and rate limiting land in `_shared/security.ts` used by every `/api/v1` handler.
- Deferred until a richer provider is connected: `players`, `coaches`, `match_timelines`, aggregate `statistics`, and the AI recommendation engine.

## Sequencing

Phases run in order, each ending in a working app. Phase 1 needs a migration approval; Phase 2–5 are code only. I'll stop after Phase 1 + 2 for you to verify sync health before the API gateway lands.
