-- Assertions for 097_notification_preferences (prod-parity container).
DO $$
DECLARE
  v_user uuid;
  v_sender uuid;
  v_count int;
BEGIN
  -- Structure
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'profiles'
                   AND column_name = 'notification_prefs') THEN
    RAISE EXCEPTION 'FAIL: profiles.notification_prefs missing';
  END IF;

  -- Category mapping
  IF public.notification_category('friend_request') <> 'friend_requests'
     OR public.notification_category('event_reminder') <> 'events'
     OR public.notification_category('feedback_reply') <> 'feedback_replies'
     OR public.notification_category('totally_new_type') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: notification_category mapping wrong';
  END IF;

  SELECT id INTO v_user FROM public.profiles LIMIT 1;
  IF v_user IS NULL THEN
    RAISE NOTICE 'SKIP: no profiles seeded for behavioral checks';
    RETURN;
  END IF;
  SELECT id INTO v_sender FROM public.profiles WHERE id <> v_user LIMIT 1;

  -- Default: enabled
  IF NOT public.notification_pref_enabled(v_user, 'event_reminder') THEN
    RAISE EXCEPTION 'FAIL: default pref should be enabled';
  END IF;
  -- Unmapped: fail-open
  IF NOT public.notification_pref_enabled(v_user, 'mystery_type') THEN
    RAISE EXCEPTION 'FAIL: unmapped types must deliver';
  END IF;

  -- Opt-out gates delivery through the choke point
  UPDATE public.profiles SET notification_prefs = '{"events": false}'::jsonb WHERE id = v_user;
  IF public.notification_pref_enabled(v_user, 'event_reminder') THEN
    RAISE EXCEPTION 'FAIL: events=false should disable event_reminder';
  END IF;

  IF v_sender IS NOT NULL THEN
    PERFORM public.create_and_send_notification(v_user, v_sender, 'event_reminder', 't', 'b', '{}'::jsonb);
    SELECT count(*) INTO v_count FROM public.notifications
    WHERE recipient_id = v_user AND type = 'event_reminder' AND title = 't';
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'FAIL: choke point delivered despite opt-out';
    END IF;

    -- And still delivers other categories
    PERFORM public.create_and_send_notification(v_user, v_sender, 'friend_request', 't2', 'b', '{}'::jsonb);
    SELECT count(*) INTO v_count FROM public.notifications
    WHERE recipient_id = v_user AND type = 'friend_request' AND title = 't2';
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'FAIL: enabled category did not deliver';
    END IF;
    DELETE FROM public.notifications WHERE title IN ('t', 't2');
  END IF;

  -- Legacy toggle still authoritative
  UPDATE public.profiles SET notification_prefs = '{}'::jsonb, notify_friend_checkins = false WHERE id = v_user;
  IF public.notification_pref_enabled(v_user, 'friend_checkin') THEN
    RAISE EXCEPTION 'FAIL: legacy notify_friend_checkins=false must gate friend_checkins';
  END IF;
  UPDATE public.profiles SET notify_friend_checkins = true WHERE id = v_user;

  RAISE NOTICE 'PASS: 097 assertions';
END $$;
