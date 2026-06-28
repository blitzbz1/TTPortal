-- Migration: 139_friend_scoped_checkin_moments
-- Tighten venue moments visibility to the author and accepted friends only.
-- This keeps the venue strip social/private instead of venue-wide public UGC,
-- while preserving deleted/flagged/block filtering from migration 125.

CREATE OR REPLACE FUNCTION public.get_venue_moments(p_venue_id integer, p_limit integer DEFAULT 12)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH viewer AS (
    SELECT auth.uid() AS uid
  ),
  my_friends AS (
    SELECT CASE
      WHEN f.requester_id = (SELECT uid FROM viewer) THEN f.addressee_id
      ELSE f.requester_id
    END AS friend_id
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (SELECT uid FROM viewer) IN (f.requester_id, f.addressee_id)
  ),
  blocked AS (
    SELECT blocked_id FROM public.user_blocks WHERE blocker_id = (SELECT uid FROM viewer)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'user_id', m.user_id,
    'venue_id', m.venue_id,
    'photo_url', m.photo_url,
    'caption', m.caption,
    'created_at', m.created_at,
    'author_name', pr.full_name,
    'author_avatar', pr.avatar_url,
    'author_username', pr.username
  ) ORDER BY m.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT cm.*
    FROM public.checkin_moments cm
    WHERE cm.venue_id = p_venue_id
      AND cm.deleted_at IS NULL
      AND NOT cm.flagged
      AND (cm.user_id = (SELECT uid FROM viewer) OR cm.user_id IN (SELECT friend_id FROM my_friends))
      AND cm.user_id NOT IN (SELECT blocked_id FROM blocked)
    ORDER BY cm.created_at DESC
    LIMIT GREATEST(COALESCE(p_limit, 12), 1)
  ) m
  JOIN public.profiles pr ON pr.id = m.user_id;
$$;

COMMENT ON FUNCTION public.get_venue_moments(integer, integer) IS
  'Recent non-deleted venue moments visible to the author and accepted friends, block-filtered for the caller.';

REVOKE ALL ON FUNCTION public.get_venue_moments(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_venue_moments(integer, integer) TO authenticated;
