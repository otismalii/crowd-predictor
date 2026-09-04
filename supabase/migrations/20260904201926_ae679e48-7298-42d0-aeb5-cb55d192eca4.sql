
ALTER TABLE public.match_odds REPLICA IDENTITY FULL;
ALTER TABLE public.bet_slips REPLICA IDENTITY FULL;
ALTER TABLE public.match_bets REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.match_odds; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_slips; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.match_bets; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
