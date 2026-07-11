# Phase 3 + 6 — Market Engine & Admin Dashboard Completion

Scope: finish the market lifecycle end-to-end in the existing admin, harmonize the JSON schema so the 10 pasted markets import through the same pipeline as everything else, and wire the disconnected buttons on the current admin pages. No redesign — build on what exists.

## 1. Canonical Market Schema (single source of truth)

Keep `src/lib/foundry/schema.ts` as the one schema. Extend it so the pasted JSON, the Manual Builder, the AI Oracle, and future CSV/API imports all normalize to the same shape.

Changes:
- Add categories: `economy`, `forex`, `commodities` (map `Economy → economy`, etc.).
- Add optional top-level fields already in the pasted JSON: `title`, `closeTime`, `settlementSource`, `settlementRule`, `autoSettle`, `marketType`.
- Add an **adapter layer** (`src/lib/foundry/adapters.ts`) with `normalizeIncoming(raw)` that maps:
  - `title → question`
  - `closeTime → closesAt`
  - `settlementRule → resolutionRules`
  - `settlementSource → sources[0].publisher`
  - `autoSettle → metadata.autoSettle`
  - Binary markets with no `outcomes` → auto-inject `[{label:"YES"},{label:"NO"}]`.
- If input is a bare array (no `MarketPackage` wrapper), auto-wrap: `{ version:"1.0", batchName:"Untitled batch", generatedBy:"manual", markets:[...] }`.
- Version bump the schema to `1.1` with a `SCHEMA_VERSION` const; all writers stamp it.

## 2. Import the 10 sample markets

- Feed the pasted JSON through the extended validator on `/admin/markets/new` (Paste tab). Result: 10 rows, status = ready.
- Publish via existing `import-markets-publish` edge function into `markets` as `draft`.
- No manual DB insert — proves the harmonized pipeline works end-to-end.

## 3. `/admin/markets` — real Market Management page

Today the page only lists matches. Replace body (keep header + `MarketBuilder`) with a lifecycle-aware table:

- Tabs: **Draft · Scheduled · Live · Closed · Resolved**, counts on each.
- Columns: title, category, status pill, volume, closes_at, creator, actions.
- Row actions (each behind role + audit reason where required):
  - **Edit** — opens `MarketBuilder` in edit mode (extend it to accept an existing market).
  - **Clone** — duplicates as a new draft.
  - **Publish** — draft → scheduled/live (via `manage-markets` edge fn).
  - **Close now** — sets `status='closed'`, sends to Resolution Console.
  - **Export JSON** — download the market in canonical schema (single-market MarketPackage).
  - **View audit** — opens right drawer with `market_audit_log` entries.
- Bulk actions: multi-select → Publish / Close / Export.
- Filters: search, category, creator, date range.

Files:
- Rewrite `src/pages/admin/AdminMarketsPage.tsx` (matches list moves to a separate `/admin/markets/matches` subroute or drops — kept only if AdminMatches is still linked; will be removed from this page).
- New: `src/components/admin/markets/MarketsTable.tsx`, `MarketRowActions.tsx`, `MarketAuditDrawer.tsx`, `useMarketsAdmin.ts`.
- Extend `MarketBuilder` to accept `market?: Market` for edit mode.
- Extend `supabase/functions/manage-markets/index.ts` with `action: 'clone' | 'publish' | 'close' | 'update'` (all audited).

## 4. Wire the Resolution Console

`AdminResolutionPage` currently only logs "admin_override" — it does not actually resolve. Add:
- **Resolve** button per row → picks winning outcome → calls new edge fn `resolve-market` which:
  - Validates `market_sources` count ≥ 1 (enforced by existing trigger).
  - Writes `market_audit_log` `action='resolve'` with reason (mandatory).
  - Sets market `status='resolved'`, `winning_outcome_id`.
  - Enqueues settlement via existing `jobs-enqueue` (`handler: 'settle-market'`).
- **Refund** button → same flow with `action='refund'`, credits positions back through `fn_post_double_entry`.
- Both require a typed reason and land in `audit_logs`.

## 5. Naming & cleanup

- Delete duplicate `AdminMarketsNewPage.tsx` (currently unused — router uses `AdminMarketsImportPage`).
- Consolidate market status pill usage on `MarketStatusPill`.
- Ensure everything reads status from `src/lib/market-state.ts` (single lifecycle helper).

## Out of scope (later phases)

Treasury/payments audit, DB normalization, performance/security passes, full 16-phase deliverables. Those become follow-up plans once this slice is merged.

## Technical notes

- All new admin writes go through edge functions (never direct table writes for privileged actions) per LDX invariants.
- Every state-changing admin action requires a reason string persisted in `audit_logs` or `market_audit_log`.
- New categories require a DB migration if `markets.category` is an enum — will check `supabase--read_query` on the enum before writing SQL; if it is an enum, the migration adds `economy`, `forex`, `commodities` values in the same file that ships the schema extension.
- Import flow reuses `import-markets-validate` / `import-markets-publish` unchanged — the adapter runs client-side before validation.
