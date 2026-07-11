-- 1. PROFILES: drop blanket-true SELECT, restrict to self + admin
DROP POLICY IF EXISTS "Authenticated users can view profile rows" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

-- 2. PUBLIC_PROFILES view: safe-fields-only, runs as owner so it bypasses base RLS
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT
  id,
  username,
  avatar_url,
  bio,
  accuracy_rate,
  reputation_score,
  current_streak,
  best_streak,
  followers_count,
  subscription_plan,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 3. GUEST_SESSIONS: drop public-readable policy, replace with token-scoped RPC
DROP POLICY IF EXISTS "Guest sessions are publicly readable by guest_id" ON public.guest_sessions;

CREATE OR REPLACE FUNCTION public.get_guest_session(p_guest_id text)
RETURNS public.guest_sessions
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.guest_sessions WHERE guest_id = p_guest_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_session(text) TO anon, authenticated;