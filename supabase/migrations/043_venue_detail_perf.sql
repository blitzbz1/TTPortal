-- Indexes + RPC to speed up the venue-detail screen.
--
-- Audit of the screen's queries against the existing index set found three
-- gaps and one query that ships ~30 days of checkins to the client just to
-- compute a single "champion" name. This migration covers all of them.

-- 1. checkins(venue_id, started_at DESC)
--    Drives:
--      - getVenueChampion (filters by venue_id, sorts by started_at, ranges
--        the last 30d).
--      - getActiveCheckins (venue page, filters by venue_id, sorts by
--        started_at, evaluates the active window on ended_at/started_at).
--    The existing idx_checkins_venue_ended is on (venue_id, ended_at) which
--    is the wrong sort column for these access paths.
CREATE INDEX IF NOT EXISTS idx_checkins_venue_started
  ON public.checkins(venue_id, started_at DESC);

-- 2. events(venue_id, starts_at)
--    Drives getUpcomingEventsByVenue. Existing idx_events_status_starts
--    leads on `status`, so a venue-scoped query has to scan every active
--    event in the system. This one lets the planner walk the venue's
--    events in starts_at order and stop at LIMIT 50.
CREATE INDEX IF NOT EXISTS idx_events_venue_starts
  ON public.events(venue_id, starts_at);

-- 3. checkins(user_id, venue_id, started_at DESC)
--    Drives getUserActiveCheckin — a point-lookup with a sort.
--    idx_checkins_user_started covers (user_id, started_at DESC) but the
--    venue_id filter still has to be evaluated against every fetched row.
--    Adding venue_id as the second column turns this into a single index
--    seek + LIMIT 1.
CREATE INDEX IF NOT EXISTS idx_checkins_user_venue_started
  ON public.checkins(user_id, venue_id, started_at DESC);

-- 4. RPC: get_venue_champion(venue_id, days_back)
--    Replaces the client-side aggregation in getVenueChampion(). The
--    original function pulls every checkin row for the venue from the last
--    30 days, then dedupes (user_id, day) and counts in JS. For a busy
--    venue this can be hundreds-thousands of rows shipped just to derive
--    one name. Doing the aggregation in SQL returns one row.
CREATE OR REPLACE FUNCTION public.get_venue_champion(
  p_venue_id INTEGER,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  day_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_user_days AS (
    SELECT
      c.user_id,
      COUNT(DISTINCT date_trunc('day', c.started_at)) AS days
    FROM public.checkins c
    WHERE c.venue_id = p_venue_id
      AND c.started_at >= now() - (p_days_back || ' days')::interval
    GROUP BY c.user_id
    HAVING COUNT(DISTINCT date_trunc('day', c.started_at)) >= 2
  )
  SELECT
    p.id AS user_id,
    p.full_name,
    d.days AS day_count
  FROM per_user_days d
  JOIN public.profiles p ON p.id = d.user_id
  ORDER BY d.days DESC, p.full_name ASC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_venue_champion(INTEGER, INTEGER) TO authenticated, anon;
