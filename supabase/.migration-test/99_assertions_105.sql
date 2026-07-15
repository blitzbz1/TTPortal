-- Assertions for 105_matches (F002), prod-parity container.
-- Structure + auto-confirm + constraints are verified here. The confirm/
-- dispute RPCs read auth.uid() (JWT claim) — those paths are covered by the
-- service-layer jest tests; here we exercise what's deterministic as superuser.
DO $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_id bigint;
  v_status text;
  v_ok boolean;
BEGIN
  -- Structure
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'matches') THEN
    RAISE EXCEPTION 'FAIL: public.matches missing';
  END IF;

  -- Functions exist
  IF to_regprocedure('public.log_match(uuid, jsonb, uuid, integer, integer, text)') IS NULL
     OR to_regprocedure('public.confirm_match(bigint)') IS NULL
     OR to_regprocedure('public.dispute_match(bigint)') IS NULL
     OR to_regprocedure('public.get_player_matches(uuid, integer)') IS NULL
     OR to_regprocedure('public.get_pending_matches()') IS NULL
     OR to_regprocedure('public.auto_confirm_stale_matches()') IS NULL THEN
    RAISE EXCEPTION 'FAIL: one or more match RPCs missing';
  END IF;

  -- Notification category registered (097 extension).
  IF public.notification_category('match_confirm') <> 'matches' THEN
    RAISE EXCEPTION 'FAIL: match_confirm should map to the matches category';
  END IF;

  -- Need two real users (FK to auth.users) for the behavioral checks.
  SELECT id INTO v_a FROM public.profiles LIMIT 1;
  SELECT id INTO v_b FROM public.profiles WHERE id <> v_a LIMIT 1;
  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE NOTICE 'SKIP: need two profiles for match behavioral checks';
    RETURN;
  END IF;

  -- winner-must-be-a-player CHECK
  v_ok := true;
  BEGIN
    INSERT INTO public.matches (reporter_id, opponent_id, winner_id)
    VALUES (v_a, v_b, gen_random_uuid());  -- winner is a third party
    v_ok := false;
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL: winner outside the two players was accepted'; END IF;

  -- distinct-players CHECK
  v_ok := true;
  BEGIN
    INSERT INTO public.matches (reporter_id, opponent_id) VALUES (v_a, v_a);
    v_ok := false;
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL: self-match was accepted'; END IF;

  -- auto_confirm flips a 73h-old pending match to confirmed.
  INSERT INTO public.matches (reporter_id, opponent_id, winner_id, status, created_at)
  VALUES (v_a, v_b, v_a, 'pending', now() - INTERVAL '73 hours')
  RETURNING id INTO v_id;
  PERFORM public.auto_confirm_stale_matches();
  SELECT status INTO v_status FROM public.matches WHERE id = v_id;
  IF v_status <> 'confirmed' THEN
    RAISE EXCEPTION 'FAIL: stale pending match not auto-confirmed (status=%)', v_status;
  END IF;
  DELETE FROM public.matches WHERE id = v_id;

  RAISE NOTICE 'PASS: 105 assertions';
END $$;

SELECT 'ALL 105 ASSERTIONS PASSED' AS result;
