-- Migration: 020_fix_reviews_leaderboard
-- The leaderboard_reviews materialized view was joining reviews_old (a renamed table)
-- instead of the current reviews table. Recreate it with the correct reference.

DROP MATERIALIZED VIEW IF EXISTS public.leaderboard_reviews;

CREATE MATERIALIZED VIEW public.leaderboard_reviews AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.city,
  COUNT(r.id)::INT AS total_reviews,
  COALESCE(AVG(r.rating), 0)::NUMERIC(2,1) AS avg_given_rating,
  RANK() OVER (ORDER BY COUNT(r.id) DESC)::INT AS rank
FROM public.profiles p
INNER JOIN public.reviews r ON r.user_id = p.id
GROUP BY p.id, p.full_name, p.avatar_url, p.city
HAVING COUNT(r.id) > 0
ORDER BY total_reviews DESC;

CREATE UNIQUE INDEX idx_lb_reviews_user ON public.leaderboard_reviews(user_id);
