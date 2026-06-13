-- Assertions for 104_profiles_skill_goals (F001), prod-parity container.
DO $$
DECLARE
  v_user uuid;
  v_mix jsonb;
  v_ok boolean;
BEGIN
  -- Structure: the two columns exist.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'profiles'
                   AND column_name = 'skill_level') THEN
    RAISE EXCEPTION 'FAIL: profiles.skill_level missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'profiles'
                   AND column_name = 'play_goals') THEN
    RAISE EXCEPTION 'FAIL: profiles.play_goals missing';
  END IF;

  -- get_venue_player_mix exists and is NULL below the 5-visitor threshold
  -- (a non-existent venue has zero levellers).
  v_mix := public.get_venue_player_mix(-1);
  IF v_mix IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: player-mix should be NULL below the 5-visitor threshold (got %)', v_mix;
  END IF;

  -- Grants: anon may read; authenticated may read + write.
  IF NOT has_column_privilege('anon', 'public.profiles', 'skill_level', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon lacks SELECT on profiles.skill_level';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.profiles', 'play_goals', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated lacks UPDATE on profiles.play_goals';
  END IF;

  -- Constraint behavior (needs a real row — profiles FK to auth.users).
  SELECT id INTO v_user FROM public.profiles LIMIT 1;
  IF v_user IS NULL THEN
    RAISE NOTICE 'SKIP: no profiles seeded for constraint behavioral checks';
  ELSE
    v_ok := true;
    BEGIN
      UPDATE public.profiles SET skill_level = 'pro' WHERE id = v_user;
      v_ok := false;  -- should not reach here
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FAIL: invalid skill_level accepted'; END IF;

    v_ok := true;
    BEGIN
      UPDATE public.profiles SET play_goals = ARRAY['bogus'] WHERE id = v_user;
      v_ok := false;
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FAIL: invalid play_goal accepted'; END IF;

    -- Valid values accepted; then restore.
    UPDATE public.profiles
       SET skill_level = 'club', play_goals = ARRAY['doubles', 'casual_rallies']
     WHERE id = v_user;
    UPDATE public.profiles
       SET skill_level = NULL, play_goals = '{}'::text[]
     WHERE id = v_user;
  END IF;

  RAISE NOTICE 'PASS: 104 assertions';
END $$;

SELECT 'ALL 104 ASSERTIONS PASSED' AS result;
