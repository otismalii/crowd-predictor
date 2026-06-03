## Admin Control Panel Overhaul

Rebuild `/admin/*` as a proper control panel with a persistent shell, 5-domain IA, shared primitives, and a per-page audit pass for redundancy, realtime, and role-aware visibility.

### 1. Shell

New `src/components/admin/AdminLayout.tsx` wrapping all admin routes:

- `SidebarProvider` + `AdminSidebar` (`collapsible="icon"`) + topbar.
- Sidebar groups (collapsible, active group auto-expanded):
  - **Operations** — Overview, Event Stream
  - **Markets** — Markets, New Market, Resolution, Liquidity, Sources
  - **Finance** — Treasury, Reconciliation
  - **Risk** — Fraud, Disputes, Users
  - **System** — Audit Log, Analytics, Settings
- Topbar: `SidebarTrigger`, breadcrumbs (derived from route), env badge (prod/preview), reserve-ratio mini-pill, global refresh, ⌘K trigger, theme toggle, admin avatar menu.
- Command palette (`cmdk` via shadcn `Command`): jump to any admin route, run quick actions (Resolve next pending, Approve next withdrawal, Open disputes).
- Strip the per-page `<Navbar/>` + `<Footer/>` — the layout owns chrome. `MobileNav` is hidden on `/admin/*`.

### 2. Routing & IA

Rewrite admin routes in `src/App.tsx` under a single parent using `Outlet`:

```text
/admin                       → Overview
/admin/operations/events     → Event Stream
/admin/markets               → Markets list
/admin/markets/new           → New Market
/admin/markets/resolution    → Resolution queue
/admin/markets/liquidity     → Liquidity
/admin/markets/sources       → Source registry
/admin/finance/treasury      → Treasury
/admin/finance/reconciliation→ Reconciliation
/admin/risk/fraud            → Fraud
/admin/risk/disputes         → Disputes
/admin/risk/users            → Users
/admin/system/audit          → Audit log
/admin/system/analytics      → Analytics
/admin/system/settings       → Feature flags, source weights, fees (new)
```

Legacy paths (`/admin/treasury`, `/admin/fraud`, etc.) keep `<Navigate replace>` redirects to the new URLs so existing bookmarks survive.

### 3. Shared primitives (`src/components/admin/primitives/`)

- `AdminPageHeader` — title, subtitle, icon, action slot, breadcrumb-aware.
- `AdminDataTable<T>` — TanStack-table wrapper with sticky header, density toggle, column visibility, CSV export, server-pagination hook, row selection, empty/loading/error states.
- `AdminFilterBar` — search + status chips + date-range + saved-view dropdown; URL-synced (`useSearchParams`).
- `AdminStatCard` / `AdminStatGrid` — replaces the ad-hoc KPI cards on Overview, Treasury, Analytics.
- `AdminConfirmDialog` — destructive/critical actions require typed reason (enforces `mem://security/admin-audit-protocol`); writes to `admin_audit_log` automatically.
- `AdminEmptyState`, `AdminErrorState`, `AdminSectionCard`.
- `useAdminRealtime(channel, table, filter)` — wraps existing `mem://tech/realtime-pattern` (unique channel name, `removeChannel` cleanup).

Every page is refactored to consume these — no more bespoke headers, tables, dialogs, or KPI tiles.

### 4. Per-page audit & refactor

For each page: dedupe queries, move to shared primitives, add realtime where it matters, fix any leaked sensitive columns.

- **Overview** — redesign as a true ops dashboard: 3 KPI rows (Liquidity, Activity, Risk), reserve-ratio gauge, pending-actions queue, recent audit events live feed.
- **Event Stream** — realtime `admin_audit_log` + `transactions` + `trades` merged feed with filters.
- **Markets** — replace bespoke table with `AdminDataTable`; bulk actions (pause, resume, flag); inline status edit.
- **New Market** — keep `MarketBuilder`, wrap in standard layout; add draft autosave indicator.
- **Resolution** — split tabs: Pending / Disputed / Recently resolved; one-click resolve with evidence snapshot dialog (already required by oracle policy).
- **Liquidity** — per-market liquidity view; add seed-liquidity action behind confirm dialog.
- **Sources** — fold `AdminSourceRegistry` in; CRUD + reliability score editor.
- **Treasury** — realtime pending deposits/withdrawals queue; approve/reject with reason; show till balance vs liabilities chart.
- **Reconciliation** — daily ledger diff view; export CSV.
- **Fraud** — realtime flagged events; M-Pesa receipt dedupe view; rapid-deposit list; block/unblock user action.
- **Disputes** — promote `AdminDisputes` to first-class page; SLA timer per dispute.
- **Users** — replace bespoke `AdminUsers` with `AdminDataTable`; role assignment (super_admin only), KYC status, suspend/restore with reason.
- **Audit Log** — full-text search, actor/action/target filters, JSON diff viewer per row.
- **Analytics** — keep charts, move to `AdminStatGrid` + recharts cards; add date-range picker.
- **Settings (new)** — feature flags, source weights, fee schedule, withdrawal limits. Super_admin only.

### 5. Role-aware visibility

`useAdminRole()` hook returns `'market_operator' | 'admin' | 'super_admin'`. Sidebar items and routes filter by:

- `market_operator` → Markets group only.
- `admin` → everything except Settings, Reconciliation write actions, role assignment.
- `super_admin` → all.

Enforced both client-side (nav/UI) and via existing RLS / `has_any_role` on the server.

### 6. Cleanup

- Delete the old standalone `Navbar`/`Footer` usage inside every admin page.
- Move `src/components/admin/AdminDisputes.tsx`, `AdminMatches.tsx`, `AdminSourceRegistry.tsx`, `AdminUsers.tsx`, `MarketBuilder.tsx` into feature folders under `src/features/admin/{markets,risk,users,sources}/` and update imports.
- Remove any dead helpers found during the audit; log them in the closing message rather than silently deleting.

### Technical notes

- No new DB tables. May add a `admin_settings` table later for Settings page — flagged as follow-up, not in this pass.
- Sidebar state persisted via the existing shadcn sidebar cookie.
- Breadcrumbs derived from a `routeMeta` map keyed by path → `{ group, title }`.
- All destructive admin RPCs already write to `admin_audit_log`; `AdminConfirmDialog` enforces a `reason` field client-side to match.
- Realtime channels follow `admin:<page>:<uuid>` naming per memory rule.

### Out of scope (explicit)

- No changes to user-facing routes, theme, or market logic.
- No new business logic — pure admin UX/IA refactor plus reuse of existing RPCs.
- AI assistance in admin — excluded per memory.
