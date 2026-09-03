
ALTER TABLE public.system_jobs DROP CONSTRAINT IF EXISTS system_jobs_status_check;

UPDATE public.system_jobs SET status = 'queued' WHERE status = 'pending';
UPDATE public.system_jobs SET status = 'succeeded' WHERE status = 'done';

ALTER TABLE public.system_jobs
  ADD CONSTRAINT system_jobs_status_check
  CHECK (status IN ('queued','running','succeeded','failed','cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS system_jobs_dedupe_key_uidx
  ON public.system_jobs (dedupe_key) WHERE dedupe_key IS NOT NULL;
