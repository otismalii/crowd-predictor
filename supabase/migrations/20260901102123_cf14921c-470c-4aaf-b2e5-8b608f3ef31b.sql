-- =========================================================
-- 1. Job queue: one status vocabulary
-- =========================================================
ALTER TABLE public.system_jobs ALTER COLUMN status SET DEFAULT 'queued';

ALTER TABLE public.system_jobs ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS system_jobs_dedupe_key_uidx
  ON public.system_jobs (dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS system_jobs_claim_idx
  ON public.system_jobs (status, run_after);

CREATE OR REPLACE FUNCTION public.reap_stale_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH reaped AS (
    UPDATE public.system_jobs
    SET status = CASE WHEN COALESCE(attempts,0) >= COALESCE(max_attempts,5) THEN 'failed' ELSE 'queued' END,
        last_error = COALESCE(last_error, 'lease expired — reaped'),
        locked_until = NULL,
        run_after = now(),
        updated_at = now()
    WHERE status = 'running' AND locked_until IS NOT NULL AND locked_until < now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM reaped;
  RETURN v_count;
END;
$$;

-- =========================================================
-- 2. Job catalogue
-- =========================================================
UPDATE public.job_definitions SET enabled = false, updated_at = now()
WHERE job_type IN (
  'sync-matches','compute-trends','logik-oracle',
  'refresh-market-intelligence','creator-payouts','settle-market','refund-market'
);

INSERT INTO public.job_definitions
  (job_type, display_name, description, handler, cron_expression, default_payload, owner_group, timeout_seconds, enabled)
VALUES
  ('sync-live','Live Sync','Refresh live/today fixtures, reconcile stale fixtures and auto-settle finished matches.',
   'sync-live','* * * * *','{}'::jsonb,'sportsbook',110,true),
  ('sync-content','Content Sync','Backfill team badges and publish result headlines.',
   'sync-content','*/30 * * * *','{}'::jsonb,'sportsbook',110,true),
  ('generate-odds','Generate Odds','Price every upcoming fixture that has no live odds.',
   'generate-odds','*/10 * * * *','{}'::jsonb,'sportsbook',110,true)
ON CONFLICT (job_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  handler = EXCLUDED.handler,
  cron_expression = EXCLUDED.cron_expression,
  owner_group = EXCLUDED.owner_group,
  timeout_seconds = EXCLUDED.timeout_seconds,
  enabled = true,
  updated_at = now();

-- =========================================================
-- 3. Providers: football-data.org primary, TheSportsDB fallback
-- =========================================================
UPDATE public.provider_connections SET priority = 20, updated_at = now() WHERE provider = 'thesportsdb';

INSERT INTO public.provider_connections
  (provider, display_name, base_url, secret_name, priority, is_enabled, rate_limit_per_min, config)
VALUES (
  'footballdata','Football-Data.org','https://api.football-data.org/v4','FOOTBALL_DATA_API_TOKEN',
  1, true, 10,
  '{"competitions":["PL","ELC","BL1","SA","PD","FL1","DED","PPL","BSA","CL"],"request_budget":8}'::jsonb
)
ON CONFLICT (provider) DO UPDATE SET
  base_url = EXCLUDED.base_url,
  secret_name = EXCLUDED.secret_name,
  priority = EXCLUDED.priority,
  is_enabled = true,
  rate_limit_per_min = EXCLUDED.rate_limit_per_min,
  config = EXCLUDED.config,
  updated_at = now();

-- =========================================================
-- 4. Watchdogs
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_expire_stale_fixtures(
  p_upcoming_grace_hours integer DEFAULT 6,
  p_live_grace_hours integer DEFAULT 4
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_id uuid;
  v_settled integer := 0;
BEGIN
  WITH stale AS (
    UPDATE public.platform_matches m
    SET status = 'postponed', updated_at = now()
    WHERE (
        (m.status = 'upcoming' AND m.kickoff_at < now() - make_interval(hours => p_upcoming_grace_hours))
        OR (m.status = 'live' AND m.kickoff_at < now() - make_interval(hours => p_live_grace_hours))
      )
    RETURNING m.id
  )
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_ids FROM stale;

  FOREACH v_id IN ARRAY v_ids LOOP
    IF EXISTS (SELECT 1 FROM public.match_bets WHERE match_id = v_id AND status = 'open') THEN
      PERFORM public.fn_settle_match_bets(v_id);
      v_settled := v_settled + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('expired', COALESCE(array_length(v_ids,1),0), 'settled', v_settled);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_settle_pending_matches(p_limit integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_id IN
    SELECT DISTINCT m.id
    FROM public.platform_matches m
    JOIN public.match_bets b ON b.match_id = m.id AND b.status = 'open'
    WHERE m.status IN ('finished','cancelled','postponed')
    LIMIT GREATEST(p_limit, 1)
  LOOP
    PERFORM public.fn_settle_match_bets(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('matches_settled', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reap_stale_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_expire_stale_fixtures(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_settle_pending_matches(integer) TO service_role;