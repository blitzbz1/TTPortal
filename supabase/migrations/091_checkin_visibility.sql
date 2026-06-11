-- Migration: 091_checkin_visibility
-- User-facing privacy control for check-in visibility (§9.5).
--
-- profiles.checkin_visibility: 'friends' (default — current behavior under
-- the 084 RLS scope) | 'private' (self-only rows). 'public' can join later
-- with the Open Play feature. The preference is folded into:
--   - the 084 checkins SELECT policy (friends branch now requires the
--     owner's visibility to be 'friends'),
--   - get_friend_feed (083) — a private user's check-ins drop out of
--     friends' feeds (their reviews stay: reviews are public content),
--   - get_friends_at_venue (083) — a private user never appears in
--     "friends here now".
-- Anonymous per-venue counts (get_venue_active_checkin_count, 084) stay
-- identity-free and keep counting everyone.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checkin_visibility text NOT NULL DEFAULT 'friends'
  CHECK (checkin_visibility IN ('friends', 'private'));

COMMENT ON COLUMN public.profiles.checkin_visibility IS
  'Who can see this user''s check-ins: friends (default) or private (self-only). Counts remain anonymous either way.';

-- 085 switched profiles to a column-list SELECT grant; new columns need an
-- explicit grant. The preference itself is not sensitive (it reveals no
-- check-in data) and friend surfaces may want to explain why a friend is
-- hidden.
GRANT SELECT (checkin_visibility) ON public.profiles TO authenticated;

-- ----------------------------------------------------------------------
-- RLS: fold the preference into the 084 policy
-- ----------------------------------------------------------------------

DROP POLICY IF EXISTS "Checkins readable by self and friends" ON public.checkins;

CREATE POLICY "Checkins readable by self and friends" ON public.checkins
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = checkins.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = checkins.user_id))
      )
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = checkins.user_id
          AND p.checkin_visibility = 'friends'
      )
    )
  );

-- ----------------------------------------------------------------------
-- get_friend_feed: private users' check-ins drop out (reviews stay)
-- ----------------------------------------------------------------------

create or replace function public.get_friend_feed(
  p_limit int default 30
)
returns table (
  kind         text,
  id           bigint,
  user_id      uuid,
  user_name    text,
  venue_id     int,
  venue_name   text,
  venue_city   text,
  rating       int,
  ts           timestamptz
)
language sql stable
security definer
set search_path = public, pg_temp
as $$
  with my_friends as (
    select
      case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as friend_id
    from public.friendships f
    where f.status = 'accepted'
      and auth.uid() in (f.requester_id, f.addressee_id)
  ),
  feed as (
    select
      'checkin'::text                as kind,
      c.id::bigint                   as id,
      c.user_id                      as user_id,
      coalesce(p.full_name, '?')     as user_name,
      c.venue_id                     as venue_id,
      coalesce(v.name, '?')          as venue_name,
      coalesce(v.city, '')           as venue_city,
      null::int                      as rating,
      c.started_at                   as ts
    from public.checkins c
    join my_friends mf on mf.friend_id = c.user_id
    join public.profiles p on p.id = c.user_id
    left join public.venues v on v.id = c.venue_id
    where p.checkin_visibility = 'friends'

    union all

    select
      'review'::text                 as kind,
      r.id::bigint                   as id,
      r.user_id                      as user_id,
      coalesce(r.reviewer_name, '?') as user_name,
      r.venue_id                     as venue_id,
      coalesce(v.name, '?')          as venue_name,
      ''::text                       as venue_city,
      r.rating                       as rating,
      r.created_at                   as ts
    from public.reviews r
    join my_friends mf on mf.friend_id = r.user_id
    left join public.venues v on v.id = r.venue_id
  )
  select * from feed
  order by ts desc
  limit greatest(coalesce(p_limit, 30), 1);
$$;

-- ----------------------------------------------------------------------
-- get_friends_at_venue: private users never appear
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_friends_at_venue(
  p_venue_id INTEGER
)
RETURNS TABLE (
  user_id     UUID,
  full_name   TEXT,
  avatar_url  TEXT,
  source      TEXT,    -- 'checkin' | 'event'
  event_title TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH my_friends AS (
    SELECT
      CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS friend_id
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND auth.uid() IN (f.requester_id, f.addressee_id)
  ),
  visible_friends AS (
    SELECT mf.friend_id
    FROM my_friends mf
    JOIN public.profiles p ON p.id = mf.friend_id
    WHERE p.checkin_visibility = 'friends'
  ),
  friend_checkins AS (
    SELECT DISTINCT ON (c.user_id)
      c.user_id,
      'checkin'::TEXT AS source,
      NULL::TEXT      AS event_title
    FROM public.checkins c
    JOIN visible_friends mf ON mf.friend_id = c.user_id
    WHERE c.venue_id = p_venue_id
      AND (c.ended_at > now()
           OR (c.ended_at IS NULL AND c.started_at >= date_trunc('day', now())))
    ORDER BY c.user_id, c.started_at DESC
  ),
  friend_events AS (
    SELECT DISTINCT ON (ep.user_id)
      ep.user_id,
      'event'::TEXT AS source,
      e.title       AS event_title
    FROM public.events e
    JOIN public.event_participants ep ON ep.event_id = e.id
    JOIN visible_friends mf ON mf.friend_id = ep.user_id
    WHERE e.venue_id = p_venue_id
      AND e.status NOT IN ('cancelled', 'completed')
      AND e.starts_at <= now()
      AND (e.ends_at >= now()
           OR (e.ends_at IS NULL AND e.starts_at >= now() - INTERVAL '4 hours'))
      AND NOT EXISTS (
        SELECT 1 FROM friend_checkins fc WHERE fc.user_id = ep.user_id
      )
    ORDER BY ep.user_id
  ),
  merged AS (
    SELECT * FROM friend_checkins
    UNION ALL
    SELECT * FROM friend_events
  )
  SELECT
    m.user_id,
    p.full_name,
    p.avatar_url,
    m.source,
    m.event_title
  FROM merged m
  JOIN public.profiles p ON p.id = m.user_id;
$$;

NOTIFY pgrst, 'reload schema';
