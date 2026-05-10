
# Pagaza LDX v14 — Refactor Plan (Vite + Supabase adaptation)

Adapted from your 10-phase spec. The stack is **Vite + React SPA + Supabase Edge Functions** — no Next.js, no Redis, no LOGIK. Where the spec assumes those, we substitute:

- `/server/*` → `supabase/functions/<name>/index.ts` grouped by domain
- Redis Streams → Supabase Realtime broadcast channels + `event_log` table (already exists)
- LOGIK / AI signals → user-driven **Market Intelligence** (volume velocity, price drift, trader concentration) computed in `compute-trends`

---

## Phase 0 — Freeze & Inventory

- Confirm baseline: snapshot current state via git history (Lovable auto-syncs to GitHub).
- Produce a **legacy inventory report** (Phase 1 input). No deletes yet.

## Phase 1 — Legacy Cleanup (delete obvious dead code)

**Edge functions to delete** (superseded by PesaPal flow):
- `supabase/functions/mpesa-callback/`
- `supabase/functions/mpesa-deposit/`
- `supabase/functions/mpesa-withdraw/`

**Frontend to delete** (unused):
- `src/components/CreateBetDialog.tsx` (P2P legacy, only used in `Profile.tsx` — strip its usage)
- Strip P2P references from `src/pages/Profile.tsx`

**Database tables to drop** (zero app references — only appear in generated `types.ts`):
- `ai_insights`, `casino_sessions`, `crash_bets`, `crash_rounds`
- `fantasy_fixtures`, `fantasy_leagues`, `fantasy_players`, `fantasy_scores`, `fantasy_teams`
- `p2p_bets`, `p2p_challenges` (after stripping UI)
- `predictions` (legacy match-score predictions, replaced by markets)

**Ambiguous — flag, don't delete**: `notifications`, `support_tickets`, `follows`, `badges` (kept; still referenced).

## Phase 2 — Frontend Domain Restructure

Target tree (rename + relocate, no rewrites):

```text
src/
  pages/
    Home.tsx              (was Feed.tsx — trending + movers + volatility)
    Markets.tsx
    MarketDetail.tsx
    Portfolio.tsx
    Watchlist.tsx         (NEW)
    Wallet.tsx
    Leaderboard.tsx
    Profile.tsx
    admin/*               (unchanged grouping)
  components/
    market/               (MarketCard, MarketHeader, OrderBook*, TradePanel, MarketOddsBar, MarketStatusPill, PriceChart→MarketPriceChart, PriceDelta, ResolutionBadge, SocialShare, TrendSummary, TradeSuccessDialog, CommentThread, MarketFilters, MarketGrid)
    feed/                 (MarketFeed, TrendingMarkets, MoversList, VolatilityList) — NEW
    intelligence/         (TrendSummary moves here, VolumePulse, TraderConcentration) — NEW, replaces sentiment
    portfolio/            (existing)
    wallet/               (existing)
    leaderboard/          (existing)
    admin/                (existing)
    layout/               (existing)
    ui/                   (shadcn, unchanged)
    reactbits/            (unchanged)
    skeletons/            (unchanged)
    common/               (ErrorBoundary, PageLoader, OfflineIndicator, InstallBanner, ThemeProvider, ThemeToggle, SEOHead)
```

`OrderBook` is **new** — a depth-style view of LMSR-implied liquidity per outcome (not a true order book, since LMSR has no matching engine; we render synthetic depth bands).

## Phase 3 — Edge Function Domain Reorg

Rename/group edge functions (each remains one `index.ts` per Supabase rules):

```text
supabase/functions/
  _shared/                envelope.ts, validation.ts (NEW: zod schemas), pricing.ts (NEW: shared LMSR math)
  markets-manage/         (was manage-markets)
  markets-resolve/        (was resolve-bets)
  markets-sync/           (was sync-matches)
  trade-execute/          (was execute-trade)
  pay-deposit/            (was pesapal-deposit)
  pay-callback/           (was pesapal-callback)
  pay-withdraw/           (was pesapal-withdraw)
  pay-retry/              (was retry-payments)
  risk-evaluate/          (was evaluate-risk)
  ledger-reconcile/       (was reconcile-ledger)
  intel-compute-trends/   (was compute-trends) — extended with volume velocity, concentration, drift
  seo-sitemap/            (was generate-sitemap)
```

Renames require updating `supabase.functions.invoke()` call sites across `src/`. We will produce a single mapping commit.

## Phase 4 — Event Contract Formalization

`event_log` table already exists. We formalize the envelope so every money-moving function emits exactly one canonical event before state changes.

**Stream / aggregate types** (all via `event_log.aggregate_type` + `event_type`):

```text
market.created | market.updated | market.resolved | market.paused
trade.placed   | trade.failed
price.updated  | liquidity.changed
deposit.requested | deposit.completed | deposit.failed
withdraw.requested | withdraw.approved | withdraw.completed | withdraw.failed
risk.flagged   | reconciliation.completed
intel.trend.updated
```

Add `src/lib/events.ts` (typed event reader) and a Supabase Realtime subscription helper that pipes `event_log` inserts into per-aggregate channels for live UI (admin event stream page already exists).

## Phase 5 — Market Intelligence (replaces "sentiment / LOGIK")

Extend `intel-compute-trends` (cron, 15m) to compute and write to `market_trends`:

- **Volume velocity**: 1h/24h volume_delta vs prior window
- **Price drift**: outcome price change magnitude
- **Trader concentration**: unique_traders / trade_count (HHI-like)
- **Volatility band**: rolling stddev of implied price
- **Movers ranking**: precomputed top-N by category

Frontend uses these via a new `src/services/intelligenceService.ts`:
- Home: `TrendingMarkets`, `MoversList`, `VolatilityList`
- MarketDetail: `TrendSummary` (already exists, expanded)
- Admin: surfaced in `AdminLiquidityPage`

No AI / Gemini calls — pure derived statistics. Honors `mem://core: No AI-driven insights`.

## Phase 6 — Database Migrations

One migration covers Phases 1 + 4 + 5:

1. `DROP TABLE` legacy: ai_insights, casino_sessions, crash_*, fantasy_*, p2p_*, predictions (with `CASCADE` only for known dependents; verified none).
2. Add indexes on `event_log (aggregate_type, aggregate_id, created_at desc)` and `event_log (actor_id, created_at desc)` for live tail performance.
3. Add `market_trends` indexes on `(market_id, window, computed_at desc)`.
4. Add `watchlist` table (NEW for `/watchlist` page):
   - `user_id`, `market_id`, `created_at`, `alert_price` nullable
   - RLS: users CRUD own rows only.

## Phase 7 — Admin Dashboard Polish

Admin tree already exists; add:
- `AdminEventStreamPage` already exists — wire to new envelope events
- `AdminRiskPage` (NEW) — surface `risk_signals` with action buttons (already partially in fraud page; merge)
- Confirmation modals + mandatory reason field on every destructive action (already enforced by `mem://security/admin-audit-protocol`)

## Phase 8 — Monetization Hook (deferred wiring)

Add `_shared/fees.ts`:
- `platformCut(amount, type)` returning fee + net
- Every trade/withdraw emits a `fee.collected` event into `event_log`
- No UI changes yet — purely backend instrumentation so revenue reporting is later trivial.

(Pagaza currently runs 0% platform fee per `TradePanel`. We instrument the hook now, leave rate at 0, flip later via config.)

## Phase 9 — Performance Pass

- Lazy-load `MarketDetail` chart bundle (already partial; verify)
- Memoize `MarketCard` and `MarketGrid` rows
- Replace per-card subqueries with batched `fetchMarketOutcomes(ids)` (already in `marketService`; audit call sites)
- Add HTTP cache headers on `seo-sitemap`
- Audit duplicate Realtime channels (one channel per aggregate, not per component)

## Phase 10 — Testing Checklist

Add `src/test/` coverage + Deno tests for edge functions:
- Trade execute: happy path, insufficient balance, duplicate idempotency, phone-gate
- Resolution: blocked without market_sources + audit log (trigger already enforces — add test)
- Deposit/withdraw: pesapal callback signature handling, retry queue
- Reconciliation: drift detection
- Risk: velocity thresholds

---

## Execution order (single sprint, sequential commits)

1. Migration: drop legacy tables, add `watchlist`, add indexes
2. Delete mpesa-* edge functions + `CreateBetDialog` + strip P2P from Profile
3. Edge function renames + update all `invoke()` call sites + extract `_shared/pricing.ts` & `_shared/validation.ts`
4. Frontend restructure: move files into `market/`, `feed/`, `intelligence/`, `common/`; add `Watchlist.tsx`; rename `Feed.tsx` → `Home.tsx`
5. Extend `intel-compute-trends` with new metrics + UI surfaces (TrendingMarkets, MoversList, VolatilityList)
6. Event envelope: ensure every money-moving function emits canonical events; add `src/lib/events.ts`
7. Admin polish + fees instrumentation (0% rate)
8. Performance + tests

---

## Out of scope (per your answers)

- Next.js migration
- Redis Streams / Upstash
- LOGIK signal integration
- Any new AI/Gemini calls

## Risks

- Edge function renames will break any external webhooks pointing at old URLs. **PesaPal callback URL** is set in their dashboard to `pesapal-callback` — we keep a thin alias function during transition or update the dashboard. Plan: **keep `pesapal-callback` name** (skip that rename) to avoid coordinating with PesaPal.
- Dropping `predictions` table: confirmed zero app references but verify no analytics depend on it before drop.
- `notifications` table will need event-log-driven population once envelope is fully wired (follow-up, not this sprint).
