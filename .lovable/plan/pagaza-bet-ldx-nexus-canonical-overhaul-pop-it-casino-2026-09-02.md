# Pagaza Bet — LDX Nexus Canonical Overhaul + Pop It Casino

Migrate the app from a prediction-market product into a canonical Kenya/Africa-first sportsbook with a Pop It casino vertical, in a SportPesa/Betika-grade visual language. Audit and refactor — no rebuild. Legacy prediction tables stay in the database (archived, no app access); prediction concepts leave the product surface.

Confirmed decisions: keep legacy tables archived; sportsbook depth first; keep the AI engine rebranded as Pagaza Betting Intelligence (analytics only).

## Current state (verified)

- Sportsbook engine exists: `platform_matches`, `competitions`, `teams`, `bet_markets`, `match_odds`, `odds_history`, `bet_slips`, `match_bets`, plus `fn_place_bet_slip` / `fn_settle_match_bets` / `fn_generate_match_odds`.
- Ledger is double-entry (`ledger_entries`, treasury buckets); Pesapal deposit/withdraw/callback functions exist.
- Legacy prediction surface still live: Markets, MarketDetail, Portfolio, Watchlist, Feed, Creator Studio, Sources plus admin Resolution, Liquidity, Oracle Suggestions, Creation Queue, Market Import, Market History, Creator Payouts, Prediction History.
- Branding is prediction-market: `index.html` title/description/JSON-LD, `public/manifest.json` ("Pagaza — Prediction Markets", /markets shortcut), `src/lib/constants.ts`, `src/lib/seo.ts`, footer, Rules; `package.json` name is the template default.
- No `sports` table, no first-class selections table, no fee-rule engine, no Pesapal IPN endpoint, no compliance tables.

## Uploaded zip analysis (pagaza-live-main)

- It targets the **same Supabase project** (`nshxgolruvisdzptcxew`), so it is a sibling build of this backend, not a foreign app.
- It contains a complete **Pop It crash casino**: `src/components/popit/` (GameStage, BetPanel, Bubble, HistoryPills, LiveFeed, TrishCharacter), pages `Casino.tsx` and `Crash.tsx`, and the `crash-game` edge function (round lifecycle, bet placement, cashout, settlement) backed by `crash_rounds` / `crash_bets`.
- Verified against the live database: `crash_rounds` and `crash_bets` **do not exist** in the current project. Pop It therefore needs its schema and edge function created here, then the UI ported.
- Also present and worth harvesting: a fuller public page set (About, FAQ, HowItWorks, Trust, Terms, Privacy, ResponsibleUse, Support), `src/components/effects`, and `NeonButton`. Its `index.html` is still prediction-branded and will not be copied.

## Wave 1 — Brand identity and marketing assets

- Generate a Pagaza Bet visual kit: wordmark/logo lockup, app icon set, hero banners (football/live/casino), promotion card art, jackpot/bonus badges, OG social image, empty-state art. Bold, high-contrast, sport-photography-driven — SportPesa/Betika energy, no generic AI gradient-form look, no emoji as UI.
- Extend the design system in `src/index.css` and `tailwind.config.ts`: sportsbook-grade tokens for odds buttons, price-up/price-down, live pulse, jackpot/promo surfaces, casino neon surface. Keep the existing KE flag palette as the brand base.
- Replace prediction-market visual language (charts, shares, trading panels) with odds, fixtures, selections, bet slip, winnings.
- Rebrand metadata end to end: `index.html` title/description/OG/JSON-LD, `public/manifest.json` (name, description, shortcuts to /sports, /live, /wallet), `src/lib/seo.ts`, `src/lib/constants.ts`, README, `package.json` name `pagaza-bet`.
- Marketing surfaces: home hero with live-fixture rail, promotions page with real promo cards, trust/responsible-gambling and support pages ported and rewritten from the zip.

## Wave 2 — Sportsbook depth

1. Database
   - `sports` (key, name, icon, enabled, sort_order); `competitions.sport_id` added and backfilled to football.
   - `market_selections`: selection catalog per market key so new betting markets are configuration, not code.
   - Extend `bet_markets` with sport scope, settlement rule key, period (full time / half time), per-competition enablement.
   - `match_odds` lifecycle status (`active`/`suspended`/`closed`/`settled`) replacing boolean-only suspension; `odds_history` written on every price change with source/provider metadata.
   - State machines: market `OPEN → SUSPENDED → CLOSED → SETTLED`; event `SCHEDULED → LIVE → FINISHED → POSTPONED → CANCELLED`.
   - `fn_grade_selection` extended to 1X2, Double Chance, Draw No Bet, Over/Under, BTTS, Correct Score, Half Time, Handicap.
2. Odds generation: extend `fn_generate_match_odds` and `generate-odds` to the expanded market set with per-market margin config, skipping suspended/closed markets and expired fixtures.
3. Public UX: desktop sportsbook layout (sports sidebar → events/markets center → bet slip right panel); event page grouped by market category with suspension state and price-movement indicators; bet slip with server-authoritative odds, odds-change confirmation, min/max stake, singles and accumulators.
4. Admin sportsbook: Sports, Competitions, Events, Markets, Selections, Odds management with suspend/resume/close, manual override, audit entry on every action.

## Wave 3 — Pop It casino integration

- Schema: `casino_games` catalog, `crash_rounds` (server-seed, hash commitment, crash point, state `betting → running → crashed → settled`), `crash_bets` (stake, auto-cashout, cashout multiplier, payout, status), all with GRANTs plus RLS and realtime enabled.
- Provably-fair round engine in the database/edge function: server seed committed before the round, revealed after; crash point never derived client-side.
- Port the `crash-game` edge function into this project's conventions (CORS, JWT validation in code, zod validation, idempotency keys) and route all money through the existing ledger (`BET_STAKE`, `WINNING`, `REFUND`) — the browser never settles a round.
- Port and restyle `src/components/popit/*`, `Casino.tsx`, `Crash.tsx` onto the Pagaza Bet design system; keep the Trish character and neon stage, drop prediction-era wording.
- Nav: add Casino to public navigation; admin gets casino round history, RTP/exposure, and per-game enable/disable.

## Wave 4 — Identity cleanup and legacy removal

- Public nav: Home, Sports, Live, Casino, My Bets, Promotions, Wallet. Mobile: Home, Sports, Live, Bets, Wallet.
- Delete prediction routes and pages (Markets, MarketDetail, Portfolio, Watchlist, Feed, Creator Studio, Sources) with redirects; remove prediction admin pages (Resolution, Liquidity, Oracle Suggestions, Creation Queue, Market Import, Market History, Creator Payouts, Prediction History).
- Terminology audit with DELETE/RENAME/REMODEL/KEEP classification recorded in `LDX.md`; "market" kept only where it means a betting market.

## Wave 5 — Money spine

- Fee engine: `fee_rules` (percentage/fixed, min/max, currency, transaction type, provider, payer, effective_from/until, enabled). Fee changes create new versions; historical transactions retain the exact rule snapshot applied.
- Ledger transactions carry gross, provider fee, platform fee, tax, net — never collapsed into one "fee".
- Pesapal 3.0 lifecycle: `payment_intents` (merchant reference, OrderTrackingId, `PENDING → COMPLETED/FAILED/CANCELLED/REFUNDED`), callback that only records arrival, new `pesapal-ipn` endpoint, server-side `GetTransactionStatus` verification before any ledger posting, idempotency keys, pending/failed handling, reconciliation job.
- Admin Finance: fee management, provider vs platform revenue, transaction and withdrawal fees, reconciliation, financial audit log.

## Wave 6 — Intelligence, compliance, security, canon

- Rebrand the AI engine to Pagaza Betting Intelligence: match/odds analytics only (form, strength, Poisson, live read, confidence). Market-suggestion and resolution-proposal actions removed; runs log kept for audit.
- Compliance hooks modeled and marked pending where a real integration is required: age/eligibility, KYC, responsible gambling limits, self-exclusion, AML flags, regulatory reporting.
- Security audit: RLS and GRANTs on every new table, least-privilege admin roles, service-role usage review, webhook authentication, race conditions on wallet mutation, bet placement and casino cashout.
- `LDX.md` as the builder-agnostic contract: identity, ontology, entities, state machines, financial invariants, provider boundaries, payment lifecycle, fee engine, sportsbook and casino lifecycles, admin capabilities, security and compliance boundaries, canonical vs derived state, migration strategy.
- End-to-end verification: discover event → odds → bet slip → stake → place → settle → winnings → withdraw; deposit → Pesapal → callback/IPN → verify → ledger → wallet; casino round → bet → cashout → ledger.

## Technical notes

- Generated brand images become CDN asset pointers, not repo binaries (favicon excepted).
- Nothing from the zip is bulk-copied; files are ported selectively and no `.git` metadata is imported.
- Every new public table gets GRANTs plus RLS in the same migration; anon read only for public catalog data (sports, competitions, events, markets, odds, casino games).
- All financial mutations stay in security-definer database functions with idempotency keys; no balance writes from the client.
- Legacy prediction tables are left untouched and unreachable from the app; no destructive drops. Pesapal secrets stay edge-function only.
