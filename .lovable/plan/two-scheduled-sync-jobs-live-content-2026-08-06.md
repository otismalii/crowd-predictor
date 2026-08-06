# Two Scheduled Sync Jobs (Live + Content)

The pasted SQL came from another project (it posts to a `…lovable.app/api/public/hooks/…` URL that doesn't exist here). This project already runs scheduling through `job_definitions` + the `jobs-dispatch` worker (pg_cron ticks once a minute), so the two schedules will be built natively instead of copied.

## What gets added

**1. Live sync — every minute (`sync-live`)**
- Refresh live/today fixtures and in-match events from the football provider.
- Update scores, minute, and status on `platform_matches`.
- For every match that just moved to `finished`, settle its open bets in `match_bets` (win / loss / void refund) using the existing `fn_settle_match_bets` ledger function.
- Reports counts of fixtures refreshed, matches settled, and bets paid.

**2. Content sync — every 30 minutes (`sync-content`)**
- Fill in missing team badges: for `teams` rows with no `logo_url`, look up the badge from TheSportsDB and save it.
- Football headlines: TheSportsDB has no news endpoint, so headlines are generated from freshly finished fixtures (result headlines with team tags and badge image) and written to `news_items`, deduplicated by URL. If a dedicated news API is added later, this job is the place it plugs in.

Both jobs appear on the Automation dashboard (`/admin/audit/automation`) with success/failure counts, latency, run history, manual "Run" and pause controls — no new admin screen needed.

## Technical notes

- New edge functions: `supabase/functions/sync-live/index.ts` and `supabase/functions/sync-content/index.ts`. Both accept the dispatcher's `{ job_id, payload }` body, are idempotent, and log to `ingestion_logs`.
- Provider layer: add a `getTeamBadge(name)` capability to the `FootballProvider` interface and the TheSportsDB adapter; reuse `buildProvider` / `loadConnections` / `Normalizer` from `_shared/providers`.
- Settlement reuses `fn_settle_match_bets(match_id)`, which is already idempotent per bet via ledger idempotency keys.
- Two rows added to `job_definitions` (`sync-live`, `*/1 * * * *`, owner `markets`; `sync-content`, `*/30 * * * *`, owner `markets`) via a data insert — the existing `jobs-dispatch-minute` cron job picks them up, so no new pg_cron entries and no anon key embedded in SQL.
- `supabase/config.toml` gets `verify_jwt = false` for both functions (dispatcher calls them with the service role).
- No schema changes; `news_items` and `teams.logo_url` already exist.
