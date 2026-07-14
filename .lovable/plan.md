## Slice 1 — Market Intelligence Page

Turn `/market/:id` into an intelligence hub. Non-destructive: existing trade panel, comments, activity, related, chart all stay. We add a new **Intelligence** column and back it with a NIM-powered edge function + a cache table.

### 1. Database — `market_intelligence` cache

New table (one row per market, upserted):

```
market_intelligence
  market_id (PK, FK markets.id)
  summary text
  bull_case text
  bear_case text
  risk_level text ('low'|'medium'|'high'|'critical')
  risk_notes text
  confidence integer  -- 0..100 from LOGIK quality score
  momentum numeric    -- signed 24h price delta of top outcome
  buy_pressure numeric  -- share of buy KES vs total in 24h (0..1)
  sell_pressure numeric
  liquidity_score integer  -- derived from liquidity_param + volume
  event_timeline jsonb  -- [{ts,label,kind}]
  sources jsonb  -- normalized from market_sources for quick render
  generated_by text  -- 'logik-oracle' | 'system'
  oracle_run_id uuid null
  generated_at timestamptz
  updated_at timestamptz
```

RLS: public SELECT (markets are public); INSERT/UPDATE service_role only. Grants: `SELECT` to `anon`+`authenticated`, `ALL` to `service_role`.

### 2. Edge function `market-intelligence`

`POST { market_id, force?: boolean }` → returns cached row if fresh (< 30 min) unless `force`.

On refresh:
- Load market + outcomes + sources + last 200 trades + latest `market_quality_scores`.
- Compute deterministic metrics server-side: momentum, buy/sell pressure, liquidity score, unique traders, event timeline (created, first trade, big trades > p95, close, resolve).
- Call NIM (reuse pattern from `logik-oracle`) with a single prompt requesting JSON `{ summary, bull_case, bear_case, risk_level, risk_notes }`. Grounded in market + sources; multilingual passthrough (EN default, honor `?lang=sw`).
- Upsert `market_intelligence`; write `oracle_runs` entry (stage `intelligence`).
- Never touches funds, never publishes/settles — respects LDX v4 invariants.

Admin-only `force=true` (verified via `has_any_role`).

### 3. Client service + hook

- `src/services/marketIntelligenceService.ts`: `fetchIntelligence(marketId)`, `refreshIntelligence(marketId)` (admin), Zod types.
- `src/hooks/useMarketIntelligence.ts`: TanStack Query, 60s stale, realtime subscription on `market_intelligence` row.

### 4. UI — Intelligence panel

New folder `src/components/markets/intelligence/`:

```
IntelligencePanel.tsx       -- container, tabs: Overview | AI | Timeline | Sources
OverviewCard.tsx            -- confidence, momentum, buy/sell pressure bars, liquidity meter
AiBriefingCard.tsx          -- summary + Bull/Bear tabs + risk pill, "AI-generated" disclaimer
EventTimeline.tsx           -- vertical timeline from event_timeline jsonb
SourceList.tsx              -- publisher chips + external links
PressureBar.tsx             -- shared bar viz (recharts BarChart or plain divs)
```

Design tokens only (no hardcoded colors); mobile-first stacked, desktop side-column.

### 5. MarketDetail wiring

- Add `<IntelligencePanel marketId={id} />` under `<TrendSummary>` on mobile, and as right column on `lg` (change grid to `lg:grid-cols-6`: main 4 / intel 2). Existing trade sheet unchanged.
- Extend `PriceChart` with a lightweight **volume-per-bucket** area behind the probability lines (same recharts, no new dep) — off by default toggle "Show volume".
- Add "Related markets" now populated for non-match markets too: query by shared `category` + `tags` intersection when `match_id` is null.

### 6. Realtime + caching

- `useMarketIntelligence` subscribes to `market_intelligence` upserts for the market id (unique channel name pattern already in memory).
- Client triggers `market-intelligence` (non-force) on mount; if row is stale, function refreshes inline and returns.

### 7. Cron refresh (light)

Extend existing `compute-trends` cron OR add a job def: every 15 min, refresh intelligence for the top 25 markets by 24h volume. No new scheduler infra — reuse `job_definitions` / `jobs-dispatch`.

### 8. Out of scope (later slices)
Discovery rails, portfolio analytics, social/reputation, notifications, dashboards, i18n beyond EN/SW passthrough.

### Technical notes
- New table + RLS via `supabase--migration` (with `GRANT`s).
- Edge function follows existing corsHeaders + NIM pattern from `logik-oracle`; input validated with Zod.
- No changes to `wallets`, `ledger_entries`, `markets` rows.
- Types file regenerates after migration; service imports typed row.

### Deliverables
- Migration: `market_intelligence` table + RLS + grants.
- Edge function: `supabase/functions/market-intelligence/index.ts`.
- Client: service, hook, 6 components, MarketDetail wiring, PriceChart volume overlay, related-markets fallback.
- Job definition row for periodic refresh.
