
-- =========================================================
-- WAVE 1A: TREASURY SUB-LEDGER
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.treasury_bucket AS ENUM (
    'user_funds','platform_revenue','liquidity_pool','settlement_reserve','operational_reserve'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.treasury_accounts (
  bucket public.treasury_bucket PRIMARY KEY,
  balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.treasury_accounts TO authenticated;
GRANT ALL ON public.treasury_accounts TO service_role;
ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view treasury accounts" ON public.treasury_accounts;
CREATE POLICY "Admins view treasury accounts" ON public.treasury_accounts
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_manager']::app_role[]));

INSERT INTO public.treasury_accounts (bucket, balance)
SELECT b, 0 FROM unnest(enum_range(NULL::public.treasury_bucket)) AS b
ON CONFLICT (bucket) DO NOTHING;

ALTER TABLE public.ledger_entries
  ADD COLUMN IF NOT EXISTS treasury_bucket public.treasury_bucket;
UPDATE public.ledger_entries SET treasury_bucket = 'user_funds' WHERE treasury_bucket IS NULL;
ALTER TABLE public.ledger_entries
  ALTER COLUMN treasury_bucket SET NOT NULL,
  ALTER COLUMN treasury_bucket SET DEFAULT 'user_funds';
CREATE INDEX IF NOT EXISTS idx_ledger_treasury_bucket_created
  ON public.ledger_entries (treasury_bucket, created_at DESC);

UPDATE public.treasury_accounts ta
SET balance = COALESCE(s.total,0), updated_at = now()
FROM (SELECT treasury_bucket, SUM(amount)::numeric AS total FROM public.ledger_entries GROUP BY treasury_bucket) s
WHERE ta.bucket = s.treasury_bucket;

CREATE OR REPLACE VIEW public.v_treasury_balances
WITH (security_invoker = true) AS
SELECT b.bucket,
       COALESCE(SUM(le.amount),0)::numeric AS ledger_balance,
       ta.balance AS cached_balance,
       COALESCE(SUM(le.amount),0)::numeric - ta.balance AS drift
FROM (SELECT unnest(enum_range(NULL::public.treasury_bucket)) AS bucket) b
LEFT JOIN public.ledger_entries le ON le.treasury_bucket = b.bucket
LEFT JOIN public.treasury_accounts ta ON ta.bucket = b.bucket
GROUP BY b.bucket, ta.balance;
GRANT SELECT ON public.v_treasury_balances TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_refresh_treasury_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.treasury_accounts SET balance = balance + NEW.amount, updated_at = now() WHERE bucket = NEW.treasury_bucket;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.treasury_accounts SET balance = balance - OLD.amount, updated_at = now() WHERE bucket = OLD.treasury_bucket;
    UPDATE public.treasury_accounts SET balance = balance + NEW.amount, updated_at = now() WHERE bucket = NEW.treasury_bucket;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.treasury_accounts SET balance = balance - OLD.amount, updated_at = now() WHERE bucket = OLD.treasury_bucket;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_refresh_treasury_account ON public.ledger_entries;
CREATE TRIGGER trg_refresh_treasury_account
AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.fn_refresh_treasury_account();

CREATE OR REPLACE FUNCTION public.fn_post_double_entry(
  p_debit_user uuid, p_credit_user uuid,
  p_debit_bucket public.treasury_bucket, p_credit_bucket public.treasury_bucket,
  p_amount numeric, p_entry_type text, p_description text,
  p_reference_id uuid, p_event_id uuid, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_debit_wallet uuid; v_credit_wallet uuid;
  v_debit_balance numeric; v_credit_balance numeric;
  v_existing uuid;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE'; END IF;

  SELECT id INTO v_existing FROM public.ledger_entries WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('replayed', true, 'entry_id', v_existing);
  END IF;

  IF p_debit_user IS NOT NULL THEN
    SELECT id, balance INTO v_debit_wallet, v_debit_balance FROM public.wallets WHERE user_id = p_debit_user FOR UPDATE;
    IF v_debit_balance IS NULL OR v_debit_balance < p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  END IF;
  IF p_credit_user IS NOT NULL THEN
    SELECT id, balance INTO v_credit_wallet, v_credit_balance FROM public.wallets WHERE user_id = p_credit_user FOR UPDATE;
    IF v_credit_balance IS NULL THEN
      INSERT INTO public.wallets (user_id) VALUES (p_credit_user) RETURNING id, balance INTO v_credit_wallet, v_credit_balance;
    END IF;
  END IF;

  INSERT INTO public.ledger_entries (user_id, wallet_id, amount, balance_after, entry_type, bucket, treasury_bucket, description, reference_id, idempotency_key, event_id)
  VALUES (p_debit_user, v_debit_wallet, -p_amount, COALESCE(v_debit_balance,0) - p_amount, p_entry_type, 'main', p_debit_bucket, p_description, p_reference_id, p_idempotency_key || ':debit', p_event_id);

  INSERT INTO public.ledger_entries (user_id, wallet_id, amount, balance_after, entry_type, bucket, treasury_bucket, description, reference_id, idempotency_key, event_id)
  VALUES (p_credit_user, v_credit_wallet, p_amount, COALESCE(v_credit_balance,0) + p_amount, p_entry_type, 'main', p_credit_bucket, p_description, p_reference_id, p_idempotency_key || ':credit', p_event_id);

  IF p_debit_user IS NOT NULL THEN
    UPDATE public.wallets SET balance = balance - p_amount, updated_at = now() WHERE user_id = p_debit_user;
  END IF;
  IF p_credit_user IS NOT NULL THEN
    UPDATE public.wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = p_credit_user;
  END IF;

  RETURN jsonb_build_object('replayed', false, 'amount', p_amount, 'debit_bucket', p_debit_bucket, 'credit_bucket', p_credit_bucket);
END $$;

REVOKE ALL ON FUNCTION public.fn_post_double_entry(uuid,uuid,public.treasury_bucket,public.treasury_bucket,numeric,text,text,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_post_double_entry(uuid,uuid,public.treasury_bucket,public.treasury_bucket,numeric,text,text,uuid,uuid,text) TO service_role;

-- =========================================================
-- WAVE 1B: ROLE PROMOTIONS + MARKETS POLICIES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.role_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_role text,
  to_role text NOT NULL,
  requested_by uuid,
  approved_by uuid,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  evidence jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.role_promotions TO authenticated;
GRANT ALL ON public.role_promotions TO service_role;
ALTER TABLE public.role_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own promotions" ON public.role_promotions;
CREATE POLICY "Users read own promotions" ON public.role_promotions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

DROP POLICY IF EXISTS "Admins manage promotions" ON public.role_promotions;
CREATE POLICY "Admins manage promotions" ON public.role_promotions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_role_promotions_status_created ON public.role_promotions (status, created_at DESC);

DROP POLICY IF EXISTS "Creators draft markets" ON public.markets;
CREATE POLICY "Creators draft markets" ON public.markets
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'draft' AND public.has_any_role(
      auth.uid(),
      ARRAY['market_creator','verified_creator','market_manager','admin','super_admin']::app_role[]
    )
  );

DROP POLICY IF EXISTS "Managers publish markets" ON public.markets;
CREATE POLICY "Managers publish markets" ON public.markets
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['market_manager','admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['market_manager','admin','super_admin']::app_role[]));
