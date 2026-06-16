-- Migration: 126_streaks (F050)
-- Weekly play streaks. A live counter table (user_streaks) is maintained by
-- thin AFTER INSERT triggers on checkins + event_participants (the 094
-- thin-trigger -> heavy-worker idiom), surfaced through get_profile_stats, and
-- swept weekly by a pg_cron job that either consumes a once-a-month "freeze" to
-- bridge a missed week or resets the streak, pushing a single lapse nudge.
--
-- Design notes
-- ============
-- - A "week" is date_trunc('week', <play time>)::date (ISO Monday). The streak
--   counts consecutive play-weeks: a play in the week immediately after the last
--   counted week (last_played_week + 7) increments; a later week resets to 1.
-- - user_streaks is SELECT-only under RLS (own row); ALL writes go through the
--   SECURITY DEFINER worker sync_user_streak / the cron job. This mirrors the
--   user_badge_progress counter-table shape (094) but keyed by user_id alone.
-- - The weekly cron is what PREVENTS a gap: when a user misses the week that
--   just ended it consumes their monthly freeze (bridging last_played_week to
--   the missed week so the run survives) or, if the freeze is already spent this
--   calendar month, resets the run to 0. By the time a play lands AFTER an
--   un-bridged gap, the run has already lapsed, so the worker resets to 1.
-- - The lapse push routes through create_and_send_notification (097 choke
--   point) so the new 'streak' category opt-out is honored — NOT a hand-rolled
--   INSERT + send_push like the legacy 012/021 jobs. A NOT EXISTS guard against
--   an already-sent 'streak_reminder' for the period de-dupes (021 precedent),
--   and each send is wrapped so one failure can't abort the batch.
-- - notifications_type_check + notification_category() are reproduced IN FULL
--   from 124 (the post-freeze cumulative reproduction rule; 125 added no type)
--   and extended with 'streak_reminder' -> category 'streak'.

-- 1. user_streaks counter table + RLS (SELECT-only; writes via DEFINER fns) ---
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak   int NOT NULL DEFAULT 0,
  best_streak      int NOT NULL DEFAULT 0,
  -- The most recent counted play-week (ISO Monday date).
  last_played_week date,
  -- date_trunc('month', now())::date of the month a freeze was last consumed;
  -- at most one freeze per calendar month.
  freeze_used_month date,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own streak" ON public.user_streaks;
CREATE POLICY "Users read own streak" ON public.user_streaks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
GRANT SELECT ON public.user_streaks TO authenticated;

-- 2. Sync worker: advance/reset the streak for one play event ------------------
-- Heavy worker (094 idiom). Computes the play-week and upserts user_streaks.
CREATE OR REPLACE FUNCTION public.sync_user_streak(p_user uuid, p_played_at timestamptz)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_week date := date_trunc('week', p_played_at)::date;
  v_last date;
  v_cur  int;
  v_best int;
BEGIN
  IF p_user IS NULL OR p_played_at IS NULL THEN
    RETURN;
  END IF;

  SELECT last_played_week, current_streak, best_streak
    INTO v_last, v_cur, v_best
  FROM public.user_streaks
  WHERE user_id = p_user
  FOR UPDATE;

  IF NOT FOUND THEN
    -- First ever counted play-week.
    INSERT INTO public.user_streaks (user_id, current_streak, best_streak, last_played_week)
    VALUES (p_user, 1, 1, v_week)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN;
  END IF;

  IF v_last IS NULL THEN
    v_cur := 1;
  ELSIF v_week = v_last THEN
    -- Already counted this week — nothing to advance.
    NULL;
  ELSIF v_week = v_last + 7 THEN
    -- Next consecutive week.
    v_cur := v_cur + 1;
  ELSIF v_week > v_last + 7 THEN
    -- A real gap (the weekly cron didn't bridge it) — the run lapsed.
    v_cur := 1;
  END IF;
  -- v_week < v_last (a backfilled older play) leaves current_streak untouched.

  UPDATE public.user_streaks
  SET current_streak   = v_cur,
      best_streak      = greatest(v_best, v_cur),
      last_played_week = greatest(v_week, v_last),
      updated_at       = now()
  WHERE user_id = p_user;
END;
$$;

-- 3. Thin AFTER INSERT triggers on the two source tables (009 is frozen; these
--    are NEW separately-named triggers, not edits to 009). --------------------
CREATE OR REPLACE FUNCTION public.trg_sync_streak_checkin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sync_user_streak(NEW.user_id, NEW.started_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS streak_sync_on_checkin ON public.checkins;
CREATE TRIGGER streak_sync_on_checkin
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_streak_checkin();

CREATE OR REPLACE FUNCTION public.trg_sync_streak_event_participant()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  -- The participant's joined_at is the moment they committed to play.
  PERFORM public.sync_user_streak(NEW.user_id, NEW.joined_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS streak_sync_on_event_participant ON public.event_participants;
CREATE TRIGGER streak_sync_on_event_participant
  AFTER INSERT ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_streak_event_participant();

-- 4. Weekly expiry / freeze / lapse-nudge sweep -------------------------------
-- Runs Monday morning. For each user with a live streak that missed the week
-- that JUST ended: consume the monthly freeze (bridge the gap) + nudge once, or
-- reset the run. Users who played the just-ended week are left alone.
CREATE OR REPLACE FUNCTION public.process_weekly_streaks()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_this_week  date := date_trunc('week', now())::date;
  v_prev_week  date := date_trunc('week', now())::date - 7;
  v_this_month date := date_trunc('month', now())::date;
  r RECORD;
BEGIN
  FOR r IN
    SELECT user_id, current_streak, last_played_week, freeze_used_month
    FROM public.user_streaks
    WHERE current_streak > 0
      -- Missed the week that just ended (no counted play in v_prev_week or later).
      AND (last_played_week IS NULL OR last_played_week < v_prev_week)
  LOOP
    IF r.freeze_used_month IS NULL OR r.freeze_used_month < v_this_month THEN
      -- Freeze available this month: consume it and bridge the gap so the run
      -- survives. last_played_week jumps to the just-ended week.
      UPDATE public.user_streaks
      SET freeze_used_month = v_this_month,
          last_played_week  = v_prev_week,
          updated_at        = now()
      WHERE user_id = r.user_id;

      -- One lapse-warning push (097 choke point honors the 'streak' opt-out).
      -- De-dupe: at most one 'streak_reminder' per period (week) per user.
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.recipient_id = r.user_id
          AND n.type = 'streak_reminder'
          AND n.data->>'period' = v_prev_week::text
      ) THEN
        BEGIN
          PERFORM public.create_and_send_notification(
            r.user_id, NULL, 'streak_reminder',
            'Seria ta e în pericol',
            'Ai sărit o săptămână — am folosit înghețarea lunară ca să-ți păstrăm seria. Joacă săptămâna asta ca să o ții aprinsă!',
            jsonb_build_object('screen', '/(tabs)/profile', 'period', v_prev_week::text)
          );
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    ELSE
      -- Freeze already spent this month — the run lapses.
      UPDATE public.user_streaks
      SET current_streak = 0,
          updated_at     = now()
      WHERE user_id = r.user_id;
    END IF;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process_weekly_streaks';
    -- Monday 08:09 UTC — a fresh minute offset + day-of-week field (no other
    -- weekly job exists; existing jobs occupy other minutes on daily/hourly).
    PERFORM cron.schedule('process_weekly_streaks', '9 8 * * 1',
      $cron$SELECT public.process_weekly_streaks()$cron$);
  ELSE
    RAISE NOTICE 'pg_cron unavailable — run process_weekly_streaks() externally (Mondays).';
  END IF;
END $$;

-- 5. Fold the streak into get_profile_stats (reproduce 051 in full + extend) ---
-- 051 is frozen; its body is reproduced verbatim here with the two streak
-- columns appended via a LEFT JOIN to user_streaks. Adding columns changes the
-- RETURNS TABLE shape, so CREATE OR REPLACE alone errors ("cannot change return
-- type"); drop the single (uuid) overload first.
DROP FUNCTION IF EXISTS public.get_profile_stats(uuid);
CREATE OR REPLACE FUNCTION public.get_profile_stats(p_user_id uuid)
RETURNS TABLE (
  total_checkins     int,
  unique_venues      int,
  events_joined      int,
  total_hours_played numeric,
  current_streak     int,
  best_streak        int
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce(lc.total_checkins, 0)     AS total_checkins,
    coalesce(lc.unique_venues, 0)      AS unique_venues,
    coalesce(ep.events_joined, 0)      AS events_joined,
    coalesce(ep.total_hours_played, 0) AS total_hours_played,
    coalesce(us.current_streak, 0)     AS current_streak,
    coalesce(us.best_streak, 0)        AS best_streak
  FROM
    (SELECT 1) base
    LEFT JOIN (
      SELECT total_checkins, unique_venues
      FROM public.leaderboard_checkins
      WHERE user_id = p_user_id
    ) lc ON true
    LEFT JOIN (
      SELECT count(*)::int                  AS events_joined,
             coalesce(sum(hours_played), 0) AS total_hours_played
      FROM public.event_participants
      WHERE user_id = p_user_id
    ) ep ON true
    LEFT JOIN (
      SELECT current_streak, best_streak
      FROM public.user_streaks
      WHERE user_id = p_user_id
    ) us ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_stats(uuid) TO authenticated, anon;

-- 6. Notification type allowlist + category (reproduce full bodies from 124) ---
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request', 'friend_accepted',
    'event_reminder', 'event_joined', 'event_cancelled',
    'event_invite', 'event_update',
    'event_feedback_request', 'event_feedback_received',
    'checkin_nearby', 'review_on_venue', 'feedback_reply',
    'match_confirm', 'match_confirmed', 'match_disputed',
    'venue_post_reply',
    'play_broadcast', 'play_join', 'play_converted',
    'match_invite', 'match_invite_accepted',
    'dm_message',
    'bracket_match_ready',
    'season_ended',
    'club_event_created',   -- F040
    'referral_joined',      -- F041
    'streak_reminder'       -- F050
  ));

CREATE OR REPLACE FUNCTION public.notification_category(p_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_type IN ('friend_request', 'friend_accepted') THEN 'friend_requests'
    WHEN p_type IN ('checkin', 'checkin_nearby', 'friend_checkin') THEN 'friend_checkins'
    WHEN p_type IN ('event_reminder', 'event_update', 'event_cancelled', 'event_joined',
                    'event_invite', 'event_challenge',
                    'event_feedback_request', 'event_feedback_received') THEN 'events'
    WHEN p_type IN ('review', 'review_on_venue') THEN 'reviews_on_my_venue'
    WHEN p_type IN ('feedback_reply') THEN 'feedback_replies'
    WHEN p_type IN ('match_confirm', 'match_confirmed', 'match_disputed') THEN 'matches'
    WHEN p_type IN ('venue_post_reply') THEN 'venue_board'
    WHEN p_type IN ('play_broadcast', 'play_join', 'play_converted') THEN 'open_play'
    WHEN p_type IN ('match_invite', 'match_invite_accepted') THEN 'match_invites'
    WHEN p_type IN ('dm_message') THEN 'messages'
    WHEN p_type IN ('bracket_match_ready') THEN 'tournaments'
    WHEN p_type IN ('season_ended') THEN 'seasons'
    WHEN p_type IN ('club_event_created') THEN 'club_event'
    WHEN p_type IN ('referral_joined') THEN 'referrals'
    WHEN p_type IN ('streak_reminder') THEN 'streak'
    ELSE NULL
  END;
$$;

-- 7. Grants ------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.sync_user_streak(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_sync_streak_checkin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_sync_streak_event_participant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_weekly_streaks() FROM PUBLIC;
-- (get_profile_stats / notification_category grants are issued above / inherited.)

NOTIFY pgrst, 'reload schema';
