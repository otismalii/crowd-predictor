-- =========================================================
-- PHASE 1: ARCHIVE THE PREDICTION-MARKET ESTATE
-- Data preserved; API + public access revoked; policies dropped.
-- =========================================================
DO $$
DECLARE
  t text;
  p record;
  archived text[] := ARRAY[
    'markets','market_outcomes','trades','positions','watchlist','market_comments',
    'market_intelligence','market_suggestions','market_sources','market_trends',
    'market_quality_scores','market_import_batches','market_import_rows','market_import_audit',
    'market_audit_log','oracle_runs','p2p_challenges','p2p_audit_log',
    'creator_profiles','creator_subscriptions','creator_payouts'
  ];
BEGIN
  FOREACH t IN ARRAY archived LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END LOOP;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END IF;
  END LOOP;
END $$;

-- =========================================================
-- PHASE 2: SPORTSBOOK ENGINE
-- =========================================================

-- Drop the empty, duplicate legacy betting scaffold (all zero rows)
DROP FUNCTION IF EXISTS public.fn_grade_fixture(uuid);
DROP FUNCTION IF EXISTS public.fn_settle_bet(uuid);
DROP FUNCTION IF EXISTS public.fn_place_bet(uuid, jsonb, numeric, text, text);
DROP TABLE IF EXISTS public.bet_legs CASCADE;
DROP TABLE IF EXISTS public.bets CASCADE;
DROP TABLE IF EXISTS public.bet_selections CASCADE;
DROP TABLE IF EXISTS public.bet_markets CASCADE;
DROP TABLE IF EXISTS public.sport_fixtures CASCADE;

-- Market catalog ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bet_markets (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  supports_line boolean NOT NULL DEFAULT false,
  selections text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bet_markets TO anon, authenticated;
GRANT ALL ON public.bet_markets TO service_role;
ALTER TABLE public.bet_markets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bet_markets_public_read" ON public.bet_markets;
CREATE POLICY "bet_markets_public_read" ON public.bet_markets FOR SELECT USING (true);
DROP POLICY IF EXISTS "bet_markets_admin_write" ON public.bet_markets;
CREATE POLICY "bet_markets_admin_write" ON public.bet_markets FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

DROP TRIGGER IF EXISTS trg_bet_markets_updated ON public.bet_markets;
CREATE TRIGGER trg_bet_markets_updated BEFORE UPDATE ON public.bet_markets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.bet_markets (key, display_name, description, supports_line, selections, sort_order) VALUES
  ('1x2','Match Result','Home win, draw or away win at full time.',false,ARRAY['home','draw','away'],1),
  ('double_chance','Double Chance','Two of the three match results combined.',false,ARRAY['1x','12','x2'],2),
  ('over_under','Total Goals','Total goals over or under the line.',true,ARRAY['over','under'],3),
  ('btts','Both Teams To Score','Whether both teams score at least one goal.',false,ARRAY['yes','no'],4),
  ('correct_score','Correct Score','Exact full-time scoreline.',false,ARRAY[]::text[],5)
ON CONFLICT (key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  supports_line = EXCLUDED.supports_line,
  selections = EXCLUDED.selections,
  sort_order = EXCLUDED.sort_order;

-- Odds ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_odds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.platform_matches(id) ON DELETE CASCADE,
  market text NOT NULL REFERENCES public.bet_markets(key),
  selection text NOT NULL,
  line numeric,
  probability numeric,
  generated_odds numeric NOT NULL CHECK (generated_odds >= 1.01),
  override_odds numeric CHECK (override_odds IS NULL OR override_odds >= 1.01),
  margin_bps integer NOT NULL DEFAULT 700,
  is_suspended boolean NOT NULL DEFAULT false,
  overridden_by uuid,
  overridden_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS match_odds_unique
  ON public.match_odds (match_id, market, selection, COALESCE(line, -999));
CREATE INDEX IF NOT EXISTS match_odds_match_idx ON public.match_odds (match_id);

GRANT SELECT ON public.match_odds TO anon, authenticated;
GRANT ALL ON public.match_odds TO service_role;
ALTER TABLE public.match_odds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_odds_public_read" ON public.match_odds;
CREATE POLICY "match_odds_public_read" ON public.match_odds FOR SELECT USING (true);

DROP TRIGGER IF EXISTS trg_match_odds_updated ON public.match_odds;
CREATE TRIGGER trg_match_odds_updated BEFORE UPDATE ON public.match_odds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bet slips -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bet_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slip_type text NOT NULL DEFAULT 'single' CHECK (slip_type IN ('single','acca')),
  stake numeric NOT NULL CHECK (stake > 0),
  combined_odds numeric NOT NULL CHECK (combined_odds >= 1),
  potential_payout numeric NOT NULL DEFAULT 0,
  selection_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','void','cancelled')),
  payout numeric NOT NULL DEFAULT 0,
  idempotency_key text UNIQUE,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bet_slips_user_idx ON public.bet_slips (user_id, created_at DESC);

GRANT SELECT ON public.bet_slips TO authenticated;
GRANT ALL ON public.bet_slips TO service_role;
ALTER TABLE public.bet_slips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bet_slips_own_read" ON public.bet_slips;
CREATE POLICY "bet_slips_own_read" ON public.bet_slips FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin','super_admin']::app_role[]));

DROP TRIGGER IF EXISTS trg_bet_slips_updated ON public.bet_slips;
CREATE TRIGGER trg_bet_slips_updated BEFORE UPDATE ON public.bet_slips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- match_bets becomes a slip selection ---------------------------
ALTER TABLE public.match_bets
  ADD COLUMN IF NOT EXISTS slip_id uuid REFERENCES public.bet_slips(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS line numeric,
  ADD COLUMN IF NOT EXISTS odds_snapshot numeric;
CREATE INDEX IF NOT EXISTS match_bets_slip_idx ON public.match_bets (slip_id);
CREATE INDEX IF NOT EXISTS match_bets_match_status_idx ON public.match_bets (match_id, status);

-- Settings ------------------------------------------------------
INSERT INTO public.app_settings (key, value, description, category) VALUES
  ('odds_margin_bps','700'::jsonb,'House margin applied to generated odds, in basis points.','sportsbook'),
  ('min_stake_kes','20'::jsonb,'Minimum stake per bet slip in KES.','sportsbook'),
  ('max_stake_kes','20000'::jsonb,'Maximum stake per bet slip in KES.','sportsbook'),
  ('max_payout_kes','500000'::jsonb,'Maximum payout per bet slip in KES.','sportsbook'),
  ('max_acca_selections','15'::jsonb,'Maximum selections on one accumulator.','sportsbook')
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- GRADING
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_grade_selection(
  p_market text, p_selection text, p_line numeric, p_home integer, p_away integer
) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_total integer;
  v_result text;
BEGIN
  IF p_home IS NULL OR p_away IS NULL THEN RETURN 'void'; END IF;
  v_total := p_home + p_away;
  v_result := CASE WHEN p_home > p_away THEN 'home' WHEN p_home < p_away THEN 'away' ELSE 'draw' END;

  IF p_market = '1x2' THEN
    RETURN CASE WHEN p_selection = v_result THEN 'won' ELSE 'lost' END;
  ELSIF p_market = 'double_chance' THEN
    RETURN CASE
      WHEN p_selection = '1x' AND v_result IN ('home','draw') THEN 'won'
      WHEN p_selection = '12' AND v_result IN ('home','away') THEN 'won'
      WHEN p_selection = 'x2' AND v_result IN ('draw','away') THEN 'won'
      ELSE 'lost' END;
  ELSIF p_market = 'over_under' THEN
    IF p_line IS NULL THEN RETURN 'void'; END IF;
    IF v_total::numeric = p_line THEN RETURN 'void'; END IF;
    RETURN CASE
      WHEN p_selection = 'over' AND v_total::numeric > p_line THEN 'won'
      WHEN p_selection = 'under' AND v_total::numeric < p_line THEN 'won'
      ELSE 'lost' END;
  ELSIF p_market = 'btts' THEN
    RETURN CASE
      WHEN p_selection = 'yes' AND p_home > 0 AND p_away > 0 THEN 'won'
      WHEN p_selection = 'no' AND (p_home = 0 OR p_away = 0) THEN 'won'
      ELSE 'lost' END;
  ELSIF p_market = 'correct_score' THEN
    RETURN CASE WHEN p_selection = (p_home::text || '-' || p_away::text) THEN 'won' ELSE 'lost' END;
  END IF;
  RETURN 'void';
END $$;

-- =========================================================
-- ODDS GENERATION
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_generate_match_odds(p_match_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_margin numeric;
  v_match record;
  v_home_votes numeric := 0; v_draw_votes numeric := 0; v_away_votes numeric := 0; v_total numeric;
  p_home numeric; p_draw numeric; p_away numeric;
  p_over numeric; p_btts numeric;
  v_written integer := 0;

  PROCEDURE_placeholder text;
BEGIN
  SELECT COALESCE((value)::numeric, 700) INTO v_margin FROM app_settings WHERE key = 'odds_margin_bps';
  v_margin := COALESCE(v_margin, 700);

  SELECT id, status, kickoff_at INTO v_match FROM platform_matches WHERE id = p_match_id;
  IF v_match IS NULL THEN RETURN 0; END IF;

  SELECT
    count(*) FILTER (WHERE pick = 'home'),
    count(*) FILTER (WHERE pick = 'draw'),
    count(*) FILTER (WHERE pick = 'away')
  INTO v_home_votes, v_draw_votes, v_away_votes
  FROM match_votes WHERE match_id = p_match_id;

  v_total := v_home_votes + v_draw_votes + v_away_votes;
  IF v_total >= 10 THEN
    p_home := (v_home_votes + 4) / (v_total + 12);
    p_draw := (v_draw_votes + 4) / (v_total + 12);
    p_away := (v_away_votes + 4) / (v_total + 12);
  ELSE
    p_home := 0.43; p_draw := 0.27; p_away := 0.30;
  END IF;

  p_over := LEAST(0.72, GREATEST(0.38, 0.53 + (0.5 - p_draw) * 0.3));
  p_btts := LEAST(0.70, GREATEST(0.35, 0.52 + (0.5 - p_draw) * 0.2));

  -- 1x2
  PERFORM public.fn_upsert_odds(p_match_id, '1x2', 'home', NULL, p_home, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, '1x2', 'draw', NULL, p_draw, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, '1x2', 'away', NULL, p_away, v_margin);
  -- double chance
  PERFORM public.fn_upsert_odds(p_match_id, 'double_chance', '1x', NULL, LEAST(0.95, p_home + p_draw), v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'double_chance', '12', NULL, LEAST(0.95, p_home + p_away), v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'double_chance', 'x2', NULL, LEAST(0.95, p_draw + p_away), v_margin);
  -- totals 1.5 / 2.5 / 3.5
  PERFORM public.fn_upsert_odds(p_match_id, 'over_under', 'over', 1.5, LEAST(0.90, p_over + 0.22), v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'over_under', 'under', 1.5, GREATEST(0.10, 1 - (p_over + 0.22)), v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'over_under', 'over', 2.5, p_over, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'over_under', 'under', 2.5, 1 - p_over, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'over_under', 'over', 3.5, GREATEST(0.10, p_over - 0.22), v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'over_under', 'under', 3.5, LEAST(0.90, 1 - (p_over - 0.22)), v_margin);
  -- btts
  PERFORM public.fn_upsert_odds(p_match_id, 'btts', 'yes', NULL, p_btts, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'btts', 'no', NULL, 1 - p_btts, v_margin);
  -- common correct scores
  PERFORM public.fn_upsert_odds(p_match_id, 'correct_score', '1-0', NULL, 0.11, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'correct_score', '2-0', NULL, 0.08, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'correct_score', '2-1', NULL, 0.09, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'correct_score', '1-1', NULL, 0.12, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'correct_score', '0-0', NULL, 0.08, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'correct_score', '0-1', NULL, 0.09, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'correct_score', '0-2', NULL, 0.06, v_margin);
  PERFORM public.fn_upsert_odds(p_match_id, 'correct_score', '1-2', NULL, 0.08, v_margin);

  SELECT count(*) INTO v_written FROM match_odds WHERE match_id = p_match_id;
  RETURN v_written;
END $$;

CREATE OR REPLACE FUNCTION public.fn_upsert_odds(
  p_match_id uuid, p_market text, p_selection text, p_line numeric, p_prob numeric, p_margin_bps numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prob numeric;
  v_odds numeric;
BEGIN
  v_prob := LEAST(0.97, GREATEST(0.02, COALESCE(p_prob, 0.5)));
  v_odds := GREATEST(1.01, round(((1 / v_prob) * (1 - p_margin_bps / 10000.0))::numeric, 2));

  INSERT INTO match_odds (match_id, market, selection, line, probability, generated_odds, margin_bps)
  VALUES (p_match_id, p_market, p_selection, p_line, v_prob, v_odds, p_margin_bps::integer)
  ON CONFLICT (match_id, market, selection, COALESCE(line, -999)) DO UPDATE
    SET probability = EXCLUDED.probability,
        generated_odds = EXCLUDED.generated_odds,
        margin_bps = EXCLUDED.margin_bps,
        updated_at = now();
END $$;

-- =========================================================
-- PLACE BET SLIP
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_place_bet_slip(
  p_user_id uuid, p_selections jsonb, p_stake numeric, p_slip_type text, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing uuid;
  v_min numeric; v_max numeric; v_max_payout numeric; v_max_sel integer;
  v_count integer;
  v_sel jsonb;
  v_match record;
  v_odds record;
  v_combined numeric := 1;
  v_slip_id uuid;
  v_payout numeric;
  v_seen uuid[] := '{}';
BEGIN
  SELECT id INTO v_existing FROM bet_slips WHERE idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('replayed', true, 'slip_id', v_existing);
  END IF;

  SELECT COALESCE((value)::numeric, 20) INTO v_min FROM app_settings WHERE key = 'min_stake_kes';
  SELECT COALESCE((value)::numeric, 20000) INTO v_max FROM app_settings WHERE key = 'max_stake_kes';
  SELECT COALESCE((value)::numeric, 500000) INTO v_max_payout FROM app_settings WHERE key = 'max_payout_kes';
  SELECT COALESCE((value)::numeric, 15)::integer INTO v_max_sel FROM app_settings WHERE key = 'max_acca_selections';

  v_count := jsonb_array_length(COALESCE(p_selections, '[]'::jsonb));
  IF v_count = 0 THEN RAISE EXCEPTION 'NO_SELECTIONS'; END IF;
  IF v_count > COALESCE(v_max_sel, 15) THEN RAISE EXCEPTION 'TOO_MANY_SELECTIONS'; END IF;
  IF p_slip_type = 'single' AND v_count <> 1 THEN RAISE EXCEPTION 'SINGLE_REQUIRES_ONE_SELECTION'; END IF;
  IF p_stake < COALESCE(v_min, 20) THEN RAISE EXCEPTION 'STAKE_BELOW_MINIMUM'; END IF;
  IF p_stake > COALESCE(v_max, 20000) THEN RAISE EXCEPTION 'STAKE_ABOVE_MAXIMUM'; END IF;

  -- validate every selection first
  FOR v_sel IN SELECT * FROM jsonb_array_elements(p_selections) LOOP
    SELECT id, status, kickoff_at INTO v_match
    FROM platform_matches WHERE id = (v_sel->>'match_id')::uuid;
    IF v_match IS NULL THEN RAISE EXCEPTION 'MATCH_NOT_FOUND'; END IF;
    IF v_match.status <> 'upcoming' OR v_match.kickoff_at <= now() THEN RAISE EXCEPTION 'BETTING_CLOSED'; END IF;
    IF v_match.id = ANY(v_seen) THEN RAISE EXCEPTION 'DUPLICATE_MATCH_ON_SLIP'; END IF;
    v_seen := v_seen || v_match.id;

    SELECT * INTO v_odds FROM match_odds
    WHERE match_id = v_match.id
      AND market = (v_sel->>'market')
      AND selection = (v_sel->>'selection')
      AND COALESCE(line, -999) = COALESCE((v_sel->>'line')::numeric, -999)
    LIMIT 1;
    IF v_odds IS NULL THEN RAISE EXCEPTION 'ODDS_NOT_FOUND'; END IF;
    IF v_odds.is_suspended THEN RAISE EXCEPTION 'MARKET_SUSPENDED'; END IF;

    v_combined := v_combined * COALESCE(v_odds.override_odds, v_odds.generated_odds);
  END LOOP;

  v_combined := round(v_combined, 2);
  v_payout := round(p_stake * v_combined, 2);
  IF v_payout > COALESCE(v_max_payout, 500000) THEN RAISE EXCEPTION 'PAYOUT_ABOVE_MAXIMUM'; END IF;

  -- debit stake through the ledger
  PERFORM public.fn_post_double_entry(
    p_user_id, NULL,
    'user_funds'::treasury_bucket, 'settlement_reserve'::treasury_bucket,
    p_stake, 'bet_stake', 'Bet slip stake', NULL, NULL,
    p_idempotency_key || ':stake'
  );

  INSERT INTO bet_slips (user_id, slip_type, stake, combined_odds, potential_payout, selection_count, idempotency_key)
  VALUES (p_user_id, p_slip_type, p_stake, v_combined, v_payout, v_count, p_idempotency_key)
  RETURNING id INTO v_slip_id;

  FOR v_sel IN SELECT * FROM jsonb_array_elements(p_selections) LOOP
    SELECT * INTO v_odds FROM match_odds
    WHERE match_id = (v_sel->>'match_id')::uuid
      AND market = (v_sel->>'market')
      AND selection = (v_sel->>'selection')
      AND COALESCE(line, -999) = COALESCE((v_sel->>'line')::numeric, -999)
    LIMIT 1;

    INSERT INTO match_bets (
      user_id, match_id, market, selection, line, stake, odds, odds_snapshot,
      potential_payout, slip_id, status, idempotency_key
    ) VALUES (
      p_user_id, (v_sel->>'match_id')::uuid, v_sel->>'market', v_sel->>'selection',
      (v_sel->>'line')::numeric,
      CASE WHEN v_count = 1 THEN p_stake ELSE 0 END,
      COALESCE(v_odds.override_odds, v_odds.generated_odds),
      COALESCE(v_odds.override_odds, v_odds.generated_odds),
      CASE WHEN v_count = 1 THEN v_payout ELSE 0 END,
      v_slip_id, 'open',
      p_idempotency_key || ':' || (v_sel->>'match_id') || ':' || (v_sel->>'market') || ':' || (v_sel->>'selection')
    );
  END LOOP;

  INSERT INTO transactions (user_id, wallet_id, type, amount, status, description)
  SELECT p_user_id, w.id, 'bet_stake', p_stake, 'completed',
         CASE WHEN v_count = 1 THEN 'Single bet placed' ELSE v_count || '-fold accumulator placed' END
  FROM wallets w WHERE w.user_id = p_user_id;

  RETURN jsonb_build_object('replayed', false, 'slip_id', v_slip_id,
    'combined_odds', v_combined, 'potential_payout', v_payout);
END $$;

-- =========================================================
-- SETTLEMENT (selections + singles + accumulators)
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_settle_match_bets(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_match record;
  v_bet record;
  v_grade text;
  v_slip record;
  v_slip_id uuid;
  v_open integer; v_lost integer; v_won integer; v_void integer;
  v_odds numeric;
  v_payout numeric;
  v_graded integer := 0;
  v_slips_won integer := 0; v_slips_lost integer := 0; v_slips_void integer := 0;
BEGIN
  SELECT id, status, home_score, away_score INTO v_match
  FROM platform_matches WHERE id = p_match_id;
  IF v_match IS NULL OR v_match.status NOT IN ('finished','cancelled','postponed') THEN
    RETURN jsonb_build_object('graded', 0, 'reason', 'not_settleable');
  END IF;

  -- 1. grade every open selection on this match
  FOR v_bet IN SELECT * FROM match_bets WHERE match_id = p_match_id AND status = 'open' FOR UPDATE LOOP
    IF v_match.status <> 'finished' THEN
      v_grade := 'void';
    ELSE
      v_grade := public.fn_grade_selection(v_bet.market, v_bet.selection, v_bet.line, v_match.home_score, v_match.away_score);
    END IF;
    UPDATE match_bets SET status = v_grade, settled_at = now(), updated_at = now() WHERE id = v_bet.id;
    v_graded := v_graded + 1;
  END LOOP;

  -- 2. resolve every affected slip (singles and accas alike)
  FOR v_slip_id IN
    SELECT DISTINCT slip_id FROM match_bets WHERE match_id = p_match_id AND slip_id IS NOT NULL
  LOOP
    SELECT * INTO v_slip FROM bet_slips WHERE id = v_slip_id AND status = 'open' FOR UPDATE;
    CONTINUE WHEN v_slip IS NULL;

    SELECT
      count(*) FILTER (WHERE status = 'open'),
      count(*) FILTER (WHERE status = 'lost'),
      count(*) FILTER (WHERE status = 'won'),
      count(*) FILTER (WHERE status = 'void')
    INTO v_open, v_lost, v_won, v_void
    FROM match_bets WHERE slip_id = v_slip_id;

    IF v_lost > 0 THEN
      PERFORM public.fn_post_double_entry(
        NULL, NULL,
        'settlement_reserve'::treasury_bucket, 'platform_revenue'::treasury_bucket,
        v_slip.stake, 'house_fee', 'Bet slip lost', v_slip_id, NULL,
        'slip_loss_' || v_slip_id::text
      );
      UPDATE bet_slips SET status = 'lost', payout = 0, settled_at = now() WHERE id = v_slip_id;
      v_slips_lost := v_slips_lost + 1;
      CONTINUE;
    END IF;

    CONTINUE WHEN v_open > 0;

    IF v_won = 0 THEN
      PERFORM public.fn_post_double_entry(
        NULL, v_slip.user_id,
        'settlement_reserve'::treasury_bucket, 'user_funds'::treasury_bucket,
        v_slip.stake, 'bet_refund', 'Bet slip void — stake refunded', v_slip_id, NULL,
        'slip_void_' || v_slip_id::text
      );
      INSERT INTO transactions (user_id, wallet_id, type, amount, status, description)
      SELECT v_slip.user_id, w.id, 'bet_refund', v_slip.stake, 'completed', 'Bet slip void — stake refunded'
      FROM wallets w WHERE w.user_id = v_slip.user_id;
      UPDATE bet_slips SET status = 'void', payout = v_slip.stake, settled_at = now() WHERE id = v_slip_id;
      v_slips_void := v_slips_void + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(exp(sum(ln(GREATEST(odds_snapshot, 1.01)))), 1) INTO v_odds
    FROM match_bets WHERE slip_id = v_slip_id AND status = 'won';
    v_payout := round(v_slip.stake * round(v_odds, 4), 2);

    PERFORM public.fn_post_double_entry(
      NULL, v_slip.user_id,
      'settlement_reserve'::treasury_bucket, 'user_funds'::treasury_bucket,
      v_payout, 'bet_win', 'Bet slip won', v_slip_id, NULL,
      'slip_payout_' || v_slip_id::text
    );
    INSERT INTO transactions (user_id, wallet_id, type, amount, status, description)
    SELECT v_slip.user_id, w.id, 'bet_win', v_payout, 'completed', 'Bet slip won'
    FROM wallets w WHERE w.user_id = v_slip.user_id;
    UPDATE bet_slips SET status = 'won', payout = v_payout, settled_at = now() WHERE id = v_slip_id;
    v_slips_won := v_slips_won + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'graded', v_graded,
    'slips_won', v_slips_won,
    'slips_lost', v_slips_lost,
    'slips_void', v_slips_void
  );
END $$;

-- Retire the legacy single-bet placement path
DROP FUNCTION IF EXISTS public.fn_place_match_bet(uuid, uuid, text, text, numeric, numeric, text);