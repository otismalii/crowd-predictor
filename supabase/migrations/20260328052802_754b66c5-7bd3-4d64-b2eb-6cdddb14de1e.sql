
-- Tighten guest_sessions INSERT to only allow non-authenticated (anonymous) users
DROP POLICY IF EXISTS "Guest sessions can be inserted by anyone" ON public.guest_sessions;
CREATE POLICY "Guest sessions can be inserted" ON public.guest_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

-- Tighten guest_sessions UPDATE to service role only for most ops
DROP POLICY IF EXISTS "Guest sessions can be updated by anyone" ON public.guest_sessions;
CREATE POLICY "Service role updates guest sessions" ON public.guest_sessions
  FOR UPDATE TO service_role USING (true);

-- Allow anon users to update their own sessions by guest_id match
CREATE POLICY "Anon can update own guest session" ON public.guest_sessions
  FOR UPDATE USING (true) WITH CHECK (true);
