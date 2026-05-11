
-- =====================================================================
-- PROFILES
-- =====================================================================
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view profile rows"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

REVOKE SELECT (email, phone_number) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.* FROM public.profiles p
  WHERE public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[])
  ORDER BY p.created_at DESC
  LIMIT 500;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;

-- =====================================================================
-- TRADES
-- =====================================================================
DROP POLICY IF EXISTS "Trades viewable by everyone" ON public.trades;

CREATE POLICY "Users view own trades"
  ON public.trades FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all trades"
  ON public.trades FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

CREATE OR REPLACE FUNCTION public.get_market_recent_trades(p_market_id uuid, p_limit int DEFAULT 30)
RETURNS TABLE (
  id uuid, market_id uuid, outcome_id uuid,
  side text, shares numeric, price_per_share numeric, total_cost numeric,
  username text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.market_id, t.outcome_id, t.side, t.shares, t.price_per_share, t.total_cost,
         p.username, t.created_at
  FROM public.trades t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  WHERE t.market_id = p_market_id
  ORDER BY t.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;
REVOKE EXECUTE ON FUNCTION public.get_market_recent_trades(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_market_recent_trades(uuid, int) TO anon, authenticated;

-- =====================================================================
-- POSITIONS
-- =====================================================================
DROP POLICY IF EXISTS "All can view positions count" ON public.positions;

CREATE POLICY "Admins view all positions"
  ON public.positions FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

-- =====================================================================
-- MARKET DISPUTES
-- =====================================================================
DROP POLICY IF EXISTS "Disputes viewable by everyone" ON public.market_disputes;

CREATE POLICY "Users view own disputes"
  ON public.market_disputes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================================
-- NOTIFICATIONS, USER_BADGES, GUEST_SESSIONS — drop unsafe policies
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert user badges" ON public.user_badges;
DROP POLICY IF EXISTS "Anon can update own guest session" ON public.guest_sessions;

-- =====================================================================
-- WALLETS — drop client-side update; only service role can update
-- =====================================================================
DROP POLICY IF EXISTS "System can update wallets" ON public.wallets;

-- =====================================================================
-- STORAGE: avatars bucket — enforce folder ownership
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

CREATE POLICY "Users can upload own avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================================
-- Privileged SECURITY DEFINER functions — service role only
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.deduct_balance(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_balance(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.derived_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_balance_idempotent(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_for_withdrawal(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_withdrawal_lock(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_settle_trade(uuid, uuid, uuid, numeric, numeric, numeric, text) FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- Orphaned table cleanup
-- =====================================================================
DROP TABLE IF EXISTS public.votes CASCADE;
