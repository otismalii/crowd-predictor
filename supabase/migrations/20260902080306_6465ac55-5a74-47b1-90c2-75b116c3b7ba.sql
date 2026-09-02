
-- ============ CASINO GAME CATALOG ============
CREATE TABLE public.casino_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  enabled boolean NOT NULL DEFAULT true,
  house_edge numeric NOT NULL DEFAULT 0.04,
  min_stake numeric NOT NULL DEFAULT 20,
  max_stake numeric NOT NULL DEFAULT 20000,
  max_payout numeric NOT NULL DEFAULT 500000,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.casino_games TO anon;
GRANT SELECT ON public.casino_games TO authenticated;
GRANT ALL ON public.casino_games TO service_role;
ALTER TABLE public.casino_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view enabled casino games" ON public.casino_games FOR SELECT USING (enabled = true);
CREATE POLICY "Admins manage casino games" ON public.casino_games FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));
CREATE TRIGGER casino_games_updated_at BEFORE UPDATE ON public.casino_games
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.casino_games (key, name, tagline, house_edge, min_stake, max_stake, sort_order)
VALUES ('popit', 'Pop It', 'Ride the bubble. Cash out before it pops.', 0.04, 20, 20000, 1);

-- ============ CRASH ROUNDS ============
CREATE TABLE public.crash_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_no bigserial NOT NULL,
  game_key text NOT NULL DEFAULT 'popit' REFERENCES public.casino_games(key),
  status text NOT NULL DEFAULT 'betting' CHECK (status IN ('betting','running','crashed','settled')),
  server_seed text NOT NULL,
  seed_hash text NOT NULL,
  crash_point numeric NOT NULL CHECK (crash_point >= 1),
  betting_ends_at timestamptz NOT NULL,
  started_at timestamptz,
  crashed_at timestamptz,
  settled_at timestamptz,
  seed_revealed boolean NOT NULL DEFAULT false,
  total_staked numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crash_rounds_status_idx ON public.crash_rounds (status, created_at DESC);
GRANT SELECT ON public.crash_rounds TO anon;
GRANT SELECT ON public.crash_rounds TO authenticated;
GRANT ALL ON public.crash_rounds TO service_role;
ALTER TABLE public.crash_rounds ENABLE ROW LEVEL SECURITY;
-- Public can read rounds, but the unrevealed seed is filtered by the read view below.
CREATE POLICY "Anyone can view crash rounds" ON public.crash_rounds FOR SELECT USING (true);
CREATE TRIGGER crash_rounds_updated_at BEFORE UPDATE ON public.crash_rounds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Safe projection: never exposes the seed or crash point of a live round.
CREATE VIEW public.v_crash_rounds_public
WITH (security_invoker = true) AS
SELECT
  id, round_no, game_key, status, seed_hash, betting_ends_at, started_at, crashed_at,
  created_at,
  CASE WHEN status IN ('crashed','settled') THEN crash_point END AS crash_point,
  CASE WHEN seed_revealed THEN server_seed END AS server_seed,
  total_staked, total_paid
FROM public.crash_rounds;
GRANT SELECT ON public.v_crash_rounds_public TO anon, authenticated;

-- ============ CRASH BETS ============
CREATE TABLE public.crash_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.crash_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stake numeric NOT NULL CHECK (stake > 0),
  auto_cashout numeric CHECK (auto_cashout IS NULL OR auto_cashout > 1),
  cashout_multiplier numeric,
  payout numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cashed_out','lost','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id)
);
CREATE INDEX crash_bets_round_idx ON public.crash_bets (round_id);
CREATE INDEX crash_bets_user_idx ON public.crash_bets (user_id, created_at DESC);
GRANT SELECT ON public.crash_bets TO authenticated;
GRANT ALL ON public.crash_bets TO service_role;
ALTER TABLE public.crash_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players view their own crash bets" ON public.crash_bets FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins view all crash bets" ON public.crash_bets FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));
CREATE TRIGGER crash_bets_updated_at BEFORE UPDATE ON public.crash_bets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Anonymous live feed for the active round (no user ids leaked).
CREATE OR REPLACE FUNCTION public.fn_crash_round_feed(p_round_id uuid)
RETURNS TABLE(bet_id uuid, username text, stake numeric, cashout_multiplier numeric, payout numeric, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id,
         COALESCE(p.username, 'player') AS username,
         b.stake, b.cashout_multiplier, b.payout, b.status
  FROM public.crash_bets b
  LEFT JOIN public.profiles p ON p.id = b.user_id
  WHERE b.round_id = p_round_id
  ORDER BY b.created_at DESC
  LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.fn_crash_round_feed(uuid) TO anon, authenticated;

-- ============ MONEY: PLACE BET ============
CREATE OR REPLACE FUNCTION public.fn_crash_place_bet(
  p_user_id uuid,
  p_round_id uuid,
  p_stake numeric,
  p_auto_cashout numeric,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.casino_games;
  v_round public.crash_rounds;
  v_bet_id uuid;
BEGIN
  SELECT * INTO v_game FROM public.casino_games WHERE key = 'popit';
  IF v_game IS NULL OR NOT v_game.enabled THEN RAISE EXCEPTION 'GAME_DISABLED'; END IF;
  IF p_stake < v_game.min_stake THEN RAISE EXCEPTION 'STAKE_BELOW_MINIMUM'; END IF;
  IF p_stake > v_game.max_stake THEN RAISE EXCEPTION 'STAKE_ABOVE_MAXIMUM'; END IF;

  SELECT * INTO v_round FROM public.crash_rounds WHERE id = p_round_id FOR UPDATE;
  IF v_round IS NULL THEN RAISE EXCEPTION 'ROUND_NOT_FOUND'; END IF;
  IF v_round.status <> 'betting' OR v_round.betting_ends_at <= now() THEN RAISE EXCEPTION 'BETTING_CLOSED'; END IF;

  IF EXISTS (SELECT 1 FROM public.crash_bets WHERE round_id = p_round_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'ALREADY_BET_THIS_ROUND';
  END IF;

  PERFORM public.fn_post_double_entry(
    p_user_id, NULL,
    'user_funds'::treasury_bucket, 'liquidity_pool'::treasury_bucket,
    p_stake, 'casino_stake', 'Pop It stake', p_round_id, NULL, p_idempotency_key
  );

  INSERT INTO public.crash_bets (round_id, user_id, stake, auto_cashout)
  VALUES (p_round_id, p_user_id, p_stake, p_auto_cashout)
  RETURNING id INTO v_bet_id;

  UPDATE public.crash_rounds SET total_staked = total_staked + p_stake WHERE id = p_round_id;

  RETURN jsonb_build_object('bet_id', v_bet_id, 'round_id', p_round_id, 'stake', p_stake);
END $$;

-- ============ MONEY: CASH OUT ============
CREATE OR REPLACE FUNCTION public.fn_crash_cashout(
  p_user_id uuid,
  p_bet_id uuid,
  p_multiplier numeric,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet public.crash_bets;
  v_round public.crash_rounds;
  v_game public.casino_games;
  v_payout numeric;
  v_effective numeric;
BEGIN
  SELECT * INTO v_bet FROM public.crash_bets WHERE id = p_bet_id AND user_id = p_user_id FOR UPDATE;
  IF v_bet IS NULL THEN RAISE EXCEPTION 'BET_NOT_FOUND'; END IF;
  IF v_bet.status <> 'active' THEN RAISE EXCEPTION 'BET_ALREADY_SETTLED'; END IF;

  SELECT * INTO v_round FROM public.crash_rounds WHERE id = v_bet.round_id FOR UPDATE;
  IF v_round.status <> 'running' THEN RAISE EXCEPTION 'ROUND_NOT_RUNNING'; END IF;

  -- Server clock is authoritative: a client can never claim more than the round has grown.
  v_effective := least(
    p_multiplier,
    round(exp(0.06 * greatest(0, extract(epoch from (now() - v_round.started_at))))::numeric, 2),
    v_round.crash_point
  );
  IF v_effective > v_round.crash_point THEN RAISE EXCEPTION 'ALREADY_CRASHED'; END IF;
  v_effective := greatest(1, round(v_effective, 2));

  SELECT * INTO v_game FROM public.casino_games WHERE key = v_round.game_key;
  v_payout := least(round(v_bet.stake * v_effective, 2), v_game.max_payout);

  PERFORM public.fn_post_double_entry(
    NULL, p_user_id,
    'liquidity_pool'::treasury_bucket, 'user_funds'::treasury_bucket,
    v_payout, 'casino_win', 'Pop It cashout at ' || v_effective || 'x', v_round.id, NULL, p_idempotency_key
  );

  UPDATE public.crash_bets
  SET status = 'cashed_out', cashout_multiplier = v_effective, payout = v_payout
  WHERE id = p_bet_id;

  UPDATE public.crash_rounds SET total_paid = total_paid + v_payout WHERE id = v_round.id;

  RETURN jsonb_build_object('bet_id', p_bet_id, 'multiplier', v_effective, 'payout', v_payout);
END $$;

-- ============ SETTLEMENT ============
CREATE OR REPLACE FUNCTION public.fn_crash_settle_round(p_round_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round public.crash_rounds;
  v_bet public.crash_bets;
  v_payout numeric;
  v_won int := 0;
  v_lost int := 0;
BEGIN
  SELECT * INTO v_round FROM public.crash_rounds WHERE id = p_round_id FOR UPDATE;
  IF v_round IS NULL THEN RAISE EXCEPTION 'ROUND_NOT_FOUND'; END IF;
  IF v_round.status = 'settled' THEN
    RETURN jsonb_build_object('replayed', true, 'round_id', p_round_id);
  END IF;

  FOR v_bet IN SELECT * FROM public.crash_bets WHERE round_id = p_round_id AND status = 'active' LOOP
    IF v_bet.auto_cashout IS NOT NULL AND v_bet.auto_cashout <= v_round.crash_point THEN
      v_payout := round(v_bet.stake * v_bet.auto_cashout, 2);
      PERFORM public.fn_post_double_entry(
        NULL, v_bet.user_id,
        'liquidity_pool'::treasury_bucket, 'user_funds'::treasury_bucket,
        v_payout, 'casino_win', 'Pop It auto cashout at ' || v_bet.auto_cashout || 'x',
        p_round_id, NULL, 'crash_auto_' || v_bet.id
      );
      UPDATE public.crash_bets
      SET status = 'cashed_out', cashout_multiplier = v_bet.auto_cashout, payout = v_payout
      WHERE id = v_bet.id;
      UPDATE public.crash_rounds SET total_paid = total_paid + v_payout WHERE id = p_round_id;
      v_won := v_won + 1;
    ELSE
      UPDATE public.crash_bets SET status = 'lost', payout = 0 WHERE id = v_bet.id;
      v_lost := v_lost + 1;
    END IF;
  END LOOP;

  UPDATE public.crash_rounds
  SET status = 'settled', settled_at = now(), seed_revealed = true
  WHERE id = p_round_id;

  RETURN jsonb_build_object('round_id', p_round_id, 'cashed_out', v_won, 'lost', v_lost);
END $$;

-- Realtime for the game stage and live feed.
ALTER TABLE public.crash_rounds REPLICA IDENTITY FULL;
ALTER TABLE public.crash_bets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crash_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crash_bets;
