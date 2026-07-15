-- Migration: 018_refresh_leaderboard_views
-- Refreshes all materialized leaderboard views so they pick up current
-- profile names, and adds a trigger to auto-refresh when a profile is updated.

-- ============================================================
-- 1. Immediate refresh to fix stale data
-- ============================================================
REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_checkins;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_reviews;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_venues;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.venue_stats;

-- ============================================================
-- 2. Trigger: auto-refresh leaderboards when a profile changes
--    (e.g. user updates their name)
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_leaderboards_on_profile_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.refresh_stats();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_updated_refresh_lb ON public.profiles;
CREATE TRIGGER on_profile_updated_refresh_lb
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.refresh_leaderboards_on_profile_change();
