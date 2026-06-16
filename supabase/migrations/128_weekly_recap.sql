-- Migration: 128_weekly_recap (F052)
-- "Your week in TT" — a weekly recap aggregated PURELY over existing tables
-- (no new tables) plus a Monday pg_cron fan-out that pushes the recap ONLY to
-- users who actually played that week (no guilt spam, mirroring 021).
--
-- Design notes
-- ============
-- - get_weekly_recap(p_user_id, p_week_start) is a SECURITY DEFINER STABLE RPC
--   that aggregates one ISO week [p_week_start, p_week_start + 7):
--     * sessions            = count of checkins started in the window.
--     * hours               = SUM of checkin durations (ended_at - started_at)
--                             for in-window checkins PLUS SUM of
--                             event_participants.hours_played for events whose
--                             starts_at falls in the window. This mirrors how
--                             PlayHistoryScreen combines the two sources (it
--                             windows event hours on events.starts_at).
--     * venues              = count(DISTINCT venue_id) of in-window checkins.
--     * new_venues          = of those venues, how many the user visited for
--                             the FIRST EVER time in this window — i.e. the
--                             user's all-time MIN(started_at) for that venue
--                             falls inside the window.
--     * friends_played_with = distinct ids unnested from checkins.friends[] over
--                             in-window checkins (excluding the user themselves).
--     * rank / rank_delta   = the user's position in the week's GLOBAL checkin
--                             leaderboard (ROW_NUMBER over per-user in-window
--                             checkin counts DESC), and the same rank for the
--                             prior week minus the current rank (positive = moved
--                             up). rank is NULL when the user has no checkins in
--                             the window; rank_delta is NULL when no prior-week
--                             rank exists. The UI hides a NULL delta.
--     * current_streak      = from user_streaks (F050, migration 126).
-- - The Monday cron (send_weekly_recaps) runs for the JUST-ENDED week
--   (date_trunc('week', now())::date - 7). It selects ONLY users with >=1
--   checkin OR event-participation in that week, and for each enqueues ONE
--   'weekly_recap' notification through create_and_send_notification (097 choke
--   point — so the new 'recap' category opt-out is honored), guarded by a NOT
--   EXISTS de-dupe against an already-sent recap for that period, each wrapped
--   in BEGIN/EXCEPTION WHEN OTHERS THEN NULL so one failure can't abort the run.
-- - notifications_type_check + notification_category() are reproduced IN FULL
--   from 126 (the post-freeze cumulative reproduction rule; 127 added no type)
--   and extended with 'weekly_recap' -> category 'recap'.
-- - No new tables (per the task): everything reads existing checkins /
--   event_participants / events / user_streaks.

-- 1. The recap aggregation RPC ------------------------------------------------
-- Brand new function, so no DROP needed (no prior overload to clash with).
CREATE OR REPLACE FUNCTION public.get_weekly_recap(
  p_user_id   uuid,
  p_week_start date DEFAULT date_trunc('week', now())::date
)
RETURNS TABLE (
  sessions            int,
  hours               numeric,
  venues              int,
  new_venues          int,
  friends_played_with int,
  rank                int,
  rank_delta          int,
  current_streak      int
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start      timestamptz := p_week_start::timestamptz;
  v_end        timestamptz := (p_week_start + 7)::timestamptz;
  v_prev_start timestamptz := (p_week_start - 7)::timestamptz;
  v_rank       int;
  v_prev_rank  int;
BEGIN
  -- The user's rank in the GLOBAL checkin leaderboard for this window. NULL when
  -- they logged no checkins in the window (they don't appear in the ranking).
  SELECT r.rnk INTO v_rank
  FROM (
    SELECT c.user_id,
           (row_number() OVER (ORDER BY count(*) DESC))::int AS rnk
    FROM public.checkins c
    WHERE c.started_at >= v_start AND c.started_at < v_end
    GROUP BY c.user_id
  ) r
  WHERE r.user_id = p_user_id;

  -- The same rank for the PRIOR week (best-effort; for rank_delta).
  SELECT r.rnk INTO v_prev_rank
  FROM (
    SELECT c.user_id,
           (row_number() OVER (ORDER BY count(*) DESC))::int AS rnk
    FROM public.checkins c
    WHERE c.started_at >= v_prev_start AND c.started_at < v_start
    GROUP BY c.user_id
  ) r
  WHERE r.user_id = p_user_id;

  RETURN QUERY
  SELECT
    coalesce(ci.sessions, 0)                                   AS sessions,
    round((coalesce(ci.checkin_hours, 0) + coalesce(ev.event_hours, 0))::numeric, 1) AS hours,
    coalesce(ci.venues, 0)                                     AS venues,
    coalesce(nv.new_venues, 0)                                 AS new_venues,
    coalesce(fr.friends_played_with, 0)                        AS friends_played_with,
    v_rank                                                     AS rank,
    -- Positive delta = the user climbed (lower rank number) vs last week.
    CASE WHEN v_rank IS NOT NULL AND v_prev_rank IS NOT NULL
         THEN v_prev_rank - v_rank ELSE NULL END              AS rank_delta,
    coalesce(us.current_streak, 0)                             AS current_streak
  FROM
    (SELECT 1) base
    -- In-window checkin aggregates: sessions, distinct venues, summed duration.
    LEFT JOIN (
      SELECT count(*)::int                                              AS sessions,
             count(DISTINCT c.venue_id)::int                            AS venues,
             coalesce(sum(extract(epoch FROM (c.ended_at - c.started_at)) / 3600.0), 0) AS checkin_hours
      FROM public.checkins c
      WHERE c.user_id = p_user_id
        AND c.started_at >= v_start AND c.started_at < v_end
    ) ci ON true
    -- Event hours: events the user joined whose starts_at falls in the window.
    LEFT JOIN (
      SELECT coalesce(sum(ep.hours_played), 0) AS event_hours
      FROM public.event_participants ep
      JOIN public.events e ON e.id = ep.event_id
      WHERE ep.user_id = p_user_id
        AND e.starts_at >= v_start AND e.starts_at < v_end
    ) ev ON true
    -- New venues: in-window venues whose all-time first visit is in the window.
    LEFT JOIN (
      SELECT count(*)::int AS new_venues
      FROM (
        SELECT c.venue_id, min(c.started_at) AS first_seen
        FROM public.checkins c
        WHERE c.user_id = p_user_id
        GROUP BY c.venue_id
      ) fv
      WHERE fv.first_seen >= v_start AND fv.first_seen < v_end
    ) nv ON true
    -- Friends played with: distinct ids tagged on in-window checkins.
    LEFT JOIN (
      SELECT count(DISTINCT f.friend_id)::int AS friends_played_with
      FROM public.checkins c
      CROSS JOIN LATERAL unnest(c.friends) AS f(friend_id)
      WHERE c.user_id = p_user_id
        AND c.started_at >= v_start AND c.started_at < v_end
        AND f.friend_id IS NOT NULL
        AND f.friend_id <> p_user_id
    ) fr ON true
    -- Current play-week streak (F050).
    LEFT JOIN (
      -- Alias the table: a bare `current_streak` is ambiguous with the
      -- RETURNS TABLE OUT column of the same name (plpgsql in-scope columns).
      SELECT s.current_streak FROM public.user_streaks s WHERE s.user_id = p_user_id
    ) us ON true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_recap(uuid, date) TO authenticated;

-- 2. Monday cron fan-out: recap push for users who played the just-ended week --
CREATE OR REPLACE FUNCTION public.send_weekly_recaps()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_week  date := date_trunc('week', now())::date - 7;  -- the just-ended week
  v_start timestamptz := v_week::timestamptz;
  v_end   timestamptz := (v_week + 7)::timestamptz;
  r RECORD;
BEGIN
  FOR r IN
    -- Only users who actually played in the just-ended week (no guilt spam):
    -- a checkin started in the window OR an event they joined that started in it.
    SELECT u.id AS user_id
    FROM (
      SELECT c.user_id AS id
      FROM public.checkins c
      WHERE c.started_at >= v_start AND c.started_at < v_end
      UNION
      SELECT ep.user_id AS id
      FROM public.event_participants ep
      JOIN public.events e ON e.id = ep.event_id
      WHERE e.starts_at >= v_start AND e.starts_at < v_end
    ) u
    WHERE u.id IS NOT NULL
      -- De-dupe: at most one 'weekly_recap' per period (week) per user.
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.recipient_id = u.id
          AND n.type = 'weekly_recap'
          AND n.data->>'period' = v_week::text
      )
  LOOP
    BEGIN
      PERFORM public.create_and_send_notification(
        r.user_id, NULL, 'weekly_recap',
        'Săptămâna ta în TT',
        'Recapitularea săptămânii tale e gata — vezi sesiunile, orele și locațiile jucate.',
        jsonb_build_object('screen', '/recap', 'week', v_week::text, 'period', v_week::text)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'send_weekly_recaps';
    -- Monday 09:00 UTC — a fresh offset distinct from process_weekly_streaks
    -- ('9 8 * * 1') so the two Monday jobs don't contend.
    PERFORM cron.schedule('send_weekly_recaps', '0 9 * * 1',
      $cron$SELECT public.send_weekly_recaps()$cron$);
  ELSE
    RAISE NOTICE 'pg_cron unavailable — run send_weekly_recaps() externally (Mondays).';
  END IF;
END $$;

-- 3. Notification type allowlist + category (reproduce full bodies from 126) ---
-- 127 (explorer quests) added NO notification type, so 126 holds the
-- authoritative cumulative list (26 types incl 'streak_reminder'). Carry it
-- forward in full and append 'weekly_recap'.
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
    'streak_reminder',      -- F050
    'weekly_recap'          -- F052
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
    WHEN p_type IN ('weekly_recap') THEN 'recap'
    ELSE NULL
  END;
$$;

-- 4. Grants ------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_weekly_recap(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_weekly_recaps() FROM PUBLIC;
-- (get_weekly_recap EXECUTE grant to authenticated is issued above.)

NOTIFY pgrst, 'reload schema';
