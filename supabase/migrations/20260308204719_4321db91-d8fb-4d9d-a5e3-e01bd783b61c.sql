
-- Market status
CREATE TYPE public.market_status AS ENUM ('open', 'closed', 'resolved', 'cancelled');

-- Markets: one per match event (e.g. "Match Result", "Over/Under 2.5")
CREATE TABLE public.markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'match_result',
  status market_status NOT NULL DEFAULT 'open',
  liquidity_param numeric NOT NULL DEFAULT 100,
  total_volume numeric NOT NULL DEFAULT 0,
  resolution_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closes_at timestamptz
);

ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Markets viewable by everyone" ON public.markets FOR SELECT USING (true);
CREATE POLICY "Service role manages markets" ON public.markets FOR ALL USING (auth.role() = 'service_role'::text);
CREATE POLICY "Admins manage markets" ON public.markets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Market outcomes: each possible result
CREATE TABLE public.market_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  label text NOT NULL,
  pool_shares numeric NOT NULL DEFAULT 100,
  is_winner boolean,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Outcomes viewable by everyone" ON public.market_outcomes FOR SELECT USING (true);
CREATE POLICY "Service role manages outcomes" ON public.market_outcomes FOR ALL USING (auth.role() = 'service_role'::text);
CREATE POLICY "Admins manage outcomes" ON public.market_outcomes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- User positions (shares held)
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  outcome_id uuid NOT NULL REFERENCES public.market_outcomes(id) ON DELETE CASCADE,
  shares numeric NOT NULL DEFAULT 0,
  avg_price numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, outcome_id)
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own positions" ON public.positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "All can view positions count" ON public.positions FOR SELECT USING (true);
CREATE POLICY "Service role manages positions" ON public.positions FOR ALL USING (auth.role() = 'service_role'::text);

-- Trade history
CREATE TABLE public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  outcome_id uuid NOT NULL REFERENCES public.market_outcomes(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  shares numeric NOT NULL,
  price_per_share numeric NOT NULL,
  total_cost numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trades viewable by everyone" ON public.trades FOR SELECT USING (true);
CREATE POLICY "Service role manages trades" ON public.trades FOR ALL USING (auth.role() = 'service_role'::text);

-- Index for performance
CREATE INDEX idx_markets_match ON public.markets(match_id);
CREATE INDEX idx_markets_status ON public.markets(status);
CREATE INDEX idx_positions_user ON public.positions(user_id);
CREATE INDEX idx_trades_market ON public.trades(market_id);
CREATE INDEX idx_trades_user ON public.trades(user_id);
