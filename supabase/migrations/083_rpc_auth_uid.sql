-- Migration: 083_rpc_auth_uid
-- Derive the acting identity from auth.uid() in the three SECURITY DEFINER
-- RPCs that trusted client-supplied user IDs:
--
-- - get_friend_feed(p_friend_ids uuid[])  → returned the full historical
--   check-in/review stream for ANY array of user IDs, with no friendship
--   verification. Now computes the caller's accepted friendships itself;
--   the p_friend_ids parameter is dropped (signature change).
-- - get_venue_detail(p_venue_id, p_user_id) → leaked is_favorited /
--   user_active_checkin for an arbitrary user, granted to anon. The
--   p_user_id parameter is dropped; personalization is self-only (anon
--   gets false/NULL). Still granted to anon for the public venue bundle.
-- - get_friends_at_venue(p_venue_id, p_user_id) → enumerated an arbitrary
--   user's friends at a venue, granted to anon. The p_user_id parameter is
--   dropped and the anon grant removed (friend presence has no anonymous
--   use case).
--
-- Client changes land together with this migration:
--   src/services/feed.ts, src/hooks/queries/useVenueDetailQuery.ts,
--   src/hooks/queries/useFriendsAtVenueQuery.ts

-- ----------------------------------------------------------------------
-- get_friend_feed
-- ----------------------------------------------------------------------

drop function if exists public.get_friend_feed(uuid[], int);

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
    left join public.profiles p on p.id = c.user_id
    left join public.venues   v on v.id = c.venue_id

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

revoke all on function public.get_friend_feed(int) from public, anon;
grant execute on function public.get_friend_feed(int) to authenticated;

-- ----------------------------------------------------------------------
-- get_venue_detail
-- ----------------------------------------------------------------------

drop function if exists public.get_venue_detail(integer, uuid, integer);

CREATE OR REPLACE FUNCTION public.get_venue_detail(
  p_venue_id INTEGER,
  p_review_limit INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid              UUID := auth.uid();
  v_now              TIMESTAMPTZ := now();
  v_four_h_ago       TIMESTAMPTZ := now() - INTERVAL '4 hours';
  v_today_start      TIMESTAMPTZ := date_trunc('day', now());
  v_thirty_days_ago  TIMESTAMPTZ := now() - INTERVAL '30 days';
  v_venue            JSONB;
  v_stats            JSONB;
BEGIN
  SELECT to_jsonb(v) INTO v_venue
  FROM (
    SELECT id, name, type, city, county, sector, address, lat, lng,
           tables_count, condition, hours, description, tags, photos,
           free_access, night_lighting, nets, verified, tariff, website,
           submitted_by, approved, created_at
    FROM public.venues
    WHERE id = p_venue_id
  ) v;

  IF v_venue IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(s) INTO v_stats
  FROM (
    SELECT venue_id, avg_rating, review_count, checkin_count, favorite_count
    FROM public.venue_stats
    WHERE venue_id = p_venue_id
  ) s;

  RETURN jsonb_build_object(
    'venue', v_venue,
    'stats', v_stats,
    'is_favorited',
      CASE
        WHEN v_uid IS NULL THEN false
        ELSE EXISTS (
          SELECT 1 FROM public.favorites f
          WHERE f.user_id = v_uid AND f.venue_id = p_venue_id
        )
      END,
    'user_active_checkin',
      CASE
        WHEN v_uid IS NULL THEN NULL
        ELSE (
          SELECT to_jsonb(ck) FROM (
            SELECT id, user_id, venue_id, table_number, started_at, ended_at
            FROM public.checkins
            WHERE user_id = v_uid
              AND venue_id = p_venue_id
              AND (ended_at > v_now
                   OR (ended_at IS NULL AND started_at >= v_today_start))
            ORDER BY started_at DESC
            LIMIT 1
          ) ck
        )
      END,
    'upcoming_event_count', (
      SELECT COUNT(*)::INT FROM public.events e
      WHERE e.venue_id = p_venue_id
        AND e.status NOT IN ('cancelled', 'completed')
        AND (
          e.starts_at >= v_now
          OR e.ends_at  >= v_now
          OR (e.ends_at IS NULL AND e.starts_at >= v_four_h_ago)
        )
    ),
    'champion', (
      WITH per_user AS (
        SELECT user_id,
               COUNT(DISTINCT date_trunc('day', started_at)) AS days
        FROM public.checkins
        WHERE venue_id = p_venue_id
          AND started_at >= v_thirty_days_ago
        GROUP BY user_id
        HAVING COUNT(DISTINCT date_trunc('day', started_at)) >= 2
      )
      SELECT jsonb_build_object(
               'user_id',    p.id,
               'full_name',  p.full_name,
               'day_count',  d.days
             )
      FROM per_user d
      JOIN public.profiles p ON p.id = d.user_id
      ORDER BY d.days DESC, p.full_name ASC NULLS LAST
      LIMIT 1
    ),
    'recent_reviews', (
      SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, venue_id, user_id, reviewer_name, rating, body, created_at
        FROM public.reviews
        WHERE venue_id = p_venue_id
        ORDER BY created_at DESC
        LIMIT GREATEST(p_review_limit, 1)
      ) r
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_venue_detail(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_detail(INTEGER, INTEGER)
  TO authenticated, anon;

-- ----------------------------------------------------------------------
-- get_friends_at_venue
-- ----------------------------------------------------------------------

drop function if exists public.get_friends_at_venue(integer, uuid);

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
  friend_checkins AS (
    SELECT DISTINCT ON (c.user_id)
      c.user_id,
      'checkin'::TEXT AS source,
      NULL::TEXT      AS event_title
    FROM public.checkins c
    JOIN my_friends mf ON mf.friend_id = c.user_id
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
    JOIN my_friends mf ON mf.friend_id = ep.user_id
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

REVOKE ALL ON FUNCTION public.get_friends_at_venue(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friends_at_venue(INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
