
-- Import batches
CREATE TABLE public.market_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name text NOT NULL,
  generated_by text,
  generated_at timestamptz,
  description text,
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_mode text NOT NULL CHECK (source_mode IN ('upload','paste','api')),
  raw_payload jsonb,
  payload_hash text,
  markets_total int NOT NULL DEFAULT 0,
  markets_ready int NOT NULL DEFAULT 0,
  markets_warned int NOT NULL DEFAULT 0,
  markets_failed int NOT NULL DEFAULT 0,
  markets_published int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'validated' CHECK (status IN ('parsing','validated','publishing','completed','rolled_back','failed')),
  processing_ms int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_import_batches TO authenticated;
GRANT ALL ON public.market_import_batches TO service_role;
ALTER TABLE public.market_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "foundry read batches" ON public.market_import_batches FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_manager']::app_role[]));
CREATE POLICY "foundry write batches" ON public.market_import_batches FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_manager']::app_role[]));
CREATE INDEX idx_import_batches_created ON public.market_import_batches (created_at DESC);
CREATE INDEX idx_import_batches_status ON public.market_import_batches (status);
CREATE INDEX idx_import_batches_hash ON public.market_import_batches (payload_hash);
CREATE TRIGGER trg_import_batches_updated BEFORE UPDATE ON public.market_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Import rows
CREATE TABLE public.market_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.market_import_batches(id) ON DELETE CASCADE,
  row_index int NOT NULL,
  raw_market jsonb NOT NULL,
  normalized_market jsonb,
  slug text,
  question_hash text,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','warning','error','publishing','published','rejected','failed')),
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_market_id uuid REFERENCES public.markets(id) ON DELETE SET NULL,
  published_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_import_rows TO authenticated;
GRANT ALL ON public.market_import_rows TO service_role;
ALTER TABLE public.market_import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "foundry read rows" ON public.market_import_rows FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_manager']::app_role[]));
CREATE POLICY "foundry write rows" ON public.market_import_rows FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_manager']::app_role[]));
CREATE INDEX idx_import_rows_batch ON public.market_import_rows (batch_id, row_index);
CREATE INDEX idx_import_rows_status ON public.market_import_rows (status);
CREATE INDEX idx_import_rows_published ON public.market_import_rows (published_market_id);
CREATE TRIGGER trg_import_rows_updated BEFORE UPDATE ON public.market_import_rows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit log
CREATE TABLE public.market_import_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.market_import_batches(id) ON DELETE CASCADE,
  row_id uuid REFERENCES public.market_import_rows(id) ON DELETE SET NULL,
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('import','validate','edit','publish','reject','rollback','delete')),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.market_import_audit TO authenticated;
GRANT ALL ON public.market_import_audit TO service_role;
ALTER TABLE public.market_import_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "foundry read audit" ON public.market_import_audit FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_manager']::app_role[]));
CREATE POLICY "foundry insert audit" ON public.market_import_audit FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin','market_manager']::app_role[]));
CREATE INDEX idx_import_audit_batch ON public.market_import_audit (batch_id, created_at DESC);

-- Realtime for progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_import_rows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_import_batches;
