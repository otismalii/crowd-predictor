
REVOKE ALL ON FUNCTION public.fn_crash_place_bet(uuid, uuid, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_crash_cashout(uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_crash_settle_round(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_crash_place_bet(uuid, uuid, numeric, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_crash_cashout(uuid, uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_crash_settle_round(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fn_crash_round_feed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_crash_round_feed(uuid) TO anon, authenticated, service_role;
