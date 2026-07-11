
-- Phase 1: Drop legacy tables (verified zero app references)
DROP TABLE IF EXISTS public.ai_insights CASCADE;
DROP TABLE IF EXISTS public.casino_sessions CASCADE;
DROP TABLE IF EXISTS public.crash_bets CASCADE;
DROP TABLE IF EXISTS public.crash_rounds CASCADE;
DROP TABLE IF EXISTS public.fantasy_scores CASCADE;
DROP TABLE IF EXISTS public.fantasy_teams CASCADE;
DROP TABLE IF EXISTS public.fantasy_fixtures CASCADE;
DROP TABLE IF EXISTS public.fantasy_leagues CASCADE;
DROP TABLE IF EXISTS public.fantasy_players CASCADE;
DROP TABLE IF EXISTS public.p2p_bets CASCADE;
DROP TABLE IF EXISTS public.p2p_challenges CASCADE;
DROP TABLE IF EXISTS public.predictions CASCADE;

-- Phase 6: Indexes for event_log live tail + market_trends lookups
CREATE INDEX IF NOT EXISTS idx_event_log_aggregate ON public.event_log (aggregate_type, aggregate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_actor ON public.event_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_type_created ON public.event_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_trends_lookup ON public.market_trends (market_id, "window", computed_at DESC);

-- Phase 6: Watchlist
CREATE TABLE IF NOT EXISTS public.watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  market_id uuid NOT NULL,
  alert_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, market_id)
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own watchlist"
  ON public.watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users add to own watchlist"
  ON public.watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own watchlist"
  ON public.watchlist FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users remove from own watchlist"
  ON public.watchlist FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages watchlist"
  ON public.watchlist FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.watchlist (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_market ON public.watchlist (market_id);
