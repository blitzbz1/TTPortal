-- Migration: 134_coach_profiles (F063)
-- Coach directory. A coach is an APPROVAL LIFECYCLE with a public-facing card —
-- modelled as a coach_profiles.status enum table (pending/approved/rejected),
-- NOT a badge_awards row (badge_awards is SELECT-own-only, keyed on a fixed
-- challenge_category enum + tier, and has no lifecycle / public read — see
-- migration 127's header for the "dedicated table, not badge_awards" precedent).
--
-- Design notes
-- ============
-- - coach_profiles mirrors the venues.approved status-lifecycle RLS (004): a
--   public read gated on status='approved', an owner read of their own row (so
--   an applicant sees their pending/rejected application), an admin read-all,
--   and an admin-only UPDATE for the approve/reject transition. There is NO
--   owner-insert policy — applications go exclusively through the SECURITY
--   DEFINER apply_to_coach RPC, so status can never be self-set to 'approved'.
-- - coach_venues (up to 3 venues per coach) is public-readable when the parent
--   coach is approved (or the row's owner / an admin); the ≤3 cap is enforced
--   in apply_to_coach.
-- - Approve/reject is a plain admin-gated UPDATE from the client (admin.ts),
--   exactly like approveVenue/rejectVenue — the admin-UPDATE RLS policy is the
--   real enforcement (sets status + reviewed_by + reviewed_at). No separate
--   approve/reject RPC is required.
-- - get_venue_coaches is a SEPARATE lazy read RPC (kept OUT of get_venue_detail's
--   critical path), rendered like VenueMomentsStrip / VenueBoardSection from a
--   lazy client query. get_coaching_venue_ids backs the map "Coaching" filter.
-- - F063 adds NO notification type and NO content_reports type.
-- - get_profile_stats currently has the 9-column shape from 129 (milestones). We
--   reproduce that body verbatim and append is_coach. Adding a column changes the
--   RETURNS TABLE shape, so CREATE OR REPLACE alone errors ("cannot change return
--   type of existing function"); the single (uuid) overload is dropped first.

-- 1. coach_profiles: one application per user, status lifecycle -----------------
CREATE TABLE IF NOT EXISTS public.coach_profiles (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL UNIQUE DEFAULT auth.uid()
                 REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  bio          text CHECK (bio IS NULL OR char_length(bio) <= 1000),
  experience   text,
  levels       text[] NOT NULL DEFAULT '{}',
  languages    text[] NOT NULL DEFAULT '{}',
  price_range  text,
  contact      text,
  reviewed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_profiles_status
  ON public.coach_profiles (status);

ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

-- (a) Public read when approved (mirrors venues.approved, 004).
DROP POLICY IF EXISTS "Approved coaches are publicly readable" ON public.coach_profiles;
CREATE POLICY "Approved coaches are publicly readable" ON public.coach_profiles
  FOR SELECT USING (status = 'approved');

-- (b) Owner reads their own row (so an applicant sees their pending/rejected app).
DROP POLICY IF EXISTS "Coaches read own application" ON public.coach_profiles;
CREATE POLICY "Coaches read own application" ON public.coach_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- (c) Admins read all (incl. pending) for the moderation queue.
DROP POLICY IF EXISTS "Admins can view all coach applications" ON public.coach_profiles;
CREATE POLICY "Admins can view all coach applications" ON public.coach_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- (d) Admin-only UPDATE: the approve/reject transition (sets status +
--     reviewed_by + reviewed_at). No owner-insert/update — applications go
--     through apply_to_coach (DEFINER) so status can't be self-promoted.
DROP POLICY IF EXISTS "Admins can update coach applications" ON public.coach_profiles;
CREATE POLICY "Admins can update coach applications" ON public.coach_profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- SELECT for the public/owner/admin read policies; UPDATE gated by the admin
-- policy above. INSERT is intentionally NOT granted (DEFINER apply_to_coach).
GRANT SELECT, UPDATE ON public.coach_profiles TO authenticated;
GRANT SELECT ON public.coach_profiles TO anon;

-- 2. coach_venues: the venues a coach teaches at (≤3, enforced in apply_to_coach)
CREATE TABLE IF NOT EXISTS public.coach_venues (
  coach_id bigint NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  venue_id int    NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  PRIMARY KEY (coach_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_venues_venue ON public.coach_venues (venue_id);

ALTER TABLE public.coach_venues ENABLE ROW LEVEL SECURITY;

-- Public read where the parent coach is approved (or the viewer is the owner /
-- an admin) — mirrors the coach_profiles read policies through the FK.
DROP POLICY IF EXISTS "Coach venues follow coach visibility" ON public.coach_venues;
CREATE POLICY "Coach venues follow coach visibility" ON public.coach_venues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.coach_profiles cp
      WHERE cp.id = coach_venues.coach_id
        AND (
          cp.status = 'approved'
          OR cp.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );

GRANT SELECT ON public.coach_venues TO authenticated, anon;

-- 3. apply_to_coach: submit (or re-submit) a coach application -----------------
-- UPSERTs the caller's coach_profile to status='pending' and replaces the
-- coach_venues set (≤3). Re-applying resets to pending and clears the prior
-- review. DEFINER so it owns status (the client can never set 'approved'); an
-- auth guard pins it to the caller. Returns the coach_profile id.
CREATE OR REPLACE FUNCTION public.apply_to_coach(
  p_bio         text,
  p_experience  text,
  p_levels      text[],
  p_languages   text[],
  p_price_range text,
  p_contact     text,
  p_venue_ids   int[]
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_coach bigint;
  v_vid   int;
  v_count int := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.coach_profiles
    (user_id, status, bio, experience, levels, languages, price_range, contact,
     reviewed_by, reviewed_at, updated_at)
  VALUES
    (v_user, 'pending', p_bio, p_experience,
     coalesce(p_levels, '{}'), coalesce(p_languages, '{}'),
     p_price_range, p_contact, NULL, NULL, now())
  ON CONFLICT (user_id) DO UPDATE SET
    status      = 'pending',
    bio         = excluded.bio,
    experience  = excluded.experience,
    levels      = excluded.levels,
    languages   = excluded.languages,
    price_range = excluded.price_range,
    contact     = excluded.contact,
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at  = now()
  RETURNING id INTO v_coach;

  -- Replace the venue set (DELETE existing, INSERT up to 3 distinct valid ids).
  DELETE FROM public.coach_venues WHERE coach_id = v_coach;
  IF p_venue_ids IS NOT NULL THEN
    FOR v_vid IN
      SELECT DISTINCT vid
      FROM unnest(p_venue_ids) AS vid
      WHERE vid IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.venues v WHERE v.id = vid)
    LOOP
      EXIT WHEN v_count >= 3;
      INSERT INTO public.coach_venues (coach_id, venue_id)
      VALUES (v_coach, v_vid)
      ON CONFLICT (coach_id, venue_id) DO NOTHING;
      v_count := v_count + 1;
    END LOOP;
  END IF;

  RETURN v_coach;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_to_coach(text, text, text[], text[], text, text, int[]) TO authenticated;

-- 4. get_venue_coaches: approved coaches teaching at a venue (lazy read) --------
-- Returns one row per approved coach linked to the venue, with the coach's
-- name/avatar from profiles. SECURITY DEFINER STABLE so it can read across the
-- coach_profiles/coach_venues join regardless of the caller; only APPROVED
-- coaches are exposed (the WHERE pins status='approved').
CREATE OR REPLACE FUNCTION public.get_venue_coaches(p_venue_id int)
RETURNS TABLE (
  coach_id   bigint,
  user_id    uuid,
  full_name  text,
  avatar_url text
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    cp.id        AS coach_id,
    cp.user_id   AS user_id,
    pr.full_name AS full_name,
    pr.avatar_url AS avatar_url
  FROM public.coach_venues cv
  JOIN public.coach_profiles cp ON cp.id = cv.coach_id AND cp.status = 'approved'
  JOIN public.profiles pr       ON pr.id = cp.user_id
  WHERE cv.venue_id = p_venue_id
  ORDER BY pr.full_name NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_venue_coaches(int) TO authenticated, anon;

-- 5. get_coaching_venue_ids: venue ids in a city that have ≥1 approved coach ----
-- Backs the map "Coaching" filter chip (like the cityAmenities overlay).
CREATE OR REPLACE FUNCTION public.get_coaching_venue_ids(p_city text)
RETURNS TABLE (venue_id int)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT cv.venue_id
  FROM public.coach_venues cv
  JOIN public.coach_profiles cp ON cp.id = cv.coach_id AND cp.status = 'approved'
  JOIN public.venues v          ON v.id = cv.venue_id
  WHERE p_city IS NULL OR v.city = p_city;
$$;

GRANT EXECUTE ON FUNCTION public.get_coaching_venue_ids(text) TO authenticated, anon;

-- 6. Extend get_profile_stats (reproduce the 129 9-column body verbatim +
--    append is_coach). DROP first (return-type change). ------------------------
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
  total_play_hours   numeric,
  -- F063: true when the user has an APPROVED coach_profile (drives the Coach
  -- chip on the profile). Public-read-when-approved, so this is non-sensitive.
  is_coach           boolean
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
    coalesce(ep.total_hours_played, 0) + coalesce(ch.checkin_hours, 0) AS total_play_hours,
    EXISTS (
      SELECT 1 FROM public.coach_profiles cp
      WHERE cp.user_id = p_user_id AND cp.status = 'approved'
    ) AS is_coach
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

-- 7. Grants ------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.apply_to_coach(text, text, text[], text[], text, text, int[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_venue_coaches(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_coaching_venue_ids(text) FROM PUBLIC;
-- (apply_to_coach / get_venue_coaches / get_coaching_venue_ids / get_profile_stats
--  EXECUTE grants are issued above.)

NOTIFY pgrst, 'reload schema';
