---
name: Automation Jobs
description: Background job system — system_jobs queue, job_definitions catalog, jobs-dispatch worker, and pg_cron scheduling
type: feature
---
# Automation & Jobs

- `system_jobs` is the queue; `job_definitions` is the catalog. Truth of a run lives on `system_jobs`.
- `jobs-dispatch` edge function runs every minute via pg_cron (`jobs-dispatch-minute`). It:
  1. Claims up to 5 queued jobs (status='queued', run_after<=now(), order by priority, run_after).
  2. Invokes the handler edge function named in `job_definitions.handler` with `{ job_id, payload }`.
  3. Writes result/duration/status; on failure retries with exponential backoff up to `max_attempts` (default 5).
  4. Enqueues cron-scheduled definitions when their cadence window has elapsed and no queued/running row exists.
- `jobs-enqueue` (admin/super_admin only) inserts a manual run and writes an audit_logs entry.
- `jobs-cancel` (admin/super_admin) requires a reason and audit-logs the cancellation.
- Admin UI: `/admin/audit/automation`. Realtime subscribes to `system_jobs`.
- Handlers must be idempotent — the dispatcher may retry on failure.
- View `v_job_health` powers dashboard stats (24h success/fail/avg duration).
