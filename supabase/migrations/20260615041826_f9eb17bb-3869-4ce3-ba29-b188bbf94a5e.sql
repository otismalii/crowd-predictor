
-- Extend market_suggestions
ALTER TABLE public.market_suggestions
  ADD COLUMN IF NOT EXISTS quality_score integer,
  ADD COLUMN IF NOT EXISTS quality_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS oracle_run_id uuid,
  ADD COLUMN IF NOT EXISTS source_evidence jsonb,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS risk_flags jsonb;

CREATE INDEX IF NOT EXISTS idx_market_suggestions_quality
  ON public.market_suggestions (quality_score DESC, status);

-- oracle_runs: every LOGIK call logged
CREATE TABLE IF NOT EXISTS public.oracle_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_stage text NOT NULL,
  action text NOT NULL,
  input jsonb,
  output jsonb,
  model text,
  latency_ms integer,
  cost_estimate numeric,
  status text NOT NULL DEFAULT 'success',
  error text,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oracle_runs_created ON public.oracle_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_runs_stage ON public.oracle_runs (pipeline_stage, action);

GRANT SELECT ON public.oracle_runs TO authenticated;
GRANT ALL ON public.oracle_runs TO service_role;
ALTER TABLE public.oracle_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read oracle_runs" ON public.oracle_runs
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','analyst','market_manager']::app_role[]));

-- market_quality_scores
CREATE TABLE IF NOT EXISTS public.market_quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES public.markets(id) ON DELETE CASCADE,
  suggestion_id uuid REFERENCES public.market_suggestions(id) ON DELETE CASCADE,
  score integer NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  scored_by text NOT NULL DEFAULT 'logik_oracle',
  oracle_run_id uuid REFERENCES public.oracle_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (market_id IS NOT NULL OR suggestion_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_mqs_market ON public.market_quality_scores (market_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mqs_suggestion ON public.market_quality_scores (suggestion_id, created_at DESC);

GRANT SELECT ON public.market_quality_scores TO authenticated;
GRANT ALL ON public.market_quality_scores TO service_role;
ALTER TABLE public.market_quality_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read quality scores" ON public.market_quality_scores
  FOR SELECT TO authenticated USING (true);
