-- Migration: 129_milestones (F053)
-- Lifetime "milestone moments". Durable per-user milestone rows
-- (user_milestones) awarded by thin AFTER INSERT triggers on checkins,
-- event_participants and reviews (the 094/126/127 thin-trigger → heavy-worker
-- idiom) plus a daily pg_cron for the time-based 1-year anniversary. Earned
-- milestones + the counters that drive the "next milestone ghost" on the
-- Profile strip are read through get_profile_stats (extended here).
--
-- Design notes
-- ============
-- - Milestone KEYS + thresholds live in CLIENT code (src/features/milestones/
--   definitions.ts) for display; the SERVER worker functions here hold the SAME
--   thresholds so the durable award rows match the client constants. The DB only
--   stores which keys a user has crossed; the client computes ghost progress.
-- - user_milestones is SELECT-own under RLS; ALL writes go through the
--   SECURITY DEFINER workers / the daily cron (mirrors user_streaks 126 /
--   explorer_quest_awards 127). UNIQUE (user_id, milestone_key) +
--   ON CONFLICT DO NOTHING keeps re-firing a trigger (e.g. an 11th check-in)
--   from ever double-awarding.
-- - Total hours combines BOTH sources, exactly like get_profile_stats /
--   PlayHistoryScreen: checkin durations (ended_at - started_at) AND
--   event_participants.hours_played. event_participants AFTER INSERT therefore
--   also fires the milestone sync (event hours change there).
-- - F053 adds NO notification type — the milestone celebration is a CLIENT-side
--   full-screen sheet (diffed from the earned set on focus/refetch), so
--   notifications_type_check / notification_category() are NOT touched.
-- - get_profile_stats currently has the 6-column shape from 126 (streaks). We
--   reproduce that body verbatim and append reviews_written + member_since.
--   Adding columns changes the RETURNS TABLE shape, so CREATE OR REPLACE alone
--   errors ("cannot change return type of existing function"); the single
--   (uuid) overload is dropped first.

-- 1. user_milestones durable-award table + RLS (SELECT-own) -------------------
CREATE TABLE IF NOT EXISTS public.user_milestones (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_key text NOT NULL,
  achieved_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone_key)
);
CREATE INDEX IF NOT EXISTS idx_user_milestones_user
  ON public.user_milestones (user_id);

ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own milestones" ON public.user_milestones;
CREATE POLICY "Users read own milestones" ON public.user_milestones
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
GRANT SELECT ON public.user_milestones TO authenticated;

-- 2. Check-in / hours / venue milestone sync worker --------------------------
-- Heavy worker (094/126/127 idiom). Recomputes the user's lifetime check-in
-- count, distinct-venue count and total hours (BOTH checkin durations AND event
-- hours), then idempotently inserts a milestone row for every crossed
-- threshold. Thresholds MUST match src/features/milestones/definitions.ts:
--   check-ins      → 10 / 50 / 100  (checkin_10 / checkin_50 / checkin_100)
--   distinct venue → 10 / 25        (venues_10 / venues_25)
--   hours          → 50 / 100 / 250 (hours_50 / hours_100 / hours_250)
CREATE OR REPLACE FUNCTION public.sync_checkin_milestones(p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_checkins int;
  v_venues   int;
  v_hours    numeric;
BEGIN
  IF p_user IS NULL THEN
    RETURN;
  END IF;

  -- Lifetime check-in count + distinct venues from the live checkins table.
  SELECT count(*)::int, count(DISTINCT venue_id)::int
    INTO v_checkins, v_venues
  FROM public.checkins
  WHERE user_id = p_user;

  -- Total hours = checkin durations + event hours (both sources, like
  -- get_profile_stats / PlayHistoryScreen).
  SELECT
    coalesce((
      SELECT sum(EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600.0)
      FROM public.checkins
      WHERE user_id = p_user
    ), 0)
    + coalesce((
      SELECT sum(hours_played)
      FROM public.event_participants
      WHERE user_id = p_user
    ), 0)
    INTO v_hours;

  -- Check-in thresholds (10 / 50 / 100).
  IF v_checkins >= 10 THEN
    INSERT INTO public.user_milestones (user_id, milestone_key)
    VALUES (p_user, 'checkin_10') ON CONFLICT (user_id, milestone_key) DO NOTHING;
  END IF;
  IF v_checkins >= 50 THEN
    INSERT INTO public.user_milestones (user_id, milestone_key)
    VALUES (p_user, 'checkin_50') ON CONFLICT (user_id, milestone_key) DO NOTHING;
  END IF;
  IF v_checkins >= 100 THEN
    INSERT INTO public.user_milestones (user_id, milestone_key)
    VALUES (p_user, 'checkin_100') ON CONFLICT (user_id, milestone_key) DO NOTHING;
  END IF;

  -- Distinct-venue thresholds (10 / 25).
  IF v_venues >= 10 THEN
    INSERT INTO public.user_milestones (user_id, milestone_key)
    VALUES (p_user, 'venues_10') ON CONFLICT (user_id, milestone_key) DO NOTHING;
  END IF;
  IF v_venues >= 25 THEN
    INSERT INTO public.user_milestones (user_id, milestone_key)
    VALUES (p_user, 'venues_25') ON CONFLICT (user_id, milestone_key) DO NOTHING;
  END IF;

  -- Hours thresholds (50 / 100 / 250).
  IF v_hours >= 50 THEN
    INSERT INTO public.user_milestones (user_id, milestone_key)
    VALUES (p_user, 'hours_50') ON CONFLICT (user_id, milestone_key) DO NOTHING;
  END IF;
  IF v_hours >= 100 THEN
    INSERT INTO public.user_milestones (user_id, milestone_key)
    VALUES (p_user, 'hours_100') ON CONFLICT (user_id, milestone_key) DO NOTHING;
  END IF;
  IF v_hours >= 250 THEN
    INSERT INTO public.user_milestones (user_id, milestone_key)
    VALUES (p_user, 'hours_250') ON CONFLICT (user_id, milestone_key) DO NOTHING;
  END IF;
END;
$$;

-- 3. Thin AFTER INSERT triggers (009 is frozen; these are NEW, separately-named
--    triggers, not edits to 009). ------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sync_milestones_checkin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sync_checkin_milestones(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS milestones_sync_on_checkin ON public.checkins;
CREATE TRIGGER milestones_sync_on_checkin
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_milestones_checkin();

CREATE OR REPLACE FUNCTION public.trg_sync_milestones_event_participant()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  -- Event hours feed the hours milestone, so recompute on a new participation.
  PERFORM public.sync_checkin_milestones(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS milestones_sync_on_event_participant ON public.event_participants;
CREATE TRIGGER milestones_sync_on_event_participant
  AFTER INSERT ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_milestones_event_participant();

-- first_review: a thin AFTER INSERT trigger on reviews awards the one-time
-- 'first_review' milestone (ON CONFLICT DO NOTHING means only the first counts).
-- reviews.user_id is nullable (anonymised reviews); guard against NULL.
CREATE OR REPLACE FUNCTION public.trg_sync_milestones_review()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_milestones (user_id, milestone_key)
    VALUES (NEW.user_id, 'first_review')
    ON CONFLICT (user_id, milestone_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS milestones_sync_on_review ON public.reviews;
CREATE TRIGGER milestones_sync_on_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_milestones_review();

-- 4. Anniversary (1 year): time-based, cannot be triggered by a row insert. A
--    daily idempotent cron awards 'anniversary_1y' to users whose account is
--    >= 1 year old. ON CONFLICT DO NOTHING keeps the daily re-run from
--    re-awarding. Account age uses auth.users.created_at (the authoritative
--    signup time; profiles.created_at mirrors it).
CREATE OR REPLACE FUNCTION public.award_anniversary_milestones()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_milestones (user_id, milestone_key)
  SELECT u.id, 'anniversary_1y'
  FROM auth.users u
  WHERE u.created_at <= now() - INTERVAL '1 year'
  ON CONFLICT (user_id, milestone_key) DO NOTHING;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'award_anniversary_milestones';
    -- 05:31 UTC daily — a fresh minute offset distinct from the existing daily
    -- jobs (47 3, 53 4) and weekly jobs (9 8 Mon, 0 9 Mon).
    PERFORM cron.schedule('award_anniversary_milestones', '31 5 * * *',
      $cron$SELECT public.award_anniversary_milestones()$cron$);
  ELSE
    RAISE NOTICE 'pg_cron unavailable — run award_anniversary_milestones() externally (daily).';
  END IF;
END $$;

-- 5. Extend get_profile_stats (reproduce the 126 6-column body verbatim +
--    append reviews_written + member_since). DROP first (return-type change).
DROP FUNCTION IF EXISTS public.get_profile_stats(uuid);
CREATE OR REPLACE FUNCTION public.get_profile_stats(p_user_id uuid)
RETURNS TABLE (
  total_checkins     int,
  unique_venues      int,
  events_joined      int,
  total_hours_played numeric,
  current_streak     int,
  best_streak        int,
  reviews_written    int,
  member_since       timestamptz,
  -- Combined play hours (check-in durations + event hours): this is the number
  -- the F053 hours milestones (hours_50/100/250) are awarded against, so the
  -- Profile "next milestone" ghost reads THIS, not the event-only
  -- total_hours_played (which is intentionally kept event-only for the existing
  -- "hours in events" surfaces).
  total_play_hours   numeric
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
    coalesce(us.best_streak, 0)        AS best_streak,
    coalesce(rv.reviews_written, 0)    AS reviews_written,
    pr.member_since                    AS member_since,
    coalesce(ep.total_hours_played, 0) + coalesce(ch.checkin_hours, 0) AS total_play_hours
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
    ) us ON true
    LEFT JOIN (
      SELECT count(*)::int AS reviews_written
      FROM public.reviews
      WHERE user_id = p_user_id
    ) rv ON true
    LEFT JOIN (
      SELECT created_at AS member_since
      FROM public.profiles
      WHERE id = p_user_id
    ) pr ON true
    LEFT JOIN (
      -- Check-in play hours (the term total_hours_played omits) — combined with
      -- event hours above for total_play_hours.
      SELECT coalesce(sum(extract(epoch FROM (ended_at - started_at)) / 3600.0), 0) AS checkin_hours
      FROM public.checkins
      WHERE user_id = p_user_id
    ) ch ON true;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_stats(uuid) TO authenticated, anon;

-- 6. Grants ------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.sync_checkin_milestones(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_sync_milestones_checkin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_sync_milestones_event_participant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_sync_milestones_review() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_anniversary_milestones() FROM PUBLIC;
-- (get_profile_stats grant is issued above.)

NOTIFY pgrst, 'reload schema';
