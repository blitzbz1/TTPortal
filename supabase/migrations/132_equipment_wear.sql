-- Migration: 132_equipment_wear (F061)
-- Rubber wear tracker with replacement reminders.
--
-- A TT player uses BOTH rubbers every session, so the wear estimate for each
-- side is the user's TOTAL play hours since that side's rubber was installed,
-- summed from the SAME three sources get_profile_stats / year_in_review already
-- combine: check-in durations (ended_at - started_at), event_participants
-- hours_played (events whose starts_at is in the window) and (since 131) F060
-- training_sessions.hours.
--
-- Design notes
-- ============
-- - equipment_wear_settings holds ONE active wear-tracker per (user, side).
--   Re-rubbering UPDATEs installed_at (resets the clock) and resets
--   notified_pct = 0 (re-arms the 80%/100% reminders). The notified_pct column
--   IS the once-only sent-flag for THIS install: it's simpler + more robust than
--   a notifications NOT-EXISTS de-dupe for a per-rubber reset, because the flag
--   travels with the rubber and is cleared atomically on re-rubber. (The 126/130
--   notifications NOT-EXISTS precedent is the fallback, but the flag column is
--   cleaner here since "already sent for THIS rubber" can't be expressed by a
--   stable notifications period key once a side is re-rubbered.)
-- - The table is SELECT-own under RLS; ALL writes go through the SECURITY
--   DEFINER set_rubber_install RPC so notified_pct can never be tampered with
--   from the client (mirrors user_streaks 126 / user_milestones 129: a counter
--   column owned by a DEFINER worker).
-- - The nightly process_rubber_wear() cron recomputes each side's estimate,
--   pushes the 80% then the 100% reminder exactly once (gated on notified_pct),
--   routing through create_and_send_notification (097 choke point — so the new
--   'wear' opt-out category is honored), each send wrapped in BEGIN/EXCEPTION so
--   one failure can't abort the batch. The push deep-links to the Equipment
--   screen ('/(protected)/equipment').
-- - notifications_type_check + notification_category() are reproduced IN FULL
--   from 130 (the post-freeze cumulative reproduction rule; 131 added no type)
--   and extended with 'rubber_wear' -> category 'wear'.

-- 1. equipment_wear_settings: one active wear-tracker per (user, side) ---------
CREATE TABLE IF NOT EXISTS public.equipment_wear_settings (
  id             bigserial PRIMARY KEY,
  user_id        uuid NOT NULL DEFAULT auth.uid()
                   REFERENCES public.profiles(id) ON DELETE CASCADE,
  side           text NOT NULL CHECK (side IN ('forehand', 'backhand')),
  installed_at   date NOT NULL DEFAULT current_date,
  expected_hours numeric NOT NULL DEFAULT 60
                   CHECK (expected_hours > 0 AND expected_hours <= 1000),
  -- Once-only sent-flag for THIS install: 0 = nothing sent, 80 = 80% reminder
  -- sent, 100 = replacement reminder sent. Reset to 0 on re-rubber.
  notified_pct   int NOT NULL DEFAULT 0 CHECK (notified_pct IN (0, 80, 100)),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, side)
);

ALTER TABLE public.equipment_wear_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own wear settings" ON public.equipment_wear_settings;
CREATE POLICY "Users read own wear settings" ON public.equipment_wear_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Writes go exclusively through set_rubber_install (so notified_pct is
-- DEFINER-owned and can't be tampered) — SELECT is the only client grant.
GRANT SELECT ON public.equipment_wear_settings TO authenticated;

CREATE INDEX IF NOT EXISTS idx_equipment_wear_settings_user
  ON public.equipment_wear_settings (user_id);

-- 2. set_rubber_install: UPSERT the install + reset the clock & sent-flag ------
-- Re-rubber (same side) resets installed_at + expected_hours and re-arms the
-- reminders (notified_pct = 0). DEFINER so it can write notified_pct, with an
-- auth guard so it only ever acts for the caller.
CREATE OR REPLACE FUNCTION public.set_rubber_install(
  p_side           text,
  p_installed_at   date    DEFAULT current_date,
  p_expected_hours numeric DEFAULT 60
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_side NOT IN ('forehand', 'backhand') THEN
    RAISE EXCEPTION 'invalid side %', p_side;
  END IF;

  INSERT INTO public.equipment_wear_settings
    (user_id, side, installed_at, expected_hours, notified_pct, updated_at)
  VALUES
    (v_user, p_side, coalesce(p_installed_at, current_date),
     coalesce(p_expected_hours, 60), 0, now())
  ON CONFLICT (user_id, side) DO UPDATE SET
    installed_at   = excluded.installed_at,
    expected_hours = excluded.expected_hours,
    notified_pct   = 0,
    updated_at     = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_rubber_install(text, date, numeric) TO authenticated;

-- 3. get_rubber_wear: per-side estimate from all THREE play-hour sources -------
-- For each of the caller's wear settings, estimated_hours = the user's TOTAL
-- play hours since installed_at, summed from check-in durations + event hours +
-- training-session hours (a TT player uses both rubbers every session, so the
-- total applies to each side). pct = round(estimated / expected * 100). Self
-- only (v1): p_user_id defaults to auth.uid() and the WHERE also pins to
-- auth.uid(), so passing another user's id can never leak their wear settings
-- (DEFINER bypasses the table RLS, so the guard must live in the query).
CREATE OR REPLACE FUNCTION public.get_rubber_wear(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  side            text,
  installed_at    date,
  expected_hours  numeric,
  estimated_hours numeric,
  pct             int
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    ws.side,
    ws.installed_at,
    ws.expected_hours,
    est.estimated_hours,
    round(est.estimated_hours / ws.expected_hours * 100)::int AS pct
  FROM public.equipment_wear_settings ws
  CROSS JOIN LATERAL (
    SELECT round((
      -- Check-in durations since install.
      coalesce((
        SELECT sum(extract(epoch FROM (c.ended_at - c.started_at)) / 3600.0)
        FROM public.checkins c
        WHERE c.user_id = ws.user_id
          AND c.started_at >= ws.installed_at::timestamptz
      ), 0)
      -- Event hours for events that started since install (windowed on
      -- events.starts_at, like year_in_review 130 windows event hours).
      + coalesce((
        SELECT sum(ep.hours_played)
        FROM public.event_participants ep
        JOIN public.events e ON e.id = ep.event_id
        WHERE ep.user_id = ws.user_id
          AND e.starts_at >= ws.installed_at::timestamptz
      ), 0)
      -- Training-session hours since install (F060, the third source).
      + coalesce((
        SELECT sum(ts.hours)
        FROM public.training_sessions ts
        WHERE ts.user_id = ws.user_id
          AND ts.created_at >= ws.installed_at::timestamptz
      ), 0)
    )::numeric, 1) AS estimated_hours
  ) est
  -- Self-only guard: pin to BOTH the requested id and the caller, so a DEFINER
  -- call with someone else's id returns nothing.
  WHERE ws.user_id = p_user_id
    AND ws.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_rubber_wear(uuid) TO authenticated;

-- 4. process_rubber_wear(): nightly threshold reminders (once-only / re-armed) -
-- For each wear setting, recompute the estimate (same three-source sum) and push
-- the 100% reminder (pct >= 100 AND notified_pct < 100) or, failing that, the
-- 80% reminder (pct >= 80 AND notified_pct < 80), advancing notified_pct so each
-- fires at most once per install. Re-rubber (set_rubber_install) resets
-- notified_pct = 0 and re-arms both. Routes through create_and_send_notification
-- (097) so the 'wear' opt-out is honored; each send wrapped in BEGIN/EXCEPTION.
CREATE OR REPLACE FUNCTION public.process_rubber_wear()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  r        RECORD;
  v_hours  numeric;
  v_pct    int;
BEGIN
  FOR r IN
    SELECT id, user_id, side, installed_at, expected_hours, notified_pct
    FROM public.equipment_wear_settings
  LOOP
    -- Same three-source estimate as get_rubber_wear, scoped to this side's
    -- install date.
    v_hours :=
      coalesce((
        SELECT sum(extract(epoch FROM (c.ended_at - c.started_at)) / 3600.0)
        FROM public.checkins c
        WHERE c.user_id = r.user_id
          AND c.started_at >= r.installed_at::timestamptz
      ), 0)
      + coalesce((
        SELECT sum(ep.hours_played)
        FROM public.event_participants ep
        JOIN public.events e ON e.id = ep.event_id
        WHERE ep.user_id = r.user_id
          AND e.starts_at >= r.installed_at::timestamptz
      ), 0)
      + coalesce((
        SELECT sum(ts.hours)
        FROM public.training_sessions ts
        WHERE ts.user_id = r.user_id
          AND ts.created_at >= r.installed_at::timestamptz
      ), 0);

    v_pct := round(v_hours / r.expected_hours * 100)::int;

    IF v_pct >= 100 AND r.notified_pct < 100 THEN
      UPDATE public.equipment_wear_settings
      SET notified_pct = 100, updated_at = now()
      WHERE id = r.id;
      BEGIN
        PERFORM public.create_and_send_notification(
          r.user_id, NULL, 'rubber_wear',
          'E timpul pentru un cauciuc nou',
          'Cauciucul tău și-a atins durata de viață estimată. Schimbă-l ca să-ți păstrezi senzația și controlul.',
          jsonb_build_object('screen', '/(protected)/equipment', 'side', r.side, 'pct', v_pct)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    ELSIF v_pct >= 80 AND r.notified_pct < 80 THEN
      UPDATE public.equipment_wear_settings
      SET notified_pct = 80, updated_at = now()
      WHERE id = r.id;
      BEGIN
        PERFORM public.create_and_send_notification(
          r.user_id, NULL, 'rubber_wear',
          'Cauciucul tău se apropie de final',
          'Ai folosit aproape toată durata estimată a cauciucului. Gândește-te la o înlocuire în curând.',
          jsonb_build_object('screen', '/(protected)/equipment', 'side', r.side, 'pct', v_pct)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process_rubber_wear';
    -- 04:17 UTC daily — a fresh minute offset distinct from the existing daily
    -- jobs (47 3, 41 *, 53 4, 31 5) and weekly jobs (9 8 Mon, 0 9 Mon).
    PERFORM cron.schedule('process_rubber_wear', '17 4 * * *',
      $cron$SELECT public.process_rubber_wear()$cron$);
  ELSE
    RAISE NOTICE 'pg_cron unavailable — run process_rubber_wear() externally (nightly).';
  END IF;
END $$;

-- 5. Notification type allowlist + category (reproduce full bodies from 130) ---
-- 131 (training_sessions) added NO notification type, so 130 holds the
-- authoritative cumulative list (29 types incl 'year_wrapped'). Carry it forward
-- in full and append 'rubber_wear'.
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
    'weekly_recap',         -- F052
    'year_wrapped',         -- F054
    'rubber_wear'           -- F061
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
    WHEN p_type IN ('year_wrapped') THEN 'wrapped'
    WHEN p_type IN ('rubber_wear') THEN 'wear'
    ELSE NULL
  END;
$$;

-- 6. Grants ------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_rubber_install(text, date, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_rubber_wear(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_rubber_wear() FROM PUBLIC;
-- (set_rubber_install / get_rubber_wear EXECUTE grants to authenticated are
-- issued above.)

NOTIFY pgrst, 'reload schema';
