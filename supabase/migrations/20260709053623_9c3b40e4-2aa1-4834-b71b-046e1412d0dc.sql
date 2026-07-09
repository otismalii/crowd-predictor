
-- Extend system_jobs
ALTER TABLE public.system_jobs
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS result jsonb,
  ADD COLUMN IF NOT EXISTS scheduled_by text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES public.system_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE INDEX IF NOT EXISTS idx_system_jobs_claim
  ON public.system_jobs (status, run_after, priority)
  WHERE status IN ('queued','running');

CREATE INDEX IF NOT EXISTS idx_system_jobs_type_created
  ON public.system_jobs (job_type, created_at DESC);

-- Job definitions catalog
CREATE TABLE IF NOT EXISTS public.job_definitions (
  job_type text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  handler text NOT NULL,
  cron_expression text,
  enabled boolean NOT NULL DEFAULT true,
  timeout_seconds integer NOT NULL DEFAULT 120,
  default_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_group text NOT NULL DEFAULT 'platform',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.job_definitions TO authenticated;
GRANT ALL ON public.job_definitions TO service_role;

ALTER TABLE public.job_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read job_definitions" ON public.job_definitions
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE POLICY "Super admins update job_definitions" ON public.job_definitions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_job_definitions_updated_at
  BEFORE UPDATE ON public.job_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed known jobs
INSERT INTO public.job_definitions (job_type, display_name, description, handler, cron_expression, timeout_seconds, owner_group) VALUES
  ('sync-matches','Sync Matches','Pull latest match fixtures/results from SportMonks','sync-matches','*/15 * * * *',120,'markets'),
  ('compute-trends','Compute Market Trends','Recompute market trend snapshots','compute-trends','*/10 * * * *',60,'markets'),
  ('reconcile-ledger','Reconcile Ledger','Verify wallet totals against immutable ledger','reconcile-ledger','0 * * * *',180,'finance'),
  ('retry-payments','Retry Failed Payments','Retry failed PesaPal deposits/withdrawals','retry-payments','*/5 * * * *',60,'finance'),
  ('creator-payouts','Creator Payouts','Process pending creator payouts','creator-payouts','0 2 * * *',300,'finance'),
  ('logik-oracle','Oracle Analyze Queue','Run Oracle analysis on markets awaiting resolution','logik-oracle','*/30 * * * *',180,'intelligence')
ON CONFLICT (job_type) DO NOTHING;

-- Update system_jobs RLS: admin reads
DROP POLICY IF EXISTS "Admins read system_jobs" ON public.system_jobs;
CREATE POLICY "Admins read system_jobs" ON public.system_jobs
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

-- Health view
CREATE OR REPLACE VIEW public.v_job_health AS
SELECT
  d.job_type,
  d.display_name,
  d.enabled,
  d.cron_expression,
  (SELECT max(finished_at) FROM public.system_jobs j WHERE j.job_type = d.job_type AND j.status IN ('succeeded','failed')) AS last_run,
  (SELECT min(run_after) FROM public.system_jobs j WHERE j.job_type = d.job_type AND j.status='queued') AS next_run,
  COALESCE((SELECT count(*) FILTER (WHERE status='queued') FROM public.system_jobs j WHERE j.job_type=d.job_type),0) AS pending_count,
  COALESCE((SELECT count(*) FILTER (WHERE status='running') FROM public.system_jobs j WHERE j.job_type=d.job_type),0) AS running_count,
  COALESCE((SELECT count(*) FILTER (WHERE status='succeeded' AND finished_at > now()-interval '24 hours') FROM public.system_jobs j WHERE j.job_type=d.job_type),0) AS success_24h,
  COALESCE((SELECT count(*) FILTER (WHERE status='failed' AND finished_at > now()-interval '24 hours') FROM public.system_jobs j WHERE j.job_type=d.job_type),0) AS failure_24h,
  COALESCE((SELECT avg(duration_ms)::int FROM public.system_jobs j WHERE j.job_type=d.job_type AND finished_at > now()-interval '24 hours'),0) AS avg_duration_ms
FROM public.job_definitions d;

GRANT SELECT ON public.v_job_health TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_jobs;
