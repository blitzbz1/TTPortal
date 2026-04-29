-- Migration: 005_functions_views
-- Materialized views for aggregated data (venue stats, leaderboards).
-- These are refreshed via triggers or periodic cron, not recomputed on every query.

-- ============================================================
-- Venue stats (materialized)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.venue_stats AS
SELECT
  v.id AS venue_id,
  COALESCE(AVG(r.rating), 0)::NUMERIC(2,1) AS avg_rating,
  COUNT(DISTINCT r.id)::INT AS review_count,
  COUNT(DISTINCT c.id)::INT AS checkin_count,
  COUNT(DISTINCT f.id)::INT AS favorite_count
FROM public.venues v
LEFT JOIN public.reviews r ON r.venue_id = v.id
LEFT JOIN public.checkins c ON c.venue_id = v.id
LEFT JOIN public.favorites f ON f.venue_id = v.id
GROUP BY v.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_stats_venue ON public.venue_stats(venue_id);

-- ============================================================
-- Leaderboard: check-ins (materialized)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.leaderboard_checkins AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.city,
  COUNT(c.id)::INT AS total_checkins,
  COUNT(DISTINCT c.venue_id)::INT AS unique_venues,
  RANK() OVER (ORDER BY COUNT(c.id) DESC)::INT AS rank
FROM public.profiles p
LEFT JOIN public.checkins c ON c.user_id = p.id
GROUP BY p.id, p.full_name, p.avatar_url, p.city
HAVING COUNT(c.id) > 0
ORDER BY total_checkins DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lb_checkins_user ON public.leaderboard_checkins(user_id);

-- ============================================================
-- Leaderboard: reviews (materialized)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.leaderboard_reviews AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.city,
  COUNT(r.id)::INT AS total_reviews,
  COALESCE(AVG(r.rating), 0)::NUMERIC(2,1) AS avg_given_rating,
  RANK() OVER (ORDER BY COUNT(r.id) DESC)::INT AS rank
FROM public.profiles p
LEFT JOIN public.reviews r ON r.user_id = p.id
GROUP BY p.id, p.full_name, p.avatar_url, p.city
HAVING COUNT(r.id) > 0
ORDER BY total_reviews DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lb_reviews_user ON public.leaderboard_reviews(user_id);

-- ============================================================
-- Leaderboard: venues added (materialized)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.leaderboard_venues AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.city,
  COUNT(v.id)::INT AS venues_added,
  RANK() OVER (ORDER BY COUNT(v.id) DESC)::INT AS rank
FROM public.profiles p
LEFT JOIN public.venues v ON v.submitted_by = p.id AND v.approved = true
GROUP BY p.id, p.full_name, p.avatar_url, p.city
HAVING COUNT(v.id) > 0
ORDER BY venues_added DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lb_venues_user ON public.leaderboard_venues(user_id);

-- ============================================================
-- Helper function to refresh all materialized views
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_stats() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.venue_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_checkins;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_reviews;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_venues;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Performance indexes for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_checkins_user_ended ON public.checkins(user_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_checkins_venue_ended ON public.checkins(venue_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status ON public.friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON public.event_participants(user_id);
