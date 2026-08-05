-- ============ COMPETITIONS ============
CREATE TABLE public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text,
  country text,
  country_code text,
  logo_url text,
  competition_type text NOT NULL DEFAULT 'league',
  tier integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.competitions TO anon;
GRANT SELECT ON public.competitions TO authenticated;
GRANT ALL ON public.competitions TO service_role;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitions public read" ON public.competitions FOR SELECT USING (true);
CREATE POLICY "competitions admin write" ON public.competitions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_operator']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_operator']::app_role[]));
CREATE TRIGGER trg_competitions_updated BEFORE UPDATE ON public.competitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SEASONS ============
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  name text NOT NULL,
  year integer,
  starts_on date,
  ends_on date,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, name)
);
GRANT SELECT ON public.seasons TO anon;
GRANT SELECT ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons public read" ON public.seasons FOR SELECT USING (true);
CREATE POLICY "seasons admin write" ON public.seasons FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_operator']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_operator']::app_role[]));
CREATE TRIGGER trg_seasons_updated BEFORE UPDATE ON public.seasons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TEAMS ============
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text,
  code text,
  country text,
  logo_url text,
  venue_name text,
  founded integer,
  is_national boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO anon;
GRANT SELECT ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams public read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams admin write" ON public.teams FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_operator']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_operator']::app_role[]));
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PLATFORM MATCHES ============
CREATE TABLE public.platform_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
  season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  home_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  away_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  kickoff_at timestamptz NOT NULL,
  status match_status NOT NULL DEFAULT 'upcoming',
  minute integer,
  home_score integer,
  away_score integer,
  venue text,
  round text,
  legacy_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_platform_matches_kickoff ON public.platform_matches (kickoff_at DESC);
CREATE INDEX idx_platform_matches_status ON public.platform_matches (status);
CREATE INDEX idx_platform_matches_competition ON public.platform_matches (competition_id);
CREATE UNIQUE INDEX idx_platform_matches_legacy ON public.platform_matches (legacy_match_id) WHERE legacy_match_id IS NOT NULL;
GRANT SELECT ON public.platform_matches TO anon;
GRANT SELECT ON public.platform_matches TO authenticated;
GRANT ALL ON public.platform_matches TO service_role;
ALTER TABLE public.platform_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_matches public read" ON public.platform_matches FOR SELECT USING (true);
CREATE POLICY "platform_matches admin write" ON public.platform_matches FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_operator']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_operator']::app_role[]));
CREATE TRIGGER trg_platform_matches_updated BEFORE UPDATE ON public.platform_matches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MATCH EVENTS ============
CREATE TABLE public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.platform_matches(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  minute integer,
  extra_minute integer,
  player_name text,
  related_player_name text,
  detail text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_match_events_match ON public.match_events (match_id, minute, sort_order);
GRANT SELECT ON public.match_events TO anon;
GRANT SELECT ON public.match_events TO authenticated;
GRANT ALL ON public.match_events TO service_role;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_events public read" ON public.match_events FOR SELECT USING (true);
CREATE POLICY "match_events admin write" ON public.match_events FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_operator']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_operator']::app_role[]));

-- ============ PROVIDER CONNECTIONS ============
CREATE TABLE public.provider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  display_name text NOT NULL,
  base_url text NOT NULL,
  secret_name text,
  environment text NOT NULL DEFAULT 'production',
  priority integer NOT NULL DEFAULT 100,
  is_enabled boolean NOT NULL DEFAULT true,
  rate_limit_per_min integer,
  retry_policy jsonb NOT NULL DEFAULT '{"max_attempts":3,"backoff_ms":1000}'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  health_status text NOT NULL DEFAULT 'unknown',
  last_latency_ms integer,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_connections TO authenticated;
GRANT ALL ON public.provider_connections TO service_role;
ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_connections admin" ON public.provider_connections FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));
CREATE TRIGGER trg_provider_connections_updated BEFORE UPDATE ON public.provider_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PROVIDER MAPPINGS ============
CREATE TABLE public.provider_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  entity_type text NOT NULL,
  external_id text NOT NULL,
  canonical_id uuid NOT NULL,
  raw_label text,
  confidence integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, entity_type, external_id)
);
CREATE INDEX idx_provider_mappings_canonical ON public.provider_mappings (entity_type, canonical_id);
GRANT SELECT ON public.provider_mappings TO authenticated;
GRANT ALL ON public.provider_mappings TO service_role;
ALTER TABLE public.provider_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_mappings admin read" ON public.provider_mappings FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_operator']::app_role[]));
CREATE TRIGGER trg_provider_mappings_updated BEFORE UPDATE ON public.provider_mappings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FEATURE FLAGS ============
CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  description text,
  product text NOT NULL DEFAULT 'all',
  is_enabled boolean NOT NULL DEFAULT false,
  rollout_percentage integer NOT NULL DEFAULT 100,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon;
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags public read" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "feature_flags super admin write" ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_feature_flags_updated BEFORE UPDATE ON public.feature_flags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ API KEYS ============
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[],
  product text NOT NULL DEFAULT 'platform',
  owner_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys admin" ON public.api_keys FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));
CREATE TRIGGER trg_api_keys_updated BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CACHE ENTRIES ============
CREATE TABLE public.cache_entries (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cache_entries_tags ON public.cache_entries USING gin (tags);
CREATE INDEX idx_cache_entries_expiry ON public.cache_entries (expires_at);
GRANT SELECT ON public.cache_entries TO authenticated;
GRANT ALL ON public.cache_entries TO service_role;
ALTER TABLE public.cache_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cache_entries admin read" ON public.cache_entries FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

-- ============ MARKETS LINK ============
ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS platform_match_id uuid REFERENCES public.platform_matches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_markets_platform_match ON public.markets (platform_match_id);

-- ============ SYNC MONITOR VIEWS ============
CREATE OR REPLACE VIEW public.sync_jobs
WITH (security_invoker = true) AS
  SELECT id, job_type, status, payload, attempts, max_attempts, last_error,
         run_after, locked_until, priority, started_at, finished_at, duration_ms,
         result, scheduled_by, parent_job_id, cancel_reason, created_at, updated_at
  FROM public.system_jobs;

CREATE OR REPLACE VIEW public.sync_logs
WITH (security_invoker = true) AS
  SELECT id, source_id, source_name, status, records_fetched, records_processed,
         error_message, raw_data, created_at
  FROM public.ingestion_logs;

-- ============ BACKFILL LEGACY MATCHES ============
INSERT INTO public.competitions (slug, name, country)
SELECT DISTINCT
  regexp_replace(lower(trim(m.league)), '[^a-z0-9]+', '-', 'g'),
  trim(m.league),
  NULL
FROM public.matches m
WHERE m.league IS NOT NULL AND trim(m.league) <> ''
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.teams (slug, name)
SELECT DISTINCT regexp_replace(lower(trim(t.name)), '[^a-z0-9]+', '-', 'g'), trim(t.name)
FROM (
  SELECT home_team AS name FROM public.matches WHERE home_team IS NOT NULL AND trim(home_team) <> ''
  UNION
  SELECT away_team AS name FROM public.matches WHERE away_team IS NOT NULL AND trim(away_team) <> ''
) t
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.platform_matches
  (competition_id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score, legacy_match_id)
SELECT
  c.id, ht.id, at.id, m.kickoff, m.status, m.home_score, m.away_score, m.id
FROM public.matches m
LEFT JOIN public.competitions c ON c.slug = regexp_replace(lower(trim(m.league)), '[^a-z0-9]+', '-', 'g')
LEFT JOIN public.teams ht ON ht.slug = regexp_replace(lower(trim(m.home_team)), '[^a-z0-9]+', '-', 'g')
LEFT JOIN public.teams at ON at.slug = regexp_replace(lower(trim(m.away_team)), '[^a-z0-9]+', '-', 'g')
ON CONFLICT DO NOTHING;

INSERT INTO public.provider_mappings (provider, entity_type, external_id, canonical_id, raw_label)
SELECT 'thesportsdb', 'match', m.external_match_id, pm.id, m.home_team || ' vs ' || m.away_team
FROM public.matches m
JOIN public.platform_matches pm ON pm.legacy_match_id = m.id
WHERE m.external_match_id IS NOT NULL
ON CONFLICT (provider, entity_type, external_id) DO NOTHING;

UPDATE public.markets mk
SET platform_match_id = pm.id
FROM public.platform_matches pm
WHERE pm.legacy_match_id = mk.match_id AND mk.platform_match_id IS NULL;

-- ============ SEED PROVIDER + FLAGS ============
INSERT INTO public.provider_connections (provider, display_name, base_url, secret_name, priority, is_enabled, rate_limit_per_min, config)
VALUES
  ('thesportsdb', 'TheSportsDB', 'https://www.thesportsdb.com/api/v1/json', NULL, 10, true, 60,
   '{"api_key":"123","leagues":[4328,4335,4332,4331,4334,4337,4344,4359,4346,4330,4481]}'::jsonb),
  ('sportmonks', 'SportMonks', 'https://api.sportmonks.com/v3/football', 'SPORTMONKS_API_KEY', 20, false, 60, '{}'::jsonb)
ON CONFLICT (provider) DO NOTHING;

INSERT INTO public.feature_flags (key, description, product, is_enabled) VALUES
  ('platform_api_v1', 'Serve reads through the /api/v1 platform gateway', 'all', true),
  ('football_core_ui', 'Show canonical football entities in admin', 'all', true),
  ('betwise_public_read', 'Allow the Betwise PWA to read public platform endpoints', 'betwise', true)
ON CONFLICT (key) DO NOTHING;