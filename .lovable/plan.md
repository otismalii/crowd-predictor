## LDX Master Spec — Gap Analysis & Phase 1 Plan

### Part A — Gap Analysis (current state vs. LDX spec)

Legend: ✅ built · 🟡 partial · ❌ missing

**Foundations (mostly done)**
- ✅ React/Vite/TS/Tailwind/shadcn/TanStack/RHF/Zod/Monaco stack
- ✅ Supabase (Postgres + RLS + Edge Functions + Realtime + Storage)
- ✅ Double-entry ledger (`ledger_entries`, treasury buckets, drift invariant)
- ✅ Immutable audit (`audit_logs`, `market_audit_log`, `market_import_audit`)
- ✅ Idempotency on wallet/ledger writes
- ✅ PesaPal deposit/withdraw + retry
- ✅ Market Foundry v2 (JSON import: upload/paste/history/rollback)
- ✅ LOGIK Oracle as suggestion-only (advisory, never auto-settles)
- ✅ Realtime channels with cleanup pattern
- ✅ MCP server + OAuth consent

**Roles & Governance**
- 🟡 Roles: `super_admin/admin/market_manager/market_operator/analyst/verified_creator/market_creator/trusted_predictor` exist — but no **Mini Admin** role per spec (map to `market_creator` + explicit "submit for approval" workflow)
- 🟡 Creation queue exists (`AdminCreationQueuePage`) but no formal draft→pending→approved state machine on markets
- ✅ Role promotions with mandatory reason

**Market Lifecycle**
- 🟡 Statuses exist but LDX defines 9 stages (Draft → Pending Approval → Approved → Scheduled → Open → Locked → Awaiting Resolution → Resolved → Cancelled/Refunded → Archived). Current schema likely lacks `pending_approval`, `approved`, `scheduled`, `locked`, `archived` transitions
- ❌ Market types beyond binary/multi (Over/Under, Numeric Range, Tournament, Ranking, Custom) not modeled

**Resolution & Evidence**
- 🟡 Resolution page exists; `market_sources` table exists
- ❌ Dedicated Evidence Center (uploads, screenshots, reliability score, AI summary linkage)
- ❌ Resolution tabs (Awaiting Evidence / Ready / Manual Review / Appealed / Resolved) not fully formalized
- ❌ Appeals / dispute escalation workflow beyond `market_disputes` table

**Finance**
- 🟡 Treasury + reconciliation pages exist
- ❌ Configurable fees UI (trading/withdrawal/settlement/creator reward/commission) — only `app_settings` KV exists
- ❌ Revenue dashboards by period/category/method
- ❌ Per-market liquidity controls (seed/increase/reduce/pause/close) UI

**Automation / Jobs** ← **Phase 1 target**
- 🟡 `system_jobs` table exists (job_type, status, attempts, locked_until, run_after, last_error, payload)
- ❌ No worker/dispatcher edge function consuming it
- ❌ No admin dashboard surfacing job health
- ❌ No pg_cron scheduling wired to enqueue recurring jobs

**Risk / Notifications / Analytics**
- 🟡 `risk_signals`, `notifications`, `analyticsService` exist — but no unified Risk Engine rules config, no notification channel fan-out (push/email/SMS), analytics dashboards partial

**PWA / Offline**
- 🟡 SW guard implemented; offline-aware caching minimal

---

### Part B — Phase 1: Automation & Jobs Dashboard

**Goal:** Turn the existing `system_jobs` table into a first-class, observable job system with an admin dashboard, a generic worker, and cron-driven enqueue of the recurring jobs Pagaza already runs (sync-matches, compute-trends, reconcile-ledger, retry-payments, creator-payouts, oracle queue).

#### 1. Database (migration)
- Extend `system_jobs`:
  - `priority int default 100`, `max_attempts int default 5`
  - `started_at`, `finished_at`, `duration_ms`, `result jsonb`
  - `scheduled_by text` (cron | manual | event)
  - `parent_job_id uuid` (for chained jobs)
  - Index on `(status, run_after, priority)` for the claim query
- New table `job_definitions` (catalog of known job types):
  - `job_type` PK, `display_name`, `description`, `cron_expression`, `enabled bool`, `timeout_seconds`, `handler` (edge function name), `default_payload jsonb`, `owner_group text`
  - Seed rows for: `sync-matches`, `compute-trends`, `reconcile-ledger`, `retry-payments`, `creator-payouts`, `oracle-analyze`, `notification-flush`
- View `v_job_health`: per `job_type` — last_run, next_run, success_rate_24h, avg_duration_ms, failure_count_24h, pending_count
- RLS: admin/super_admin read all; service_role full; nothing for anon/authenticated
- GRANTs included

#### 2. Backend edge functions
- `jobs-dispatch` (invoked every minute by pg_cron):
  - `SELECT ... FOR UPDATE SKIP LOCKED` up to N jobs where `status='queued' AND run_after<=now()`
  - Sets `status='running'`, `locked_until=now()+timeout`, `started_at`, increments `attempts`
  - Invokes handler edge function; on completion writes `result`, `finished_at`, `duration_ms`, `status='succeeded'|'failed'`
  - On failure with `attempts < max_attempts`: reschedules with exponential backoff
  - Emits `event_log` entry `job.completed` / `job.failed`
- `jobs-enqueue` (admin-only): manually enqueue any registered job type with payload
- `jobs-cancel` (admin-only): cancel a queued/running job with reason (audit logged)
- Refactor existing recurring functions to be idempotent handlers callable by dispatcher (no logic change — just accept `{job_id}` and record result)

#### 3. pg_cron wiring
- One cron job every minute → HTTP POST to `jobs-dispatch`
- Cron entries per `job_definitions` row that has a `cron_expression` → insert a queued row into `system_jobs` (dispatcher then runs it)
- Uses `supabase--insert` (not migration) per rules, because it contains project URL + anon key

#### 4. Admin UI — `/admin/audit/automation` (new route, moved from a placeholder)
- **Overview cards**: Queued, Running, Succeeded (24h), Failed (24h), Avg latency
- **Job Definitions table**: type, cron, enabled toggle, last run, next run, success rate, avg duration, action menu (Run now, Pause, Edit payload)
- **Live Runs table** (realtime on `system_jobs`): id, type, status pill, started_at, duration, attempts, actions (View payload/result, Cancel, Retry)
- **Run detail drawer**: full payload, result, error, timeline, related event_log entries
- **Filters**: job_type, status, date range; virtualized table (react-window already installed)
- Uses existing `AdminDataTable`, `AdminPageHeader`, `AdminStatGrid` primitives

#### 5. Nav & routing
- Rename `adminNav.ts` entry `Audit > System Analytics` group: add **"Automation"** item pointing at `/admin/audit/automation`, roles `admin/super_admin`
- Add route in `App.tsx`

#### 6. Realtime & audit
- Add `system_jobs` to `supabase_realtime` publication
- Every manual enqueue/cancel writes `audit_logs` with reason

#### 7. Out of scope for Phase 1
- Fees config UI, Evidence Center, Mini Admin role rename, appeals workflow, expanded market types, push/SMS fan-out, revenue dashboards — deferred to later phases (plans to follow after Phase 1 lands)

#### Deliverables
- 1 migration (schema + view + RLS + grants + seed job_definitions)
- 1 insert-tool call (pg_cron schedule)
- 3 new edge functions (`jobs-dispatch`, `jobs-enqueue`, `jobs-cancel`)
- 1 refactor pass on existing recurring functions to conform to handler contract
- 1 new admin page + subcomponents
- Nav + route updates
- Memory entry: `mem://architecture/automation-jobs` documenting the contract

Approve to proceed with Phase 1, or say which phase you want next.