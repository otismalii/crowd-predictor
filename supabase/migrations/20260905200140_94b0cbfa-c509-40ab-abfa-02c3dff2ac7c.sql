-- 1. Settings ------------------------------------------------------------
INSERT INTO public.app_settings (key, value, description, category) VALUES
  ('withdraw_min_kes', '100'::jsonb, 'Minimum withdrawal amount in KES', 'finance'),
  ('withdraw_auto_approve_max_kes', '5000'::jsonb, 'Withdrawals at or below this amount auto-approve for low-risk accounts', 'finance'),
  ('deposit_min_kes', '10'::jsonb, 'Minimum deposit amount in KES', 'finance'),
  ('deposit_max_kes', '150000'::jsonb, 'Maximum single deposit in KES', 'finance'),
  ('platform_funds_user_id', '"2fa7ec11-a66c-46fb-b681-f839607ea25e"'::jsonb, 'Admin account designated as the platform funds/till account', 'finance')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, category = EXCLUDED.category;

-- 2. Withdrawal request extensions ---------------------------------------
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS transaction_id uuid,
  ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_withdrawal_requests_updated_at ON public.withdrawal_requests;
CREATE TRIGGER trg_withdrawal_requests_updated_at
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status, created_at DESC);

-- 3. Unique payment reference -------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_reference ON public.transactions(reference) WHERE reference IS NOT NULL;

-- 4. Withdrawal request RPC ---------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_request_withdrawal(
  p_user_id uuid,
  p_amount numeric,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_min numeric;
  v_auto_max numeric;
  v_phone text;
  v_wallet record;
  v_locked boolean;
  v_reference text;
  v_tx_id uuid;
  v_req_id uuid;
  v_risk boolean;
  v_auto boolean;
BEGIN
  SELECT COALESCE((value)::numeric, 100) INTO v_min FROM app_settings WHERE key = 'withdraw_min_kes';
  SELECT COALESCE((value)::numeric, 5000) INTO v_auto_max FROM app_settings WHERE key = 'withdraw_auto_approve_max_kes';
  v_min := COALESCE(v_min, 100);
  v_auto_max := COALESCE(v_auto_max, 5000);

  IF p_amount IS NULL OR p_amount < v_min THEN
    RAISE EXCEPTION 'BELOW_MINIMUM:%', v_min;
  END IF;

  SELECT COALESCE(p_phone, phone_number) INTO v_phone FROM profiles WHERE id = p_user_id;
  IF v_phone IS NULL OR v_phone !~ '^254[0-9]{9}$' THEN
    RAISE EXCEPTION 'PHONE_NOT_VERIFIED';
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;

  SELECT public.lock_for_withdrawal(p_user_id, p_amount) INTO v_locked;
  IF NOT v_locked THEN RAISE EXCEPTION 'INSUFFICIENT_OR_CAPPED'; END IF;

  v_reference := 'WDR-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(p_user_id::text, 1, 8);

  INSERT INTO transactions (user_id, wallet_id, type, amount, status, phone_number, reference, description)
  VALUES (p_user_id, v_wallet.id, 'withdrawal', p_amount, 'pending', v_phone, v_reference,
          'Withdrawal of KES ' || p_amount || ' to ' || v_phone)
  RETURNING id INTO v_tx_id;

  INSERT INTO ledger_entries (user_id, wallet_id, entry_type, amount, balance_after, bucket, treasury_bucket,
                              description, reference_id, idempotency_key)
  VALUES (p_user_id, v_wallet.id, 'withdrawal_lock', 0, v_wallet.balance - p_amount, 'main', 'user_funds',
          'Withdrawal hold', v_tx_id, 'withdraw_hold_' || v_tx_id::text);

  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'risk_flagged'
  ) OR COALESCE((SELECT risk_score FROM profiles WHERE id = p_user_id), 0) >= 50
  INTO v_risk;

  v_auto := (p_amount <= v_auto_max) AND NOT v_risk;

  INSERT INTO withdrawal_requests (user_id, amount, status, phone_number, payment_method,
                                   transaction_id, auto_approved, provider)
  VALUES (p_user_id, p_amount, 'pending', v_phone, 'mpesa', v_tx_id, v_auto, 'intasend')
  RETURNING id INTO v_req_id;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (p_user_id, 'withdrawal',
          CASE WHEN v_auto THEN 'Withdrawal processing' ELSE 'Withdrawal under review' END,
          'KES ' || p_amount || CASE WHEN v_auto THEN ' is being sent to ' || v_phone ELSE ' is awaiting review' END,
          '/wallet');

  RETURN jsonb_build_object('request_id', v_req_id, 'transaction_id', v_tx_id,
                            'reference', v_reference, 'auto_approved', v_auto, 'phone', v_phone);
END $$;

REVOKE ALL ON FUNCTION public.fn_request_withdrawal(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_request_withdrawal(uuid, numeric, text) TO service_role;

-- 5. Payout failure: release the hold ------------------------------------
CREATE OR REPLACE FUNCTION public.fn_fail_withdrawal_payout(p_request_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req record;
  v_wallet record;
  v_idem text;
BEGIN
  v_idem := 'withdrawal_failed_' || p_request_id::text;
  IF EXISTS (SELECT 1 FROM ledger_entries WHERE idempotency_key = v_idem) THEN
    RETURN jsonb_build_object('replayed', true);
  END IF;

  SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req IS NULL THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  IF v_req.status NOT IN ('pending','approved','processing') THEN RAISE EXCEPTION 'REQUEST_NOT_ACTIONABLE'; END IF;

  IF NOT public.release_withdrawal_lock(v_req.user_id, v_req.amount) THEN
    RAISE EXCEPTION 'LOCKED_FUNDS_MISSING';
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_req.user_id;

  INSERT INTO ledger_entries (user_id, wallet_id, amount, balance_after, entry_type, bucket, treasury_bucket,
                              description, reference_id, idempotency_key)
  VALUES (v_req.user_id, v_wallet.id, 0, v_wallet.balance, 'withdrawal_released', 'main', 'user_funds',
          'Payout failed — funds returned', p_request_id, v_idem);

  UPDATE withdrawal_requests
     SET status = 'failed', failure_reason = p_reason, reviewed_at = now()
   WHERE id = p_request_id;

  UPDATE transactions SET status = 'failed',
         description = COALESCE(description,'') || ' [PAYOUT FAILED: ' || COALESCE(p_reason,'unknown') || ']',
         updated_at = now()
   WHERE id = v_req.transaction_id;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (v_req.user_id, 'withdrawal', 'Withdrawal returned',
          'KES ' || v_req.amount || ' is back in your wallet. ' || COALESCE(p_reason,''), '/wallet');

  RETURN jsonb_build_object('replayed', false, 'amount', v_req.amount);
END $$;

REVOKE ALL ON FUNCTION public.fn_fail_withdrawal_payout(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fail_withdrawal_payout(uuid, text) TO service_role;

-- 6. Idempotent deposit credit ------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_credit_deposit(
  p_transaction_id uuid,
  p_provider_reference text,
  p_receipt text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx record;
  v_idem text;
BEGIN
  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id FOR UPDATE;
  IF v_tx IS NULL THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND'; END IF;
  IF v_tx.type <> 'deposit' THEN RAISE EXCEPTION 'NOT_A_DEPOSIT'; END IF;

  v_idem := 'deposit_' || COALESCE(p_provider_reference, p_transaction_id::text);

  IF v_tx.status = 'completed' THEN
    RETURN jsonb_build_object('replayed', true, 'amount', v_tx.amount);
  END IF;

  PERFORM public.fn_post_double_entry(
    NULL, v_tx.user_id,
    'operational_reserve'::treasury_bucket, 'user_funds'::treasury_bucket,
    v_tx.amount, 'deposit', 'Deposit confirmed', p_transaction_id, NULL, v_idem
  );

  UPDATE transactions
     SET status = 'completed',
         mpesa_receipt = COALESCE(p_receipt, mpesa_receipt),
         updated_at = now()
   WHERE id = p_transaction_id;

  UPDATE wallets SET last_deposit_at = now() WHERE user_id = v_tx.user_id;

  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (v_tx.user_id, 'deposit', 'Deposit received',
          'KES ' || v_tx.amount || ' is now in your wallet.', '/wallet');

  RETURN jsonb_build_object('replayed', false, 'amount', v_tx.amount);
END $$;

REVOKE ALL ON FUNCTION public.fn_credit_deposit(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_credit_deposit(uuid, text, text) TO service_role;

-- 7. Platform funds seeding ---------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_seed_platform_funds(
  p_admin_id uuid,
  p_bucket treasury_bucket,
  p_amount numeric,
  p_direction text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ref uuid := gen_random_uuid();
  v_idem text;
BEGIN
  IF NOT public.has_any_role(p_admin_id, ARRAY['admin','super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE'; END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  IF p_direction NOT IN ('in','out') THEN RAISE EXCEPTION 'INVALID_DIRECTION'; END IF;

  v_idem := 'treasury_seed_' || v_ref::text;

  IF p_direction = 'in' THEN
    PERFORM public.fn_post_double_entry(
      NULL, NULL, 'operational_reserve'::treasury_bucket, p_bucket,
      p_amount, 'credit_grant', 'Platform funds added: ' || p_reason, v_ref, NULL, v_idem
    );
  ELSE
    PERFORM public.fn_post_double_entry(
      NULL, NULL, p_bucket, 'operational_reserve'::treasury_bucket,
      p_amount, 'house_fee', 'Platform funds withdrawn: ' || p_reason, v_ref, NULL, v_idem
    );
  END IF;

  INSERT INTO audit_logs (actor_id, action, target_type, target_id, after)
  VALUES (p_admin_id, 'treasury.seed', 'treasury_account', v_ref,
          jsonb_build_object('bucket', p_bucket, 'amount', p_amount, 'direction', p_direction, 'reason', p_reason));

  RETURN jsonb_build_object('reference', v_ref, 'bucket', p_bucket, 'amount', p_amount, 'direction', p_direction);
END $$;

REVOKE ALL ON FUNCTION public.fn_seed_platform_funds(uuid, treasury_bucket, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_seed_platform_funds(uuid, treasury_bucket, numeric, text, text) TO authenticated, service_role;

-- 8. Watchdog views ------------------------------------------------------
CREATE OR REPLACE VIEW public.v_stuck_deposits AS
SELECT t.id, t.user_id, t.amount, t.reference, t.pesapal_tracking_id, t.created_at,
       EXTRACT(EPOCH FROM (now() - t.created_at))/60 AS minutes_pending
FROM public.transactions t
WHERE t.type = 'deposit' AND t.status = 'pending' AND t.created_at < now() - interval '10 minutes';

CREATE OR REPLACE VIEW public.v_unsettled_slips AS
SELECT s.id AS slip_id, s.user_id, s.stake, s.potential_payout, s.created_at,
       max(m.kickoff_at) AS last_kickoff
FROM public.bet_slips s
JOIN public.match_bets b ON b.slip_id = s.id
JOIN public.platform_matches m ON m.id = b.match_id
WHERE s.status = 'open'
GROUP BY s.id, s.user_id, s.stake, s.potential_payout, s.created_at
HAVING max(m.kickoff_at) < now() - interval '3 hours';

REVOKE ALL ON public.v_stuck_deposits FROM anon, authenticated;
REVOKE ALL ON public.v_unsettled_slips FROM anon, authenticated;
GRANT SELECT ON public.v_stuck_deposits TO service_role;
GRANT SELECT ON public.v_unsettled_slips TO service_role;

-- 9. Scheduled jobs -----------------------------------------------------
INSERT INTO public.job_definitions (job_type, display_name, description, handler, cron_expression, enabled, timeout_seconds, owner_group)
VALUES
  ('pesapal-status', 'Payment status check', 'Reconciles pending Pesapal deposits with the provider', 'pesapal-status', '*/5 * * * *', true, 120, 'finance'),
  ('settlement-watchdog', 'Settlement watchdog', 'Settles bet slips left open after their matches finished', 'sync-live', '*/15 * * * *', true, 180, 'finance')
ON CONFLICT (job_type) DO UPDATE SET cron_expression = EXCLUDED.cron_expression, enabled = EXCLUDED.enabled, handler = EXCLUDED.handler;