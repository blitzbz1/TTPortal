-- Migration: 084_checkins_rls_scope
-- Stop leaking every user's live location to any authenticated account.
--
-- 004's policy 'Active checkins are readable' USING (ended_at > now()) let
-- ANY logged-in user enumerate the live location of every checked-in user.
-- Replace it with self + accepted friends; anonymous surfaces get a
-- count-only RPC.
--
-- Side effects handled here:
-- - weekly_leaderboard_checkins / weekly_leaderboard_venues (040) were
--   deliberately SECURITY INVOKER ("so RLS still applies"). Under the new
--   policy they would silently shrink to self+friends. They expose only
--   per-user aggregate counts (no locations), so they are recreated as
--   SECURITY DEFINER to stay global — consistent with the matview
--   leaderboards, which already bypass RLS via ownership.
-- - get_venue_detail / get_friend_feed / get_friends_at_venue /
--   get_venue_champion / get_profile_stats are SECURITY DEFINER already.
-- - The venue_stats / leaderboard matviews refresh as the table owner and
--   are unaffected.

-- ----------------------------------------------------------------------
-- RLS: self + accepted friends
-- ----------------------------------------------------------------------

DROP POLICY IF EXISTS "Active checkins are readable" ON public.checkins;
DROP POLICY IF EXISTS "Checkins readable by self and friends" ON public.checkins;

CREATE POLICY "Checkins readable by self and friends" ON public.checkins
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = checkins.user_id)
          OR (f.addressee_id = auth.uid() AND f.requester_id = checkins.user_id))
    )
  );

-- 004's own-row SELECT policy stays (harmless overlap, and it documents the
-- self case independently of the friendship subquery).

-- ----------------------------------------------------------------------
-- Anonymous "who's here now" surface: count only
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_venue_active_checkin_count(p_venue_id integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int
  FROM public.checkins c
  WHERE c.venue_id = p_venue_id
    AND (c.ended_at > now()
         OR (c.ended_at IS NULL AND c.started_at >= date_trunc('day', now())));
$$;

COMMENT ON FUNCTION public.get_venue_active_checkin_count(integer) IS
  'Anonymous-safe count of active check-ins at a venue (no identities). '
  'Backs "who''s here now" badges and the future busyness feature.';

REVOKE ALL ON FUNCTION public.get_venue_active_checkin_count(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_active_checkin_count(integer)
  TO authenticated, anon;

-- ----------------------------------------------------------------------
-- Keep the weekly leaderboards global (count-only aggregates)
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.weekly_leaderboard_checkins(since TIMESTAMPTZ)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  total_checkins BIGINT,
  rank INT,
  score BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.user_id,
    COALESCE(p.full_name, '') AS full_name,
    COUNT(*) AS total_checkins,
    (ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC))::INT AS rank,
    COUNT(*) AS score
  FROM public.checkins c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.started_at >= since
  GROUP BY c.user_id, p.full_name
  ORDER BY total_checkins DESC
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.weekly_leaderboard_venues(since TIMESTAMPTZ)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  unique_venues BIGINT,
  rank INT,
  score BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.user_id,
    COALESCE(p.full_name, '') AS full_name,
    COUNT(DISTINCT c.venue_id) AS unique_venues,
    (ROW_NUMBER() OVER (ORDER BY COUNT(DISTINCT c.venue_id) DESC))::INT AS rank,
    COUNT(DISTINCT c.venue_id) AS score
  FROM public.checkins c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.started_at >= since
  GROUP BY c.user_id, p.full_name
  ORDER BY unique_venues DESC
  LIMIT 20;
$$;

NOTIFY pgrst, 'reload schema';
