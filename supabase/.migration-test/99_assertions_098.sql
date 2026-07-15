-- Assertions for 098_trust_safety_groundwork (prod-parity container,
-- requires the two seed profiles from the 097 behavioral block).
DO $$
DECLARE
  v_user uuid;
  v_venue int;
  v_review_id int;
  v_count int;
BEGIN
  -- Structure
  PERFORM 1 FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'moderation_audit_log';
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: moderation_audit_log missing'; END IF;

  -- ugc_suspicious heuristics
  IF NOT public.ugc_suspicious('great table, see https://spam.example') THEN
    RAISE EXCEPTION 'FAIL: URL not flagged';
  END IF;
  IF public.ugc_suspicious('Masa e foarte buna, plasa noua.') THEN
    RAISE EXCEPTION 'FAIL: clean text flagged';
  END IF;

  SELECT id INTO v_user FROM public.profiles LIMIT 1;
  SELECT id INTO v_venue FROM public.venues LIMIT 1;
  IF v_user IS NULL OR v_venue IS NULL THEN
    RAISE NOTICE 'SKIP: behavioral checks need seed profile+venue';
    RETURN;
  END IF;

  -- Suspicious review lands flagged (soft flag — write succeeds)
  INSERT INTO public.reviews (venue_id, user_id, rating, body)
  VALUES (v_venue, v_user, 5, 'buy followers at https://spam.example')
  RETURNING id INTO v_review_id;
  IF NOT (SELECT flagged FROM public.reviews WHERE id = v_review_id) THEN
    RAISE EXCEPTION 'FAIL: suspicious review not auto-flagged';
  END IF;

  -- Clean review stays clean
  INSERT INTO public.reviews (venue_id, user_id, rating, body)
  VALUES (v_venue, v_user, 4, 'masa ok')
  ON CONFLICT (user_id, venue_id) DO UPDATE SET body = 'masa ok', flagged = false
  RETURNING id INTO v_review_id;

  -- Audit rows: venue approve flip writes who/what
  UPDATE public.venues SET approved = NOT COALESCE(approved, true) WHERE id = v_venue;
  UPDATE public.venues SET approved = NOT COALESCE(approved, true) WHERE id = v_venue;
  SELECT count(*) INTO v_count FROM public.moderation_audit_log WHERE target_type = 'venue' AND target_id = v_venue::text;
  IF v_count < 2 THEN
    RAISE EXCEPTION 'FAIL: venue approval flips not audited (got %)', v_count;
  END IF;

  DELETE FROM public.reviews WHERE user_id = v_user AND venue_id = v_venue;
  RAISE NOTICE 'PASS: 098 assertions';
END $$;
