CREATE TABLE public.market_intelligence (
  market_id uuid PRIMARY KEY REFERENCES public.markets(id) ON DELETE CASCADE,
  summary text,
  bull_case text,
  bear_case text,
  risk_level text CHECK (risk_level IN ('low','medium','high','critical')),
  risk_notes text,
  confidence integer CHECK (confidence BETWEEN 0 AND 100),
  momentum numeric,
  buy_pressure numeric,
  sell_pressure numeric,
  liquidity_score integer,
  event_timeline jsonb DEFAULT '[]'::jsonb,
  sources jsonb DEFAULT '[]'::jsonb,
  generated_by text DEFAULT 'logik-oracle',
  oracle_run_id uuid,
  lang text DEFAULT 'en',
  generated_at timestamptz DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.market_intelligence TO anon;
GRANT SELECT ON public.market_intelligence TO authenticated;
GRANT ALL ON public.market_intelligence TO service_role;

ALTER TABLE public.market_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read market intelligence"
  ON public.market_intelligence FOR SELECT
  USING (true);

CREATE TRIGGER trg_market_intelligence_updated_at
  BEFORE UPDATE ON public.market_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.market_intelligence;

INSERT INTO public.job_definitions (job_type, display_name, description, cron_expression, handler, enabled, default_payload, owner_group)
VALUES (
  'refresh-market-intelligence',
  'Refresh Market Intelligence',
  'Refresh AI intelligence for top 25 markets by 24h volume',
  '*/15 * * * *',
  'market-intelligence',
  true,
  '{"mode":"top","limit":25}'::jsonb,
  'oracle'
) ON CONFLICT (job_type) DO NOTHING;