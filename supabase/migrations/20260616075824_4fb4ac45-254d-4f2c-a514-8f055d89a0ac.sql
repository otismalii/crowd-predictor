
-- =========================================
-- Wave 3: Creator Economy
-- =========================================

-- 1. Creator tier enum
DO $$ BEGIN
  CREATE TYPE public.creator_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.creator_payout_status AS ENUM ('pending', 'approved', 'paid', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.creator_subscription_status AS ENUM ('active', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add suggested_by to markets (links promoted suggestion → original author)
ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS suggested_by uuid;
CREATE INDEX IF NOT EXISTS idx_markets_suggested_by ON public.markets(suggested_by) WHERE suggested_by IS NOT NULL;

-- 3. creator_profiles
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  tier public.creator_tier NOT NULL DEFAULT 'bronze',
  score integer NOT NULL DEFAULT 0,
  markets_published integer NOT NULL DEFAULT 0,
  total_volume_attributed numeric NOT NULL DEFAULT 0,
  lifetime_payout_kes numeric NOT NULL DEFAULT 0,
  payout_rate_bps integer NOT NULL DEFAULT 50, -- 0.50% default
  bio text,
  payout_method text, -- 'mpesa' | 'bank'
  payout_destination text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.creator_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.creator_profiles TO authenticated;
GRANT ALL ON public.creator_profiles TO service_role;

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_profiles_public_read"
  ON public.creator_profiles FOR SELECT
  USING (true);

CREATE POLICY "creator_profiles_self_update"
  ON public.creator_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "creator_profiles_admin_all"
  ON public.creator_profiles FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_creator_profiles_tier_score ON public.creator_profiles(tier, score DESC);

-- 4. creator_payouts
CREATE TABLE IF NOT EXISTS public.creator_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  market_id uuid,
  amount_kes numeric NOT NULL CHECK (amount_kes >= 0),
  basis_volume numeric NOT NULL DEFAULT 0,
  rate_bps integer NOT NULL DEFAULT 50,
  status public.creator_payout_status NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  ledger_entry_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.creator_payouts TO authenticated;
GRANT ALL ON public.creator_payouts TO service_role;

ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_payouts_self_read"
  ON public.creator_payouts FOR SELECT
  USING (auth.uid() = creator_id
    OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE POLICY "creator_payouts_admin_write"
  ON public.creator_payouts FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE INDEX IF NOT EXISTS idx_creator_payouts_creator ON public.creator_payouts(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_status ON public.creator_payouts(status, created_at DESC);

-- 5. creator_subscriptions
CREATE TABLE IF NOT EXISTS public.creator_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  tier text NOT NULL DEFAULT 'premium', -- 'free' | 'premium'
  price_kes numeric NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz,
  status public.creator_subscription_status NOT NULL DEFAULT 'active',
  auto_renew boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, creator_id)
);

GRANT SELECT, INSERT, UPDATE ON public.creator_subscriptions TO authenticated;
GRANT ALL ON public.creator_subscriptions TO service_role;

ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_subs_visible_to_parties"
  ON public.creator_subscriptions FOR SELECT
  USING (auth.uid() = subscriber_id OR auth.uid() = creator_id
    OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE POLICY "creator_subs_self_insert"
  ON public.creator_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "creator_subs_self_update"
  ON public.creator_subscriptions FOR UPDATE
  USING (auth.uid() = subscriber_id)
  WITH CHECK (auth.uid() = subscriber_id);

CREATE INDEX IF NOT EXISTS idx_creator_subs_creator ON public.creator_subscriptions(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_creator_subs_subscriber ON public.creator_subscriptions(subscriber_id, status);

-- 6. updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_creator_profiles_updated ON public.creator_profiles;
CREATE TRIGGER trg_creator_profiles_updated BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_creator_payouts_updated ON public.creator_payouts;
CREATE TRIGGER trg_creator_payouts_updated BEFORE UPDATE ON public.creator_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_creator_subs_updated ON public.creator_subscriptions;
CREATE TRIGGER trg_creator_subs_updated BEFORE UPDATE ON public.creator_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Attribute payout RPC (service-role only, called by settle worker)
CREATE OR REPLACE FUNCTION public.fn_attribute_creator_payout(
  p_market_id uuid,
  p_creator_id uuid,
  p_basis_volume numeric
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rate integer;
  v_amount numeric;
  v_id uuid;
BEGIN
  SELECT payout_rate_bps INTO v_rate FROM public.creator_profiles WHERE user_id = p_creator_id;
  IF v_rate IS NULL THEN v_rate := 50; END IF; -- default 0.5%
  v_amount := round((p_basis_volume * v_rate / 10000.0)::numeric, 2);

  INSERT INTO public.creator_payouts (creator_id, market_id, amount_kes, basis_volume, rate_bps, status)
  VALUES (p_creator_id, p_market_id, v_amount, p_basis_volume, v_rate, 'pending')
  RETURNING id INTO v_id;

  UPDATE public.creator_profiles
    SET total_volume_attributed = total_volume_attributed + p_basis_volume,
        markets_published = markets_published + 1
    WHERE user_id = p_creator_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.fn_attribute_creator_payout(uuid, uuid, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_attribute_creator_payout(uuid, uuid, numeric) TO service_role;
