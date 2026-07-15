
# LDX v5 — Governance, Admin Restructure & Unified Profile

Applies the LDX v5 implementation charter, then executes the first concrete slice the user asked for: **admin restructuring & harmonisation** and a **unified user + creator ("industry") profile**. No later-phase (trading engine, treasury rewrite, LOGIK v2) work is started here — that stays gated.

---

## 1. Save the LDX v5 charter as project memory

- New file `.lovable/memory/architecture/ldx-v5-directive.md` (type: constraint) capturing:
  - Implementation methodology (audit → extend → refactor → remove)
  - Priority order (Financial > Security > Market > Data > Perf > UX > Intelligence > Growth > Cosmetic)
  - Phase gates 2→8 with "no leap-frogging" rule
  - Subsystem ownership boundaries (Trading / Finance / Resolution / LOGIK / Governance)
  - DB principles (single source of truth, computed views, audit-on-mutate)
  - UX principles (What happened / can I do / next; Available / Locked / Pending / Completed / Failed)
  - Trust-first exposure requirements
  - LOGIK is advisory only (mirrors existing ldx-v4-invariants)
- Update `.lovable/memory/index.md` Core section with a one-liner pointer.

## 2. Redundancy sweep (consolidate, do not delete yet)

Findings from audit → consolidations in this slice:

| Duplicate / drift | Consolidation |
|---|---|
| `useAdminGuard` + `useAdminRole` + `RequireRole` + inline `has_role` checks | Keep `useAdminRole` (richest). Reduce `useAdminGuard` to a thin re-export (`isAdmin` from `useAdminRole`). Guards continue to use `RequireRole`. |
| `AdminSourcesPage` reused for both `/admin/markets/sources` and `/admin/intelligence/sources` | Collapse to one route `/admin/intelligence/sources`; markets menu links there. Redirect old path. |
| `AdminMarketsImportPage` imported as `AdminMarketsNewPage` alias | Rename import + route to `/admin/markets/import`; redirect `/admin/markets/new`. |
| `intelligenceService.ts` vs `marketIntelligenceService.ts` | Keep `marketIntelligenceService`; `intelligenceService` becomes a re-export shim, callers migrated. |
| Creator profile lives in `/creator` (CreatorDashboard) disconnected from `/profile/:id` | Merge into single `/profile/:id` with tabbed sections (see §4). |
| Profile "Creator Studio" button + separate route | Becomes a Creator tab on the unified profile; route `/creator` redirects to `/profile/:me?tab=creator`. |

No files are deleted this slice — shims stay for one release, tagged `@deprecated`, to keep backward compatibility (LDX v5 rule: remove obsolete code only after migration).

## 3. Admin (ACP) restructure — workflow-oriented, not page-oriented

Keep the 6-domain IA but reshape each domain around a **workflow verb** instead of a page list. Concretely:

### 3a. Sidebar & IA changes (`adminNav.ts`)
- Add a top-level **Workspace** section above domains with:
  - `Inbox` — unified task queue (creation queue + oracle suggestions + disputes + promotions awaiting review) — new page `AdminInboxPage` that aggregates counts from existing tables (`market_suggestions`, `market_disputes`, `role_promotions`, `market_audit_log` where `action='oracle_suggestion'`). Read-only aggregator; each row deep-links to its existing page.
  - `Today` — operator start-of-day: open markets closing in <24h, unreconciled ledger drift, failed payments, pending withdrawals. New page `AdminTodayPage`, purely a dashboard over existing tables.
- Within each domain, group items into **Do / Monitor / Configure** subheadings (visual, in `AdminSidebar`, no route changes):
  - Markets → Do: Creation Queue, Oracle Suggestions, Resolution, Import. Monitor: Active Markets, Liquidity. Configure: Sources.
  - Finance → Do: Settlements, Reconciliation, Creator Payouts. Monitor: Treasury.
  - Intelligence → Monitor: LOGIK Insights, Prediction History, Risk Signals. Configure: Event Sources.
  - Governance → Do: Promotions, Disputes, Fraud. Monitor: Users.
  - Audit → Monitor: Audit Logs, System Analytics, Market History, Automation. Configure: Settings.
- Remove the `/admin/intelligence/sources` duplicate; point sidebar to Markets → Sources only (or vice versa — pick Intelligence and redirect from Markets).

### 3b. Shared admin primitives (harmonisation)
- Every admin page adopts `AdminPageHeader` + `AdminPageBody` (already exists — audit pages that skip it: `AdminMarketsPage`, `AdminAuditPage`, etc. and normalise).
- Every mutating admin action must go through `AdminConfirmDialog` with a mandatory `reason` field (already the pattern for resolution — extend to promotions, disputes, fraud actions, liquidity subsidies). Reason is written to `audit_logs` / `market_audit_log`.
- Add a small `<AdminWhyBanner>` at the top of every "Do" page answering the LDX v5 UX triad (What happened / What can I do / What next) — pure presentational.

### 3c. Command palette
- Extend `AdminCommandPalette` with the new `Inbox` and `Today` entries and with quick-actions ("Resolve market…", "Promote user…") that open the respective confirm dialog pre-filled — pure UI, no new business logic.

## 4. Unified user + industry (creator) profile

Merge `Profile.tsx` and `CreatorDashboard.tsx` into a single route `/profile/:id` with tabs:

```text
[ Overview ] [ Trades ] [ Positions ] [ Creator ] [ Reputation ] [ Settings* ]
                                                                    (*self only)
```

- **Overview** — current header (avatar, bio, plan, streak, follower count, 3 stat tiles).
- **Trades** — the existing "Recent trades" list, paginated.
- **Positions** — pulled from `PositionsList` (already exists in `src/components/portfolio`).
- **Creator** — only visible when the profile has a row in `creator_profiles` OR the viewer is that user. Shows: markets published, total volume attributed, payout rate, pending payouts, "Create market" CTA (routes to existing MarketBuilder). Content lifted from `CreatorDashboard.tsx`.
- **Reputation** — accuracy over time (Recharts), calibration bucket chart if data exists in `market_intelligence`/`positions`, badges (`AchievementBadges`).
- **Settings** — self only: current `ProfileEdit` inline; add "Become a creator" action if not yet a creator (opens promotion request → writes to `role_promotions` with reason, existing table).

Data:
- Extend the existing `public_profiles` view / `get_own_profile` RPC usage — no schema change required for this slice. If `public_profiles` lacks `creator_profile` join, add a lightweight `get_profile_bundle(p_user_id)` RPC returning profile + creator_profile + counts. This is optional; can fall back to two parallel queries.

Route changes:
- `/creator` → `<Navigate to="/profile/{me}?tab=creator" />`. `CreatorDashboard.tsx` marked `@deprecated`, contents moved into a `ProfileCreatorTab.tsx` under `src/components/profile/`.
- New folder `src/components/profile/` with `ProfileHeader`, `ProfileTabs`, `ProfileOverviewTab`, `ProfileTradesTab`, `ProfilePositionsTab`, `ProfileCreatorTab`, `ProfileReputationTab`, `ProfileSettingsTab`.

## 5. Validation

- `tsgo` typecheck.
- Manual click-through via Playwright: `/admin` (Inbox + Today load), `/admin/markets` (redirected sources), `/profile/{me}` (all tabs render, Creator tab appears only for creators), `/creator` (redirects).
- Confirm no existing route 404s (legacy redirects preserved).

## 6. Out of scope for this slice (explicit gates)

- Trading engine refactor, treasury ledger changes, LOGIK v2 calibration, resolution workflow rewrite. All deferred to Phase 4–7 per the directive.
- Deleting the deprecated files (`useAdminGuard`, `intelligenceService`, `CreatorDashboard`) — done in a follow-up once telemetry shows no imports remain.

---

## Technical notes

- No DB migration required. Optional `get_profile_bundle` RPC is additive and only if the double-query pattern is too chatty.
- Zero changes to financial functions (`fn_settle_trade`, `fn_post_double_entry`, wallet RPCs) — LDX invariants preserved.
- All new admin actions with side-effects go through `admin-market-actions` edge function pattern (already established) and write `audit_logs` with `reason`.
- Realtime: unified profile subscribes to `profiles`, `trades`, `positions` for the viewed `id` using the existing `useRealtimeChannel` hook (unique channel per profile id).

