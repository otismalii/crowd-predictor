
-- Phase 1: Expand markets table with slug, subcategory, resolution fields, image fields
ALTER TABLE public.markets 
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS resolution_rule text,
  ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_source_type text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS alt_text text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Generate slugs for existing markets
UPDATE public.markets SET slug = id::text WHERE slug IS NULL;

-- Create guest_sessions table
CREATE TABLE IF NOT EXISTS public.guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id text UNIQUE NOT NULL,
  device_fingerprint text,
  credits numeric DEFAULT 1000 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  last_active_at timestamptz DEFAULT now() NOT NULL,
  expired boolean DEFAULT false NOT NULL,
  converted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guest sessions are publicly readable by guest_id" ON public.guest_sessions
  FOR SELECT USING (true);

CREATE POLICY "Guest sessions can be inserted by anyone" ON public.guest_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Guest sessions can be updated by anyone" ON public.guest_sessions
  FOR UPDATE USING (true);

-- Create ledger_entries table for immutable wallet audit trail
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES public.wallets(id),
  user_id uuid,
  guest_id text,
  entry_type text NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  reference_id uuid,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ledger entries" ON public.ledger_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages ledger entries" ON public.ledger_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create market_sources table for resolution source tracking
CREATE TABLE IF NOT EXISTS public.market_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES public.markets(id) ON DELETE CASCADE NOT NULL,
  source_type text NOT NULL DEFAULT 'official',
  source_name text NOT NULL,
  source_url text,
  confidence integer DEFAULT 50,
  snapshot_data jsonb,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.market_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Market sources viewable by everyone" ON public.market_sources
  FOR SELECT USING (true);

CREATE POLICY "Admins manage market sources" ON public.market_sources
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create market_disputes table
CREATE TABLE IF NOT EXISTS public.market_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES public.markets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  evidence text,
  status text DEFAULT 'open' NOT NULL,
  admin_response text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.market_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Disputes viewable by everyone" ON public.market_disputes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create disputes" ON public.market_disputes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage disputes" ON public.market_disputes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create market_audit_log for admin action tracking
CREATE TABLE IF NOT EXISTS public.market_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES public.markets(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  performed_by uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.market_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log" ON public.market_audit_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert audit log" ON public.market_audit_log
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages audit log" ON public.market_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create source_registry for data ingestion (Phase 3)
CREATE TABLE IF NOT EXISTS public.source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  source_type text NOT NULL DEFAULT 'api',
  base_url text,
  config jsonb DEFAULT '{}'::jsonb,
  priority integer DEFAULT 50,
  is_active boolean DEFAULT true,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.source_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage source registry" ON public.source_registry
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create ingestion_logs for data pipeline tracking
CREATE TABLE IF NOT EXISTS public.ingestion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.source_registry(id),
  source_name text NOT NULL,
  status text DEFAULT 'success' NOT NULL,
  records_fetched integer DEFAULT 0,
  records_processed integer DEFAULT 0,
  error_message text,
  raw_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.ingestion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ingestion logs" ON public.ingestion_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages ingestion logs" ON public.ingestion_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create market_suggestions queue for ingested data
CREATE TABLE IF NOT EXISTS public.market_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text DEFAULT 'general',
  subcategory text,
  description text,
  suggested_outcomes jsonb DEFAULT '[]'::jsonb,
  source_id uuid REFERENCES public.source_registry(id),
  source_data jsonb,
  confidence_score integer DEFAULT 50,
  status text DEFAULT 'pending' NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_market_id uuid REFERENCES public.markets(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.market_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage market suggestions" ON public.market_suggestions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages suggestions" ON public.market_suggestions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
