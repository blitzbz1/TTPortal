-- Refresh venue_stats and leaderboard_reviews whenever reviews change,
-- so a new review is immediately reflected in the venue detail rating.
-- Mirrors the pattern established in 018 for profile full_name updates.

CREATE OR REPLACE FUNCTION public.refresh_stats_on_review_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.refresh_stats();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_change_refresh_stats ON public.reviews;
CREATE TRIGGER on_review_change_refresh_stats
  AFTER INSERT OR UPDATE OF rating OR DELETE ON public.reviews
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.refresh_stats_on_review_change();

-- One-time catch-up for any reviews already written before this trigger existed.
REFRESH MATERIALIZED VIEW CONCURRENTLY public.venue_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_reviews;
