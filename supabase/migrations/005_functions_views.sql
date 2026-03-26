-- Migration: 005_functions_views
-- Create views for aggregated data (venue stats, leaderboards).

-- Venue stats: avg rating, review count, checkin count
CREATE OR REPLACE VIEW public.venue_stats AS
SELECT
  v.id AS venue_id,
  COALESCE(AVG(r.rating), 0)::NUMERIC(2,1) AS avg_rating,
  COUNT(DISTINCT r.id) AS review_count,
  COUNT(DISTINCT c.id) AS checkin_count,
  COUNT(DISTINCT f.id) AS favorite_count
FROM public.venues v
LEFT JOIN public.reviews r ON r.venue_id = v.id
LEFT JOIN public.checkins c ON c.venue_id = v.id
LEFT JOIN public.favorites f ON f.venue_id = v.id
GROUP BY v.id;

-- Leaderboard: check-ins
CREATE OR REPLACE VIEW public.leaderboard_checkins AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.city,
  COUNT(c.id) AS total_checkins,
  COUNT(DISTINCT c.venue_id) AS unique_venues,
  RANK() OVER (ORDER BY COUNT(c.id) DESC) AS rank
FROM public.profiles p
LEFT JOIN public.checkins c ON c.user_id = p.id
GROUP BY p.id, p.full_name, p.avatar_url, p.city
HAVING COUNT(c.id) > 0
ORDER BY total_checkins DESC;

-- Leaderboard: reviews
CREATE OR REPLACE VIEW public.leaderboard_reviews AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.city,
  COUNT(r.id) AS total_reviews,
  COALESCE(AVG(r.rating), 0)::NUMERIC(2,1) AS avg_given_rating,
  RANK() OVER (ORDER BY COUNT(r.id) DESC) AS rank
FROM public.profiles p
LEFT JOIN public.reviews r ON r.user_id = p.id
GROUP BY p.id, p.full_name, p.avatar_url, p.city
HAVING COUNT(r.id) > 0
ORDER BY total_reviews DESC;

-- Leaderboard: venues added
CREATE OR REPLACE VIEW public.leaderboard_venues AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.city,
  COUNT(v.id) AS venues_added,
  RANK() OVER (ORDER BY COUNT(v.id) DESC) AS rank
FROM public.profiles p
LEFT JOIN public.venues v ON v.submitted_by = p.id AND v.approved = true
GROUP BY p.id, p.full_name, p.avatar_url, p.city
HAVING COUNT(v.id) > 0
ORDER BY venues_added DESC;
