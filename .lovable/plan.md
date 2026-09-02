# Pagaza Bet — LDX Nexus Canonical Overhaul

Migrate the existing app from a prediction-market product into a canonical Kenya/Africa-first sportsbook. Audit and refactor — no rebuild. Legacy prediction tables stay in the database (archived, no app access); prediction concepts are removed from the product surface.

Confirmed decisions: keep legacy tables archived; start with sportsbook depth; keep the AI engine rebranded as Pagaza Betting Intelligence (analytics only).

## Current state (verified)

- Sportsbook engine already exists: `platform_matches`, `competitions`, `teams`, `bet_markets`, `match_odds`, `odds_history`, `bet_slips`, `match_bets`, plus `fn_place_bet_slip` / `fn_settle_match_bets` / `fn_generate_match_odds`.
- Ledger already double-entry (`ledger_entries`, treasury buckets); Pesapal deposit/withdraw/callback functions exist.
- Legacy prediction surface still live in the app: routes and pages for Markets, MarketDetail, Portfolio, Watchlist, Feed, Creator Studio, plus admin pages for Resolution, Liquidity, Oracle Suggestions, Creation Queue, Market Import, Market History, Creator Payouts, Prediction History, Disputes, Sources.
- Branding is still prediction-market: `index.html` title/description/JSON-LD, `src/lib/constants.ts`, `src/lib/seo.ts`, footer, Rules page; `package.json` name is the template default.
- No `sports` table, no first-class `selections` table, no fee-rule engine, no Pesapal IPN endpoint, no explicit compliance tables.

## Wave 1 — Sportsbook depth (first delivery)

Canonical hierarchy and market configurability.

1. Database
   - `sports` (key, name, icon, enabled, sort_order); `competitions.sport_id` added and backfilled to football.
   - `market_selections`: per-market selection catalog (market_key, selection_key, label template, line support, sort order) so new betting markets are configuration, not code.
   - Extend `bet_markets` with sport scope, settlement rule key, period (full time / half time), enabled-by-competition overrides.
   - `match_odds`: explicit lifecycle status (`active`, `suspended`, `closed`, `settled`) replacing boolean-only suspension; keep `odds_history` writes on every price change with source/provider metadata.
   - Market state machine `OPEN → SUSPENDED → CLOSED → SETTLED`; event state machine aligned to existing `match_status` (SCHEDULED/LIVE/FINISHED/POSTPONED/CANCELLED).
   - Grading support in `fn_grade_selection` for the full market set: 1X2, Double Chance, Draw No Bet, Over/Under, BTTS, Correct Score, Half Time result, Handicap.
2. Odds generation
   - Extend `fn_generate_match_odds` and the `generate-odds` function to produce the expanded market set with per-market margin config, skipping suspended/closed markets and expired fixtures.
3. Public UX
   - Desktop sportsbook layout: sports/competitions sidebar → events and markets center → bet slip right panel.
   - Event page grouped by market category with suspension states and live price movement indicators.
   - Bet slip: server-authoritative odds check, odds-change confirmation, min/max stake, singles and accumulators.
4. Admin sportsbook
   - Sports, Competitions, Events, Markets, Selections, Odds management with suspend/resume/close, manual override, and audit entries on every action.

## Wave 2 — Identity, navigation, legacy removal

- Public nav: Home, Sports, Live, My Bets, Promotions, Wallet. Mobile: Home, Sports, Live, Bets, Wallet.
- Delete prediction-market routes and pages (Markets, MarketDetail, Portfolio, Watchlist, Feed, Creator Studio, Sources) with redirects to sportsbook equivalents; remove prediction admin pages (Resolution, Liquidity, Oracle Suggestions, Creation Queue, Market Import, Market History, Creator Payouts, Prediction History).
- Terminology audit pass with DELETE/RENAME/REMODEL/KEEP classification recorded in `LDX.md`; "market" retained only where it means a betting market.
- Rebrand `index.html` metadata, JSON-LD, SEO helpers, footer, Rules, manifest, README, `package.json` name to `pagaza-bet`.
- Remove trading/shares/chart visual language; keep the reusable design system.

## Wave 3 — Money spine

- Fee engine: `fee_rules` with percentage/fixed, min/max, currency, transaction type, provider, payer, effective_from/until, enabled. New versions on change; historical transactions keep the exact rule snapshot applied at execution.
- Ledger transactions carry gross, provider fee, platform fee, tax, net — never collapsed.
- Pesapal 3.0 lifecycle: `payment_intents` (merchant reference, OrderTrackingId, status machine PENDING → COMPLETED/FAILED/CANCELLED/REFUNDED), callback handler that only records arrival, new `pesapal-ipn` endpoint, server-side `GetTransactionStatus` verification before any ledger posting, idempotency keys, pending/failed handling, reconciliation job.
- Admin Finance: fee management, provider vs platform revenue split, transaction and withdrawal fees, reconciliation, financial audit log.

## Wave 4 — Intelligence, compliance, security

- Rebrand the AI engine to Pagaza Betting Intelligence: match/odds analytics only (form, strength, Poisson, live match read, model confidence). Remove market-suggestion and resolution-proposal actions; keep the runs log for audit.
- Compliance hooks modeled and clearly marked pending where a real integration is required: age/eligibility, KYC status, responsible-gambling limits, self-exclusion, AML flags, regulatory reporting.
- Security audit: RLS on every new table with GRANTs, least-privilege admin roles (no blanket financial authority), service-role usage review, webhook authentication, race conditions on wallet mutation and bet placement.

## Wave 5 — Canon documentation and journey tests

- `LDX.md` as the builder-agnostic contract: product identity, ontology, entities, state machines, financial invariants, provider boundaries, payment lifecycle, fee engine, sportsbook lifecycle, admin capabilities, security and compliance boundaries, canonical vs derived state, migration strategy and flagged non-migratable data.
- End-to-end verification: discover event → select odds → bet slip → stake → place bet → settle → credit winnings → withdraw; and deposit → Pesapal → callback/IPN → verify → ledger → wallet.

## Technical notes

- Every new public table gets explicit GRANTs plus RLS in the same migration; anon read only for public sportsbook catalog data (sports, competitions, events, markets, odds).
- All financial mutations stay in security-definer database functions with idempotency keys; no balance writes from the client.
- Legacy prediction tables are left untouched and unreachable from the app; no destructive drops.
- Pesapal secrets remain edge-function only.
