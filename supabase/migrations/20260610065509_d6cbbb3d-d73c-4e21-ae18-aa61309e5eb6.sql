
-- ============ WAVE 1: SECURITY HARDENING ============

-- 1. Lock down sensitive RPCs — only service_role (edge functions) may call them
REVOKE EXECUTE ON FUNCTION public.credit_balance(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_balance(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_balance_idempotent(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_for_withdrawal(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_withdrawal_lock(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_settle_trade(uuid, uuid, uuid, numeric, numeric, numeric, text) FROM PUBLIC, anon, authenticated;

-- 2. Restrict anon execute on auth-only helpers (authenticated keeps access)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.derived_balance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_own_profile() FROM anon;

-- 3. Recreate views with security_invoker so they enforce caller's RLS
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles WITH (security_invoker = true) AS
  SELECT id, username, avatar_url, bio, accuracy_rate, reputation_score,
         current_streak, best_streak, followers_count, subscription_plan, created_at
  FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

DROP VIEW IF EXISTS public.v_wallet_balance;
CREATE VIEW public.v_wallet_balance WITH (security_invoker = true) AS
  SELECT user_id, bucket,
         COALESCE(SUM(amount), 0::numeric) AS balance,
         MAX(created_at) AS last_movement_at
  FROM public.ledger_entries
  WHERE user_id IS NOT NULL
  GROUP BY user_id, bucket;
GRANT SELECT ON public.v_wallet_balance TO authenticated;

-- 4. Storage: drop broad "Anyone can view avatars" listing policy.
--    Public bucket CDN URLs (getPublicUrl) keep working — they don't use storage.objects RLS.
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
-- Replace with: signed-in users may read avatar objects (no enumeration for anon)
CREATE POLICY "Authenticated can read avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- ============ WAVE 2: APP SETTINGS ============

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can insert settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete settings"
  ON public.app_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.app_settings_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); NEW.updated_by = auth.uid(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.app_settings_set_updated_at();

-- Seed defaults
INSERT INTO public.app_settings (key, value, description, category) VALUES
  ('trade_fee_bps', '200'::jsonb, 'House trading fee in basis points (200 = 2%)', 'finance'),
  ('min_deposit_kes', '50'::jsonb, 'Minimum deposit in KES', 'finance'),
  ('max_deposit_kes', '70000'::jsonb, 'Maximum single deposit in KES', 'finance'),
  ('daily_withdrawal_cap_kes', '50000'::jsonb, 'Daily withdrawal cap per user in KES', 'finance'),
  ('max_shares_per_trade', '10000'::jsonb, 'Maximum shares per single trade', 'trading'),
  ('maintenance_mode', 'false'::jsonb, 'Globally disable trading and withdrawals', 'system'),
  ('new_market_creation_enabled', 'true'::jsonb, 'Allow operators to create new markets', 'system')
ON CONFLICT (key) DO NOTHING;
