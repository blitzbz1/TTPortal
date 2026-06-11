-- Assertions for 096_async_stats_refresh (run on the prod-parity container).
DO $$
BEGIN
  -- 1. The synchronous triggers are gone.
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_review_change_refresh_stats') THEN
    RAISE EXCEPTION 'FAIL: on_review_change_refresh_stats still exists on reviews';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_profile_updated_refresh_lb') THEN
    RAISE EXCEPTION 'FAIL: on_profile_updated_refresh_lb still exists on profiles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname IN
               ('refresh_stats_on_review_change', 'refresh_leaderboards_on_profile_change')) THEN
    RAISE EXCEPTION 'FAIL: trigger wrapper functions still exist';
  END IF;

  -- 2. refresh_stats() itself survives (the cron job calls it).
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'refresh_stats') THEN
    RAISE EXCEPTION 'FAIL: public.refresh_stats() missing';
  END IF;

  -- 3. If pg_cron is available, the job must be scheduled.
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_stats_matviews') THEN
      RAISE EXCEPTION 'FAIL: pg_cron present but refresh_stats_matviews not scheduled';
    END IF;
  END IF;

  RAISE NOTICE 'PASS: 096 assertions';
END $$;

-- 4. Behavior: a review insert no longer performs the refresh inline.
--    (Smoke: insert + delete a review as superuser; the matview content is
--    allowed to be stale until the cron tick.)
DO $$
DECLARE
  v_venue int;
  v_user uuid;
BEGIN
  SELECT id INTO v_venue FROM public.venues LIMIT 1;
  SELECT id INTO v_user FROM public.profiles LIMIT 1;
  IF v_venue IS NULL OR v_user IS NULL THEN
    RAISE NOTICE 'SKIP: no seed venue/profile for review-write smoke';
    RETURN;
  END IF;
  INSERT INTO public.reviews (venue_id, user_id, rating, body)
  VALUES (v_venue, v_user, 5, 'cron-refresh smoke');
  DELETE FROM public.reviews WHERE body = 'cron-refresh smoke';
  RAISE NOTICE 'PASS: review write path runs without inline refresh';
END $$;
