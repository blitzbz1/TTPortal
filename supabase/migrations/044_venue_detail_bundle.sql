-- Bundled venue-detail RPC.
--
-- The venue detail screen previously fired 7 queries (venue, venue_stats,
-- isFavorite, getUserActiveCheckin, upcoming-event count, champion,
-- top-N reviews) to render its critical-path content. That's 7 connections
-- + round-trips per venue tap; with realistic concurrency it adds up.
--
-- This RPC merges all seven into a single SQL call returning a JSONB
-- bundle. The screen drops to ONE query for above-the-fold content;
-- full reviews list / friends-here / admin check load lazily.
--
-- Returns NULL when the venue does not exist (caller surfaces the 404).

CREATE OR REPLACE FUNCTION public.get_venue_detail(
  p_venue_id INTEGER,
  p_user_id  UUID DEFAULT NULL,
  p_review_limit INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
        WHEN p_user_id IS NULL THEN false
        ELSE EXISTS (
          SELECT 1 FROM public.favorites f
          WHERE f.user_id = p_user_id AND f.venue_id = p_venue_id
        )
      END,
    'user_active_checkin',
      CASE
        WHEN p_user_id IS NULL THEN NULL
        ELSE (
          SELECT to_jsonb(ck) FROM (
            SELECT id, user_id, venue_id, table_number, started_at, ended_at
            FROM public.checkins
            WHERE user_id = p_user_id
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

GRANT EXECUTE ON FUNCTION public.get_venue_detail(INTEGER, UUID, INTEGER)
  TO authenticated, anon;

-- Bundled "friends at venue" RPC.
--
-- Replaces 3 client-side queries (getFriendIds → getActiveFriendCheckins →
-- getActiveFriendEvents) with one server call that returns the merged set
-- of friend identities currently present at the venue (active checkin or
-- in-progress event participation).
--
-- One row per (user_id, source). Caller dedupes on user_id with checkin
-- preferred over event (mirrors the legacy client-side merge order).

CREATE OR REPLACE FUNCTION public.get_friends_at_venue(
  p_venue_id INTEGER,
  p_user_id  UUID
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
SET search_path = public
AS $$
  WITH my_friends AS (
    SELECT
      CASE WHEN f.requester_id = p_user_id THEN f.addressee_id ELSE f.requester_id END AS friend_id
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
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

GRANT EXECUTE ON FUNCTION public.get_friends_at_venue(INTEGER, UUID)
  TO authenticated, anon;
