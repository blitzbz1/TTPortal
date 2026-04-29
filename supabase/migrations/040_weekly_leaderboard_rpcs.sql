-- Server-side weekly leaderboard aggregation. Replaces the client-side
-- "fetch everything since `since` and group/sort in JS" fallback path in
-- src/services/leaderboard.ts. Each RPC returns top-20 rows ranked by
-- the relevant metric for the week ending now().
--
-- The functions are SECURITY INVOKER (default) so RLS still applies.

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

CREATE OR REPLACE FUNCTION public.weekly_leaderboard_reviews(since TIMESTAMPTZ)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  total_reviews BIGINT,
  rank INT,
  score BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.user_id,
    COALESCE(p.full_name, '') AS full_name,
    COUNT(*) AS total_reviews,
    (ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC))::INT AS rank,
    COUNT(*) AS score
  FROM public.reviews r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.created_at >= since
  GROUP BY r.user_id, p.full_name
  ORDER BY total_reviews DESC
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

GRANT EXECUTE ON FUNCTION public.weekly_leaderboard_checkins(TIMESTAMPTZ) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.weekly_leaderboard_reviews(TIMESTAMPTZ) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.weekly_leaderboard_venues(TIMESTAMPTZ) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
