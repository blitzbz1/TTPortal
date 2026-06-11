-- Assertions for 099_rpc_compat_shims.
DO $$
DECLARE v_count int;
BEGIN
  -- Both overloads exist for each RPC.
  SELECT count(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='get_venue_detail';
  IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL: get_venue_detail overloads = %', v_count; END IF;
  SELECT count(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='get_friend_feed';
  IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL: get_friend_feed overloads = %', v_count; END IF;
  SELECT count(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='get_friends_at_venue';
  IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL: get_friends_at_venue overloads = %', v_count; END IF;

  -- Old-signature calls execute (identity args ignored, no error).
  PERFORM public.get_venue_detail(1, NULL::uuid, 5);
  PERFORM * FROM public.get_friends_at_venue(1, NULL::uuid);
  PERFORM * FROM public.get_friend_feed(ARRAY[]::uuid[], 10);

  RAISE NOTICE 'PASS: 099 assertions';
END $$;
