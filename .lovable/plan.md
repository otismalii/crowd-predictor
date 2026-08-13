# Pagaza → Sports Betting Site (Full Refactor)

Retire the prediction-market platform and rebuild the product as a fixed-odds football sportsbook, with a matching admin overhaul. Retired data is archived (kept in the database, unreachable from the app), not deleted.

Confirmed decisions: singles + accumulators, `match_bets` stays as the betting engine, wider market catalog per match, platform-generated odds with admin override.

## Phase 1 — Archive the prediction-market estate

Data is preserved; app and public access are cut off. Access is revoked and public policies dropped on: markets, market_outcomes, trades, positions, watchlist, market_comments, market_intelligence, market_suggestions, market_sources, market_trends, market_quality_scores, market_import_batches / rows / audit, market_audit_log, market_versions/evidence/relationships/health (where present), oracle_runs, p2p_challenges, p2p_audit_log, creator_profiles, creator_subscriptions, creator_payouts. Only service-role code and database admins keep access.

Frontend removals (routes redirect, no dead links): `/markets`, `/markets/:id`, `/market/:id`, `/portfolio`, `/watchlist`, `/creator`, `/sources`, and the public creator profile tab. Deleted: market/trade/portfolio/watchlist/creator components, hooks and services, plus the Foundry import layer.

Backend removals: `execute-trade`, `manage-markets`, `market-intelligence`, `logik-oracle`, `compute-trends`, `creator-payouts`, `import-markets-*`, `admin-market-actions`, and the market/intelligence services in the platform API and MCP tool set.

## Phase 2 — Sportsbook engine (database)

New:
- `bet_markets` — catalog of offered market types (`1x2`, `over_under`, `btts`, `double_chance`, `correct_score`) with display name, line support, and enabled flag.
- `match_odds` — per match, per market, per selection: generated odds, admin-overridden odds, margin used, suspended flag, timestamps. One live row per (match, market, selection, line).
- `bet_slips` — a wager: stake, type (`single` | `acca`), combined odds, potential payout, status, payout, settled_at, idempotency key.
- `match_bets` gains `slip_id`, `line`, `odds_snapshot`, and generalised `market` / `selection` values so each row is one selection on a slip.

Logic:
- `fn_place_bet_slip(user_id, selections[], stake, type, idempotency_key)` — validates each selection against live, unsuspended odds and open kickoff time, rejects two selections on the same match in an acca, debits stake through the existing double-entry ledger (`user_funds` → `settlement_reserve`), writes the slip plus its `match_bets` rows.
- `fn_grade_selection(...)` — grades any catalog market from the final score.
- `fn_settle_match_bets(match_id)` is rewritten to grade all market types, then re-evaluate every affected slip: a single settles directly; an acca settles when its last selection grades (lost as soon as one loses, void selections drop out and reduce combined odds).
- Odds generation: `fn_generate_match_odds(match_id)` builds a probability model from historical form and current vote/bet distribution, applies a configurable house margin from `app_settings` (`odds_margin_bps`, `max_stake_kes`, `max_payout_kes`, `min_stake_kes`), and writes `match_odds` rows without overwriting admin overrides.

Withdrawals, deposits, wallets, ledger, treasury, reconciliation, fraud/risk and roles stay exactly as they are.

## Phase 3 — Sportsbook frontend

- `/` — sportsbook home: live now, today's fixtures, competitions rail, news headlines.
- `/sports` and `/sports/:competitionSlug` — fixture lists with market tabs and one-tap odds buttons.
- `/match/:id` — match page: score, timeline, all offered markets with odds, form and head-to-head.
- Bet slip — persistent drawer (mobile bottom sheet, desktop side panel) holding selections, stake input, single/acca toggle, live combined odds and potential payout, stake limit and balance validation, guest prompt to sign in.
- `/my-bets` — open / settled / cashout-ineligible tabs with slip detail and per-selection grading; replaces the portfolio page.
- Wallet, leaderboard, profile, dashboard, activity and rules pages are re-pointed at betting data. Bottom nav becomes Home · Sports · Bet Slip · My Bets · Wallet.
- Branding and copy across the site move from "markets / shares / positions" to "matches / bets / odds".

## Phase 4 — Admin overhaul

Nav is rebuilt around the sportsbook, keeping the Do / Monitor / Configure grouping:
- **Workspace** — Today, Inbox, Overview (KPIs become turnover, gross win, margin, open liability).
- **Sportsbook** — Fixtures (sync status, force refresh, manual score/status edit), Odds Manager (per-match odds table, override, suspend market or selection, bulk regenerate), Bet Slips (search, drill into any slip), Settlements (re-grade / void a match, audit-logged), Liability (exposure per match and market).
- **Finance** — Treasury, Deposits & Withdrawals approvals, Reconciliation.
- **Governance** — Users, Roles & Promotions, Fraud, Disputes.
- **Audit** — Audit Logs, Event Stream, Automation, System Analytics, Settings (odds margin, stake and payout limits, market catalog toggles).

Removed admin pages: Active Markets, Creation Queue, Oracle Suggestions, Import Markets, Resolution, Liquidity, LOGIK Insights, Prediction History, Creator Payouts, Market History, Event Sources.

New edge function `admin-sportsbook-actions` handles odds overrides, suspensions, re-grades and voids — each requiring a reason and writing to `audit_logs`.

## Phase 5 — Harmonisation & jobs

- `sync-live` (every minute) keeps refreshing scores and settling; it also regenerates odds for matches with fresh vote/bet movement and suspends markets at kickoff.
- `sync-content` (every 30 minutes) unchanged — badges plus result headlines.
- New job `generate-odds` (every 15 minutes) prices newly synced fixtures.
- `job_definitions` rows for retired jobs are disabled; retired functions are deleted.
- Project memory is rewritten: the platform is a sportsbook, prediction markets and the creator economy are retired and must not be re-added.

## Technical notes

- Odds are stored as decimal numerics; combined acca odds are the product of selection odds, rounded to 2 dp at slip level, and the odds snapshot on each selection is immutable once placed.
- All money movement continues to go through `fn_post_double_entry` with idempotency keys, so the ledger stays the single source of truth.
- Settlement remains idempotent per selection and per slip; re-running a match settle is safe.
- Archiving uses `REVOKE` plus policy drops rather than `DROP TABLE`, so no data is lost and the change is reversible.
- Generated `src/integrations/supabase/types.ts` refreshes after each migration; code touching new tables lands after the migration is approved.
