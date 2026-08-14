# Real-Time Data, Auto-Settlement & Site Audit

## What's actually broken (verified against the live database)

- **The whole job engine is dead.** `system_jobs` rows are created with status `pending`, but the claimer (`claim_jobs`) only picks up `queued`. Nothing has ever executed: there are **~345,000 stuck pending jobs** (50k+ per job type) and the dispatcher re-enqueues more every minute.
- **`sync-live` and `sync-content` never run.** They exist as edge functions but were never registered in `job_definitions`, and no `job:sync-live` / `job:sync-content` entries exist in the ingestion log. The only thing running is a legacy 30-minute cron hitting `sync-matches` (25 fixtures per pass).
- **Expired data is on screen.** 130 fixtures are still `upcoming` with kickoffs in the past, and 21 are stuck `live` since Aug 5.
- **Odds coverage is almost nil.** Only 14 fixtures have odds rows (308 rows total) out of 146 upcoming fixtures.
- **News is empty** (0 rows) and **769 teams have no badge**, both because the content job never ran.
- **Bets never auto-settle**, because settlement only happens inside the dead `sync-live` job.
- **Redundant/legacy jobs** still queue work for retired prediction-market features: `logik-oracle`, `compute-trends`, `refresh-market-intelligence`, `creator-payouts`, `settle-market`, `refund-market`, plus the `sync-matches` forwarder.

## The plan

### 1. Fix and harden the automation engine
- Align statuses on one vocabulary (`queued`) and migrate/purge the stale pending backlog (keep a short audit trail, delete the rest).
- Make enqueueing idempotent: unique key per job type + schedule slot, so a stalled handler can never fan out 50k rows again.
- Reap jobs whose `locked_until` has passed back to `queued`; cap retries with backoff (already present) and surface failures.
- Retire the legacy prediction-market job definitions and the duplicate `sync-matches` cron; register `sync-live` (every minute) and `sync-content` (every 30 min) as the only football jobs, alongside `reconcile-ledger` and `retry-payments`.

### 2. Add football-data.org as the primary provider
- New adapter `_shared/providers/footballdata.ts` implementing the existing `FootballProvider` interface (competitions, fixtures by window, live scores, finished results, match events where available).
- Register it in `provider_connections` at priority 1 with TheSportsDB at priority 2 (fallback + team badges), so the provider manager already in place handles failover.
- Respect the free tier: 10 requests/minute, 12 competitions. Per-run request budget, ETag/`cache_entries` reuse, and a shared rate limiter; live windows get priority over backfill.
- Requires your free API token, which I'll ask for as a secret (`FOOTBALL_DATA_API_TOKEN`) before writing the adapter.

### 3. Real-time freshness, no expired data
- `sync-live` (every minute): refresh in-play and today's fixtures, minute/score/status, then settle.
- New **stale-fixture watchdog** inside `sync-live`: any fixture past kickoff still `upcoming`, or `live` for more than 3.5 hours, is re-checked against the provider; if the provider confirms a result it is finished normally, otherwise it's marked `postponed`/`abandoned`.
- Backfill pass on first run to clean up the existing 130 + 21 bad rows.
- UI guard: upcoming/today views never render a fixture whose kickoff has passed without live status, and the fixture query filters server-side rather than relying on status alone.
- Odds generation is chained after each sync so every open fixture in the visible window is priced (currently 14 of 146).

### 4. Auto-resolve bets
- On any fixture transitioning to `finished`, settlement runs automatically via `fn_settle_match_bets` (grading singles and accumulator legs, ledger-backed payouts, idempotent).
- Fixtures marked `postponed`/`abandoned`/`cancelled` **void** their legs: singles refunded, acca legs priced at 1.00 and the slip re-graded on remaining legs.
- Settlement outcomes logged to `ingestion_logs` + `event_log`, and a settlement watchdog re-tries anything left `open` on a finished fixture older than 15 minutes so nothing can silently hang.

### 5. Audit sweep: errors, pitfalls, redundancies
- Remove the dead `sync-matches` forwarder and legacy market job handlers now that nothing schedules them.
- Fix the fragile paths found while reading: the dispatcher's silent `claim_jobs` fallback, the `enabled`/`is_enabled` column mismatch in provider health writes, and `sync-content`'s embedded-FK select syntax.
- Sportsbook UI: loading/empty/error states per window, live minute badges driven by realtime, and odds suspension shown when a market is locked.
- Admin: the Automation page gets real queue depth, backlog and last-run health so this class of failure is visible next time.
- Typecheck and a smoke pass over `/sports`, `/match/:id`, `/my-bets` at the end.

## Technical notes

- New: `supabase/functions/_shared/providers/footballdata.ts`, watchdog + settlement helpers in `sync-live`.
- Migrations: job status alignment, backlog purge, unique enqueue key, `job_definitions` reset, `provider_connections` row for football-data.org, void/refund path in the settlement function.
- Secret needed: `FOOTBALL_DATA_API_TOKEN` (free at football-data.org).
- News stays auto-generated from fixture results (recaps), no external news key.
