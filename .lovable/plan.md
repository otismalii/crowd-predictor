# Finish Betting: Frontend/Backend Harmonisation, Live Data, Then Casino

Close the loop on the sportsbook — bet placement, settlement, odds coverage and real-time data all agreeing with each other — then ship the Pop It casino front to back for a frictionless betting experience.

## Verified current state

- Casino backend partly landed: `casino_games` (1 game: Pop It), `crash_rounds`, `crash_bets` and the money functions exist. `crash_rounds` is empty.
- Security gap: `authenticated` can still EXECUTE `fn_crash_place_bet` directly — the lock-down migration was interrupted and never ran. Any signed-in user could call it with someone else's user id.
- No casino frontend and no `crash-game` edge function exist in this project yet.
- Data is stale and thin: newest fixture row is dated 2026-09-01, **93** matches are stuck `live`, only **11** upcoming fixtures, and only **14** matches have odds (308 odds rows) across 5 enabled markets.
- `system_jobs` is completely empty — no queued, running or historical rows — so the dispatcher/cron is not enqueuing `sync-live`, `sync-content` or `generate-odds` at all. That is the root cause of the stale fixtures and missing odds, not the sync function code.
- No realtime subscriptions on `Sportsbook.tsx`, `MatchDetail.tsx` or `MyBets.tsx`; odds and scores only refresh on navigation.

## Phase 1 — Close the security gap

- Revoke EXECUTE on `fn_crash_place_bet`, `fn_crash_cashout`, `fn_crash_settle_round` from `anon`/`authenticated`/PUBLIC; grant to `service_role` only. Keep `fn_crash_round_feed` public.

## Phase 2 — Automation and live data (root cause first)

- Re-verify the cron/pg_net schedule and `job_definitions` rows, then repair enqueueing so `sync-live` (1 min), `generate-odds` (10 min) and `sync-content` (30 min) actually run. Confirm with fresh `system_jobs` rows after the fix — not by assuming.
- Run the stale-fixture watchdog to clear the 93 stranded `live` matches and settle or void their bets through `fn_settle_pending_matches`.
- Widen fixture intake so upcoming coverage is days deep, not 11 matches, and chain odds generation to every sync so new fixtures get priced immediately.
- Admin: surface job health (last run, failures, backlog) on the Automation page so this failure mode is visible next time.

## Phase 3 — Betting logic harmonisation

- Odds integrity: server is the only price authority. `place-bet` re-reads live odds, rejects suspended markets, closed fixtures and expired kickoffs, and returns a structured odds-changed response the slip can act on.
- Bet slip UX: accept-odds-change confirmation, min/max stake and max payout surfaced before submit, per-selection suspension state, one selection per match on accumulators, duplicate-submit guard, clear KES payout math from the server not the client.
- Settlement: every bet leg grades through `fn_grade_selection`; slips settle acca-aware; void/refund paths for cancelled and postponed fixtures. Winnings land in the ledger, never a direct balance write.
- My Bets: open/settled tabs showing stake, accepted odds per leg, combined odds, potential and actual payout, leg-level result badges.
- Realtime: subscribe `Sportsbook`, `MatchDetail` and `MyBets` to `platform_matches`, `match_odds` and `bet_slips`/`match_bets` with unique channel names and `removeChannel` cleanup, so scores, prices, suspensions and settlements move without a refresh.

## Phase 4 — Pop It casino, end to end

- `crash-game` edge function as the sole round authority: creates rounds with a committed seed hash, opens betting, starts the round, resolves the crash point, calls `fn_crash_settle_round`, reveals the seed. Bet placement and cash-out proxy to the locked-down money functions with idempotency keys.
- Provably-fair proof visible to players: seed hash before the round, seed and crash point after.
- Casino UI ported and restyled onto the Pagaza design system: game stage with the bubble multiplier, bet panel with quick stakes and auto cash-out, round history pills, live feed of anonymous cash-outs, all driven by realtime on `crash_rounds`/`crash_bets`.
- Frictionless flow: one-tap stake chips, auto cash-out presets, instant balance reflection, low-balance path straight into deposit, no modal chains.
- Routes and nav: `/casino` in desktop and mobile navigation; admin gets round history, staked-vs-paid exposure and a per-game enable switch.

## Phase 5 — Verify the journeys

- Sportsbook: discover fixture → select odds → slip → stake → place → settle → winnings in wallet and ledger.
- Casino: round opens → bet → cash out (and auto cash-out) → ledger entry → balance.
- Check both against real database rows and the running preview, including a live-updating fixture, before reporting done.

## Technical notes

- Every money movement stays in security-definer functions with idempotency keys; no client balance writes.
- Realtime channels use dynamic unique names and clean up on unmount.
- Odds accepted at placement are stored on the leg and never recomputed at settlement.
- Legacy prediction tables stay archived and untouched.
