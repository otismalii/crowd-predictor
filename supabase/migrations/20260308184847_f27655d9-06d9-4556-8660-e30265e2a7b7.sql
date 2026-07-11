
-- Add unique constraint on external_match_id for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matches_external_match_id_key'
  ) THEN
    ALTER TABLE public.matches ADD CONSTRAINT matches_external_match_id_key UNIQUE (external_match_id);
  END IF;
END$$;

-- Allow admins to delete matches
CREATE POLICY "Admins can delete matches"
  ON public.matches FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete predictions (moderation)
CREATE POLICY "Admins can delete predictions"
  ON public.predictions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update predictions (for status changes)
CREATE POLICY "Admins can update predictions"
  ON public.predictions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all user roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
