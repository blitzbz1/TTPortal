-- Migration: 019_fix_venues_leaderboard
-- The leaderboard_venues view was empty because all venues have submitted_by = NULL
-- (venues were imported/seeded, not user-submitted).
-- Redefine it to rank users by unique venues visited (via check-ins), which is
-- what the "Locatii" tab actually represents in the UI.
-- Also re-refresh all views to pick up the latest data.

-- ============================================================
-- 1. Recreate leaderboard_venues as unique-venues-visited
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS public.leaderboard_venues;

CREATE MATERIALIZED VIEW public.leaderboard_venues AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.city,
  COUNT(DISTINCT c.venue_id)::INT AS unique_venues,
  RANK() OVER (ORDER BY COUNT(DISTINCT c.venue_id) DESC)::INT AS rank
FROM public.profiles p
INNER JOIN public.checkins c ON c.user_id = p.id
GROUP BY p.id, p.full_name, p.avatar_url, p.city
HAVING COUNT(DISTINCT c.venue_id) > 0
ORDER BY unique_venues DESC;

CREATE UNIQUE INDEX idx_lb_venues_user ON public.leaderboard_venues(user_id);

-- ============================================================
-- 2. Refresh all views to pick up latest data
-- ============================================================
REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_checkins;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_reviews;
REFRESH MATERIALIZED VIEW public.venue_stats;
