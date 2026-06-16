-- Migration: 115_open_play (F020)
-- Open Play Broadcast — "looking for players". Two linked pieces:
--   1. checkins.open_to_play + session_note: the per-check-in "I'm here and
--      open to play" flag the duration modal sets.
--   2. play_intents (+ play_intent_joins): the joinable, notifiable, expiring
--      broadcast. "now" intents are created alongside an open-to-play check-in;
--      "Plan a session" creates future ones (+1h / tonight / tomorrow). Once
--      someone is "in", the host converts the intent into a pre-filled event.
--
-- Design notes
-- ============
-- - Reads go through SECURITY DEFINER RPCs: checkins are self+friends-scoped
--   (084/091), so a city-wide "who's looking to play" query must read past the
--   caller's RLS rows. Visibility (friends_only|public) + block filtering are
--   enforced in the RPC, never in RLS (072 rationale).
-- - One active broadcast per host: a partial unique index on (host_id) WHERE
--   status='open'. create_play_intent first expires the caller's own stale-by-
--   time intents, so the guard is self-healing (the pg_cron sweep is a backstop).
-- - Notifications fan out through the 097 choke point (new 'open_play' category);
--   no per-feature boolean column, no realtime (push + fetch-on-focus only).
-- - checkin_visibility (091) gains 'public' here, wired into the 3 places 091
--   hard-coded 'friends' (the checkins SELECT policy + get_friend_feed +
--   get_friends_at_venue). 091 is frozen — extended here, not edited there.

-- 1. checkins: open-to-play flag + session note ----------------------------
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS open_to_play boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS session_note text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkins_session_note_len') THEN
    ALTER TABLE public.checkins ADD CONSTRAINT checkins_session_note_len
      CHECK (session_note IS NULL OR char_length(session_note) <= 120);
  END IF;
END $$;

-- 085-style column-list grants: new columns aren't covered by prior grants.
GRANT INSERT (open_to_play, session_note) ON public.checkins TO authenticated;
GRANT UPDATE (open_to_play, session_note) ON public.checkins TO authenticated;

-- 2. checkin_visibility: add 'public' (091 frozen — extend here) ------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_checkin_visibility_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_checkin_visibility_check
  CHECK (checkin_visibility IN ('friends', 'private', 'public'));

-- 2a. checkins SELECT policy: self OR public-owner OR (friend AND friends-vis)
DROP POLICY IF EXISTS "Checkins readable by self and friends" ON public.checkins;
CREATE POLICY "Checkins readable by self and friends" ON public.checkins
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = checkins.user_id AND p.checkin_visibility = 'public'
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = checkins.user_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = checkins.user_id))
      )
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = checkins.user_id AND p.checkin_visibility = 'friends'
      )
    )
  );

-- 2b. get_friend_feed: include 'public' users (reproduce 091 body verbatim + IN)
CREATE OR REPLACE FUNCTION public.get_friend_feed(p_limit int DEFAULT 30)
RETURNS TABLE (
  kind text, id bigint, user_id uuid, user_name text,
  venue_id int, venue_name text, venue_city text, rating int, ts timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  with my_friends as (
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as friend_id
    from public.friendships f
    where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
  ),
  feed as (
    select 'checkin'::text as kind, c.id::bigint as id, c.user_id as user_id,
           coalesce(p.full_name, '?') as user_name, c.venue_id as venue_id,
           coalesce(v.name, '?') as venue_name, coalesce(v.city, '') as venue_city,
           null::int as rating, c.started_at as ts
    from public.checkins c
    join my_friends mf on mf.friend_id = c.user_id
    join public.profiles p on p.id = c.user_id
    left join public.venues v on v.id = c.venue_id
    where p.checkin_visibility in ('friends', 'public')
    union all
    select 'review'::text as kind, r.id::bigint as id, r.user_id as user_id,
           coalesce(r.reviewer_name, '?') as user_name, r.venue_id as venue_id,
           coalesce(v.name, '?') as venue_name, ''::text as venue_city,
           r.rating as rating, r.created_at as ts
    from public.reviews r
    join my_friends mf on mf.friend_id = r.user_id
    left join public.venues v on v.id = r.venue_id
  )
  select * from feed order by ts desc limit greatest(coalesce(p_limit, 30), 1);
$$;

-- 2c. get_friends_at_venue: include 'public' users (reproduce 091 body + IN)
CREATE OR REPLACE FUNCTION public.get_friends_at_venue(p_venue_id INTEGER)
RETURNS TABLE (user_id UUID, full_name TEXT, avatar_url TEXT, source TEXT, event_title TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH my_friends AS (
    SELECT CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS friend_id
    FROM public.friendships f
    WHERE f.status = 'accepted' AND auth.uid() IN (f.requester_id, f.addressee_id)
  ),
  visible_friends AS (
    SELECT mf.friend_id FROM my_friends mf
    JOIN public.profiles p ON p.id = mf.friend_id
    WHERE p.checkin_visibility IN ('friends', 'public')
  ),
  friend_checkins AS (
    SELECT DISTINCT ON (c.user_id) c.user_id, 'checkin'::TEXT AS source, NULL::TEXT AS event_title
    FROM public.checkins c
    JOIN visible_friends mf ON mf.friend_id = c.user_id
    WHERE c.venue_id = p_venue_id
      AND (c.ended_at > now() OR (c.ended_at IS NULL AND c.started_at >= date_trunc('day', now())))
    ORDER BY c.user_id, c.started_at DESC
  ),
  friend_events AS (
    SELECT DISTINCT ON (ep.user_id) ep.user_id, 'event'::TEXT AS source, e.title AS event_title
    FROM public.events e
    JOIN public.event_participants ep ON ep.event_id = e.id
    JOIN visible_friends mf ON mf.friend_id = ep.user_id
    WHERE e.venue_id = p_venue_id
      AND e.status NOT IN ('cancelled', 'completed')
      AND e.starts_at <= now()
      AND (e.ends_at >= now() OR (e.ends_at IS NULL AND e.starts_at >= now() - INTERVAL '4 hours'))
      AND NOT EXISTS (SELECT 1 FROM friend_checkins fc WHERE fc.user_id = ep.user_id)
    ORDER BY ep.user_id
  ),
  merged AS (SELECT * FROM friend_checkins UNION ALL SELECT * FROM friend_events)
  SELECT m.user_id, p.full_name, p.avatar_url, m.source, m.event_title
  FROM merged m JOIN public.profiles p ON p.id = m.user_id;
$$;

-- 3. play_intents + joins --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.play_intents (
  id          bigserial PRIMARY KEY,
  host_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id    integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  when_slot   text NOT NULL CHECK (when_slot IN ('now', 'plus_1h', 'tonight', 'tomorrow')),
  note        text CHECK (note IS NULL OR char_length(note) <= 120),
  visibility  text NOT NULL DEFAULT 'public' CHECK (visibility IN ('friends_only', 'public')),
  starts_at   timestamptz NOT NULL,
  expires_at  timestamptz NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'converted', 'cancelled', 'expired')),
  event_id    integer REFERENCES public.events(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One active broadcast per host (the simultaneous-broadcast guard).
CREATE UNIQUE INDEX IF NOT EXISTS one_open_play_intent_per_host
  ON public.play_intents (host_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_play_intents_venue_open
  ON public.play_intents (venue_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_play_intents_expiry
  ON public.play_intents (status, expires_at);

CREATE TABLE IF NOT EXISTS public.play_intent_joins (
  id         bigserial PRIMARY KEY,
  intent_id  bigint NOT NULL REFERENCES public.play_intents(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intent_id, user_id)
);

-- RLS: host/joiner read own; all writes flow through SECURITY DEFINER RPCs.
ALTER TABLE public.play_intents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Play intents read own" ON public.play_intents;
CREATE POLICY "Play intents read own" ON public.play_intents
  FOR SELECT TO authenticated USING (host_id = auth.uid());

ALTER TABLE public.play_intent_joins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Play intent joins read own" ON public.play_intent_joins;
CREATE POLICY "Play intent joins read own" ON public.play_intent_joins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON public.play_intents TO authenticated;
GRANT SELECT ON public.play_intent_joins TO authenticated;

-- 4. Rate limit (047 / 105 pattern) on broadcast creation -------------------
INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('create_play_intent', 'user',  3600, 10, '10 broadcasts per hour'),
  ('create_play_intent', 'user', 86400, 40, '40 broadcasts per day')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_enforce_create_play_intent() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('create_play_intent'); RETURN new; END $$;

DROP TRIGGER IF EXISTS rate_limit_create_play_intent ON public.play_intents;
CREATE TRIGGER rate_limit_create_play_intent
  BEFORE INSERT ON public.play_intents
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_create_play_intent();

-- 5. Notification category + type allowlist (reproduce full bodies) ---------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request', 'friend_accepted',
    'event_reminder', 'event_joined', 'event_cancelled',
    'event_invite', 'event_update',
    'event_feedback_request', 'event_feedback_received',
    'checkin_nearby', 'review_on_venue', 'feedback_reply',
    'match_confirm', 'match_confirmed', 'match_disputed',
    'venue_post_reply',
    'play_broadcast', 'play_join', 'play_converted'   -- F020
  ));

CREATE OR REPLACE FUNCTION public.notification_category(p_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_type IN ('friend_request', 'friend_accepted') THEN 'friend_requests'
    WHEN p_type IN ('checkin', 'checkin_nearby', 'friend_checkin') THEN 'friend_checkins'
    WHEN p_type IN ('event_reminder', 'event_update', 'event_cancelled', 'event_joined',
                    'event_invite', 'event_challenge',
                    'event_feedback_request', 'event_feedback_received') THEN 'events'
    WHEN p_type IN ('review', 'review_on_venue') THEN 'reviews_on_my_venue'
    WHEN p_type IN ('feedback_reply') THEN 'feedback_replies'
    WHEN p_type IN ('match_confirm', 'match_confirmed', 'match_disputed') THEN 'matches'
    WHEN p_type IN ('venue_post_reply') THEN 'venue_board'
    WHEN p_type IN ('play_broadcast', 'play_join', 'play_converted') THEN 'open_play'
    ELSE NULL
  END;
$$;

-- 6. Write RPCs ------------------------------------------------------------
-- Create a broadcast. Expires the caller's own stale-by-time open intents
-- first (self-healing one-active guard), then inserts and fans out.
CREATE OR REPLACE FUNCTION public.create_play_intent(
  p_venue_id integer,
  p_when_slot text,
  p_note text DEFAULT NULL,
  p_public boolean DEFAULT true
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_host uuid := auth.uid();
  v_id bigint;
  v_starts timestamptz;
  v_expires timestamptz;
  v_today_6pm timestamptz := date_trunc('day', now()) + interval '18 hours';
  v_city text;
  v_venue_name text;
  v_host_name text;
  v_rec uuid;
  v_data jsonb;
BEGIN
  IF v_host IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_when_slot NOT IN ('now', 'plus_1h', 'tonight', 'tomorrow') THEN
    RAISE EXCEPTION 'invalid when_slot: %', p_when_slot;
  END IF;

  -- Self-heal: release any of the caller's broadcasts whose window has passed.
  UPDATE public.play_intents SET status = 'expired'
   WHERE host_id = v_host AND status = 'open' AND expires_at < now();

  IF EXISTS (SELECT 1 FROM public.play_intents WHERE host_id = v_host AND status = 'open') THEN
    RAISE EXCEPTION 'open_play_already_active';
  END IF;

  v_starts := CASE p_when_slot
    WHEN 'now'      THEN now()
    WHEN 'plus_1h'  THEN now() + interval '1 hour'
    WHEN 'tonight'  THEN GREATEST(v_today_6pm, now())
    WHEN 'tomorrow' THEN v_today_6pm + interval '1 day'
  END;
  v_expires := v_starts + interval '3 hours';

  SELECT v.city, v.name INTO v_city, v_venue_name FROM public.venues v WHERE v.id = p_venue_id;

  INSERT INTO public.play_intents (host_id, venue_id, when_slot, note, visibility, starts_at, expires_at)
  VALUES (v_host, p_venue_id, p_when_slot,
          NULLIF(btrim(coalesce(p_note, '')), ''),
          CASE WHEN p_public THEN 'public' ELSE 'friends_only' END,
          v_starts, v_expires)
  RETURNING id INTO v_id;

  -- Fan out: in-city accepted friends, plus venue favoriters when public.
  SELECT full_name INTO v_host_name FROM public.profiles WHERE id = v_host;
  v_data := jsonb_build_object('screen', '/venue/' || p_venue_id, 'venueId', p_venue_id, 'intentId', v_id);

  FOR v_rec IN
    SELECT DISTINCT u_id FROM (
      SELECT CASE WHEN f.requester_id = v_host THEN f.addressee_id ELSE f.requester_id END AS u_id
      FROM public.friendships f
      JOIN public.profiles pp
        ON pp.id = (CASE WHEN f.requester_id = v_host THEN f.addressee_id ELSE f.requester_id END)
      WHERE f.status = 'accepted' AND v_host IN (f.requester_id, f.addressee_id)
        AND (v_city IS NULL OR pp.city = v_city)
      UNION
      SELECT fav.user_id FROM public.favorites fav
      WHERE p_public AND fav.venue_id = p_venue_id
    ) r
    WHERE u_id <> v_host
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_host AND b.blocked_id = u_id)
           OR (b.blocker_id = u_id AND b.blocked_id = v_host)
      )
  LOOP
    PERFORM public.create_and_send_notification(
      v_rec, v_host, 'play_broadcast',
      'Joc deschis',
      COALESCE(v_host_name, 'Cineva') || ' caută jucători la ' || COALESCE(v_venue_name, 'un teren') || '.',
      v_data
    );
  END LOOP;

  RETURN v_id;
END;
$$;

-- "I'm in" — join a broadcast; notify the host.
CREATE OR REPLACE FUNCTION public.join_play_intent(p_intent_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_intent public.play_intents;
  v_name text;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_intent FROM public.play_intents WHERE id = p_intent_id AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'broadcast not found or closed'; END IF;
  IF v_intent.host_id = v_uid THEN RAISE EXCEPTION 'cannot join your own broadcast'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = v_intent.host_id AND b.blocked_id = v_uid)
       OR (b.blocker_id = v_uid AND b.blocked_id = v_intent.host_id)
  ) THEN RAISE EXCEPTION 'blocked'; END IF;

  INSERT INTO public.play_intent_joins (intent_id, user_id)
  VALUES (p_intent_id, v_uid) ON CONFLICT (intent_id, user_id) DO NOTHING;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;
  PERFORM public.create_and_send_notification(
    v_intent.host_id, v_uid, 'play_join',
    'Cineva s-a alăturat',
    COALESCE(v_name, 'Cineva') || ' vrea să joace.',
    jsonb_build_object('screen', '/venue/' || v_intent.venue_id, 'venueId', v_intent.venue_id, 'intentId', p_intent_id)
  );

  SELECT count(*)::int INTO v_count FROM public.play_intent_joins WHERE intent_id = p_intent_id;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_play_intent(p_intent_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid(); v_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  DELETE FROM public.play_intent_joins WHERE intent_id = p_intent_id AND user_id = v_uid;
  SELECT count(*)::int INTO v_count FROM public.play_intent_joins WHERE intent_id = p_intent_id;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_play_intent(p_intent_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  UPDATE public.play_intents SET status = 'cancelled'
   WHERE id = p_intent_id AND host_id = v_uid AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'broadcast not found or not yours'; END IF;
END;
$$;

-- Convert a broadcast with ≥1 joiner into a pre-filled event; everyone joins.
CREATE OR REPLACE FUNCTION public.convert_play_intent_to_event(
  p_intent_id bigint,
  p_title text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_intent public.play_intents;
  v_venue_name text;
  v_event_id integer;
  v_joins integer;
  v_joiner uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_intent FROM public.play_intents WHERE id = p_intent_id AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'broadcast not found or closed'; END IF;
  IF v_intent.host_id <> v_uid THEN RAISE EXCEPTION 'only the host can convert'; END IF;

  SELECT count(*)::int INTO v_joins FROM public.play_intent_joins WHERE intent_id = p_intent_id;
  IF v_joins < 1 THEN RAISE EXCEPTION 'need at least one player in before converting'; END IF;

  SELECT name INTO v_venue_name FROM public.venues WHERE id = v_intent.venue_id;

  INSERT INTO public.events (title, organizer_id, venue_id, starts_at, ends_at,
                             status, event_type, visibility)
  VALUES (COALESCE(NULLIF(btrim(coalesce(p_title, '')), ''), v_venue_name, 'Open Play'),
          v_uid, v_intent.venue_id, v_intent.starts_at, v_intent.starts_at + interval '2 hours',
          'open', 'casual', 'friends')
  RETURNING id INTO v_event_id;

  INSERT INTO public.event_participants (event_id, user_id) VALUES (v_event_id, v_uid)
  ON CONFLICT (event_id, user_id) DO NOTHING;

  FOR v_joiner IN SELECT user_id FROM public.play_intent_joins WHERE intent_id = p_intent_id LOOP
    INSERT INTO public.event_participants (event_id, user_id) VALUES (v_event_id, v_joiner)
    ON CONFLICT (event_id, user_id) DO NOTHING;
    PERFORM public.create_and_send_notification(
      v_joiner, v_uid, 'play_converted',
      'Sesiune confirmată',
      'Jocul deschis a devenit un eveniment.',
      jsonb_build_object('screen', '/(tabs)/events', 'eventId', v_event_id)
    );
  END LOOP;

  UPDATE public.play_intents SET status = 'converted', event_id = v_event_id WHERE id = p_intent_id;
  RETURN v_event_id;
END;
$$;

-- 7. Read RPCs -------------------------------------------------------------
-- Open, visible, non-expired broadcasts in a city (NULL = all cities).
CREATE OR REPLACE FUNCTION public.get_open_play(
  p_city_id integer DEFAULT NULL,
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  id bigint, host_id uuid, host_name text, host_avatar text, host_skill text,
  venue_id integer, venue_name text, venue_city text,
  when_slot text, note text, starts_at timestamptz, expires_at timestamptz,
  join_count integer, viewer_joined boolean, is_host boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pi.id, pi.host_id, p.full_name, p.avatar_url, p.skill_level,
         pi.venue_id, v.name, v.city,
         pi.when_slot, pi.note, pi.starts_at, pi.expires_at,
         (SELECT count(*)::int FROM public.play_intent_joins j WHERE j.intent_id = pi.id),
         EXISTS (SELECT 1 FROM public.play_intent_joins j WHERE j.intent_id = pi.id AND j.user_id = auth.uid()),
         pi.host_id = auth.uid()
  FROM public.play_intents pi
  JOIN public.profiles p ON p.id = pi.host_id
  JOIN public.venues v ON v.id = pi.venue_id
  WHERE pi.status = 'open' AND pi.expires_at > now()
    AND (p_city_id IS NULL OR v.city_id = p_city_id)
    AND (
      pi.host_id = auth.uid()
      OR pi.visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = pi.host_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = pi.host_id))
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = pi.host_id)
         OR (b.blocker_id = pi.host_id AND b.blocked_id = auth.uid())
    )
  ORDER BY pi.starts_at ASC
  LIMIT GREATEST(p_limit, 1);
$$;

-- Open broadcasts at one venue (for venue detail).
CREATE OR REPLACE FUNCTION public.get_venue_open_play(p_venue_id integer)
RETURNS TABLE (
  id bigint, host_id uuid, host_name text, host_avatar text, host_skill text,
  when_slot text, note text, starts_at timestamptz,
  join_count integer, viewer_joined boolean, is_host boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pi.id, pi.host_id, p.full_name, p.avatar_url, p.skill_level,
         pi.when_slot, pi.note, pi.starts_at,
         (SELECT count(*)::int FROM public.play_intent_joins j WHERE j.intent_id = pi.id),
         EXISTS (SELECT 1 FROM public.play_intent_joins j WHERE j.intent_id = pi.id AND j.user_id = auth.uid()),
         pi.host_id = auth.uid()
  FROM public.play_intents pi
  JOIN public.profiles p ON p.id = pi.host_id
  WHERE pi.venue_id = p_venue_id AND pi.status = 'open' AND pi.expires_at > now()
    AND (
      pi.host_id = auth.uid()
      OR pi.visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = pi.host_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = pi.host_id))
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = pi.host_id)
         OR (b.blocker_id = pi.host_id AND b.blocked_id = auth.uid())
    )
  ORDER BY pi.starts_at ASC;
$$;

-- Per-venue open-broadcast counts for the pulsing map pin (visible to caller).
CREATE OR REPLACE FUNCTION public.get_open_play_counts(p_city_id integer DEFAULT NULL)
RETURNS TABLE (venue_id integer, broadcast_count integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pi.venue_id, count(*)::int
  FROM public.play_intents pi
  JOIN public.venues v ON v.id = pi.venue_id
  WHERE pi.status = 'open' AND pi.expires_at > now()
    AND (p_city_id IS NULL OR v.city_id = p_city_id)
    AND (
      pi.host_id = auth.uid()
      OR pi.visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = auth.uid() AND f.addressee_id = pi.host_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = pi.host_id))
      )
    )
  GROUP BY pi.venue_id;
$$;

-- The caller's current open broadcast (or no rows) — for UI toggle state.
CREATE OR REPLACE FUNCTION public.get_my_play_intent()
RETURNS TABLE (
  id bigint, venue_id integer, venue_name text, when_slot text, note text,
  visibility text, starts_at timestamptz, expires_at timestamptz, join_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pi.id, pi.venue_id, v.name, pi.when_slot, pi.note, pi.visibility,
         pi.starts_at, pi.expires_at,
         (SELECT count(*)::int FROM public.play_intent_joins j WHERE j.intent_id = pi.id)
  FROM public.play_intents pi
  JOIN public.venues v ON v.id = pi.venue_id
  WHERE pi.host_id = auth.uid() AND pi.status = 'open' AND pi.expires_at > now()
  ORDER BY pi.created_at DESC
  LIMIT 1;
$$;

-- 8. Expiry sweep (pg_cron) — backstop; reads already filter on expires_at ---
CREATE OR REPLACE FUNCTION public.expire_play_intents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count int;
BEGIN
  WITH upd AS (
    UPDATE public.play_intents SET status = 'expired'
     WHERE status = 'open' AND expires_at < now() RETURNING 1
  ) SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_play_intents() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'expire_play_intents';
    PERFORM cron.schedule('expire_play_intents', '41 * * * *',
      $cron$SELECT public.expire_play_intents()$cron$);
  ELSE
    RAISE NOTICE 'pg_cron unavailable — expire play_intents externally (hourly).';
  END IF;
END $$;

-- 9. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_play_intent(integer, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_play_intent(integer, text, text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.join_play_intent(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_play_intent(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.leave_play_intent(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_play_intent(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_play_intent(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_play_intent(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.convert_play_intent_to_event(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_play_intent_to_event(bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_open_play(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_open_play(integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.get_venue_open_play(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_open_play(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.get_open_play_counts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_open_play_counts(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_play_intent() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_play_intent() TO authenticated;

NOTIFY pgrst, 'reload schema';
