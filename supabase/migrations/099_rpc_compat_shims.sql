-- Migration: 099_rpc_compat_shims
-- Backward-compatibility wrappers for the RPC signatures 083 dropped.
--
-- Why: the currently shipped alpha builds call the OLD signatures
-- (get_venue_detail(p_venue_id, p_user_id, p_review_limit) etc.). Without
-- these shims, pushing 083 bricks venue detail / friend feed /
-- friends-at-venue for every existing install until users update.
--
-- Security: the wrappers preserve 083's fix — the caller-supplied
-- p_user_id / p_friend_ids are ACCEPTED but IGNORED; identity always
-- comes from auth.uid() via the new implementations. A malicious caller
-- passing someone else's id gets their own data, exactly like the new
-- signatures.
--
-- Removal: drop these in a future migration once the pre-097 client
-- builds are retired (check Loki appVersion telemetry before dropping).

-- get_venue_detail(p_venue_id, p_user_id, p_review_limit) → jsonb
CREATE OR REPLACE FUNCTION public.get_venue_detail(
  p_venue_id INTEGER,
  p_user_id UUID,
  p_review_limit INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  -- p_user_id intentionally unused (083): personalization is self-only.
  SELECT public.get_venue_detail(p_venue_id, p_review_limit);
$$;
REVOKE ALL ON FUNCTION public.get_venue_detail(INTEGER, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_detail(INTEGER, UUID, INTEGER) TO anon, authenticated;

-- get_friends_at_venue(p_venue_id, p_user_id) → table
CREATE OR REPLACE FUNCTION public.get_friends_at_venue(
  p_venue_id INTEGER,
  p_user_id UUID
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  source TEXT,
  event_title TEXT
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  -- p_user_id intentionally unused (083): friendships derive from auth.uid().
  SELECT * FROM public.get_friends_at_venue(p_venue_id);
$$;
REVOKE ALL ON FUNCTION public.get_friends_at_venue(INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friends_at_venue(INTEGER, UUID) TO authenticated;

-- get_friend_feed(p_friend_ids, p_limit) → table
CREATE OR REPLACE FUNCTION public.get_friend_feed(
  p_friend_ids UUID[],
  p_limit INTEGER DEFAULT 30
)
RETURNS TABLE (
  kind TEXT,
  id BIGINT,
  user_id UUID,
  user_name TEXT,
  venue_id INT,
  venue_name TEXT,
  venue_city TEXT,
  rating INT,
  ts TIMESTAMPTZ
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  -- p_friend_ids intentionally unused (083): the feed is the caller's own.
  SELECT * FROM public.get_friend_feed(p_limit);
$$;
REVOKE ALL ON FUNCTION public.get_friend_feed(UUID[], INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friend_feed(UUID[], INTEGER) TO authenticated;
