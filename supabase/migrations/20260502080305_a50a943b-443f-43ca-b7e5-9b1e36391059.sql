
CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  wallet_balance NUMERIC NOT NULL DEFAULT 0,
  ledger_balance NUMERIC NOT NULL DEFAULT 0,
  drift NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view reconciliation" ON public.reconciliation_runs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Service role manages reconciliation" ON public.reconciliation_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_reconciliation_runs_run_at ON public.reconciliation_runs(run_at DESC);
CREATE INDEX idx_reconciliation_runs_status ON public.reconciliation_runs(status) WHERE status != 'ok';

CREATE OR REPLACE FUNCTION public.derived_balance(p_user_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount), 0)::numeric FROM ledger_entries
  WHERE user_id = p_user_id AND bucket = 'main';
$$;
REVOKE EXECUTE ON FUNCTION public.derived_balance(UUID) FROM anon;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;
REVOKE EXECUTE ON FUNCTION public.has_any_role(UUID, app_role[]) FROM anon;

CREATE TABLE IF NOT EXISTS public.risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_end TIMESTAMPTZ,
  metric_value NUMERIC,
  threshold NUMERIC,
  action_taken TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.risk_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view risk signals" ON public.risk_signals
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Service role manages risk signals" ON public.risk_signals
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_risk_signals_user ON public.risk_signals(user_id, created_at DESC);
CREATE INDEX idx_risk_signals_severity ON public.risk_signals(severity, created_at DESC) WHERE severity IN ('high','critical');

ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS treasury_subsidy NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.market_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL,
  "window" TEXT NOT NULL,
  volume_delta NUMERIC NOT NULL DEFAULT 0,
  price_delta NUMERIC NOT NULL DEFAULT 0,
  unique_traders INTEGER NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB DEFAULT '{}'::jsonb
);
ALTER TABLE public.market_trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trends viewable by everyone" ON public.market_trends FOR SELECT USING (true);
CREATE POLICY "Service role manages trends" ON public.market_trends FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_market_trends_market_window ON public.market_trends(market_id, "window", computed_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  reference TEXT,
  user_id UUID,
  amount NUMERIC,
  payload JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view payment failures" ON public.payment_failures
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Service role manages payment failures" ON public.payment_failures
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_payment_failures_pending ON public.payment_failures(next_retry_at) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.enforce_market_resolution_evidence()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    IF NOT EXISTS (SELECT 1 FROM market_sources WHERE market_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot resolve market without source evidence in market_sources';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM market_audit_log WHERE market_id = NEW.id AND action LIKE 'resolve%'
        AND created_at > now() - interval '5 seconds'
    ) THEN
      RAISE EXCEPTION 'Cannot resolve market without audit log entry';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_market_resolution ON public.markets;
CREATE TRIGGER trg_enforce_market_resolution
  BEFORE UPDATE ON public.markets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_market_resolution_evidence();
