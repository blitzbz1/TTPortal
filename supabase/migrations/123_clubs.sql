-- Migration: 123_clubs (F040)
-- Clubs & groups. A club is an owned, code-joinable group; members get a new
-- 'club' event-visibility scope so a club-scoped event lands in every member's
-- Events tab with a push.
--
-- Design notes
-- ============
-- - RLS recursion trap (059): the events SELECT policy must read club
--   membership, and the clubs/club_members SELECT policies must read it too.
--   Referencing club_members directly from those policies would recurse
--   (club_members policy → club_members). We route every membership check
--   through SECURITY DEFINER helpers is_club_member()/is_club_admin() which
--   bypass RLS, so no policy ever references a table whose own policy
--   references it back.
-- - event_visibility gains 'club' (058 is frozen — extended here). A freshly
--   ADDed enum value cannot be referenced as an enum LITERAL in the same
--   transaction ("unsafe use of new value"), so every DDL comparison below
--   casts `visibility::text = 'club'` instead of `= 'club'::event_visibility`.
-- - All writes flow through SECURITY DEFINER RPCs (089-hardened with
--   SET search_path = public, pg_temp + an auth.uid() guard). Tables get
--   SELECT-only RLS; club-event membership is enforced by a BEFORE
--   INSERT OR UPDATE trigger on events (both the events INSERT and UPDATE
--   policies only check organizer_id, so club scoping would otherwise be a
--   read-only gate bypassable by INSERT-public-then-UPDATE-to-club).
-- - Club-event notifications fan out through the 097 choke point (new
--   'club_event_created' type → new 'club_event' category).
-- - generate_recurring_events() (016, frozen) is reproduced here to propagate
--   `visibility` AND `club_id` into recurrence inserts — currently it copies
--   neither, so recurring instances silently revert to 'public' (a latent bug).

-- 1. Tables ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clubs (
  id            bigserial PRIMARY KEY,
  owner_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  description   text CHECK (description IS NULL OR char_length(description) <= 500),
  avatar_url    text,
  city_id       int REFERENCES public.cities(id) ON DELETE SET NULL,
  home_venue_id int REFERENCES public.venues(id) ON DELETE SET NULL,
  join_code     text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_members (
  id        bigserial PRIMARY KEY,
  club_id   bigint NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_club_members_user ON public.club_members (user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club ON public.club_members (club_id);

-- 2. Membership helpers (SECURITY DEFINER → bypass RLS → no policy recursion)
CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin(p_club_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

-- 3. RLS: members read their clubs; all writes via SECURITY DEFINER RPCs -----
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clubs readable by members" ON public.clubs;
CREATE POLICY "Clubs readable by members" ON public.clubs
  FOR SELECT TO authenticated USING (public.is_club_member(id));
GRANT SELECT ON public.clubs TO authenticated;

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Club members readable by members" ON public.club_members;
CREATE POLICY "Club members readable by members" ON public.club_members
  FOR SELECT TO authenticated USING (public.is_club_member(club_id));
GRANT SELECT ON public.club_members TO authenticated;

-- 4. events: 'club' visibility scope (058 frozen — extended here) ------------
ALTER TYPE public.event_visibility ADD VALUE IF NOT EXISTS 'club';
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS club_id bigint REFERENCES public.clubs(id) ON DELETE SET NULL;

-- 085-style column grants: new columns aren't covered by prior table grants.
GRANT INSERT (club_id) ON public.events TO authenticated;
GRANT UPDATE (club_id) ON public.events TO authenticated;

-- Re-create the SINGLE events SELECT policy (058) with a 'club' OR-branch.
-- Reproduce every existing branch verbatim; add the membership branch via the
-- DEFINER helper (no recursion). The new enum value is compared as ::text.
DROP POLICY IF EXISTS "Events visibility-aware select" ON public.events;
CREATE POLICY "Events visibility-aware select" ON public.events
  FOR SELECT
  USING (
    visibility = 'public'
    OR organizer_id = auth.uid()
    OR (
      visibility = 'friends' AND EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND (
            (f.requester_id = auth.uid() AND f.addressee_id = events.organizer_id)
            OR (f.addressee_id = auth.uid() AND f.requester_id = events.organizer_id)
          )
      )
    )
    OR (
      visibility = 'private' AND EXISTS (
        SELECT 1 FROM public.event_invitations ei
        WHERE ei.event_id = events.id AND ei.user_id = auth.uid()
      )
    )
    OR (
      events.visibility::text = 'club'
      AND events.club_id IS NOT NULL
      AND public.is_club_member(events.club_id)
    )
  );

-- Enforce club membership on club-event INSERT *and UPDATE* (both the events
-- INSERT policy and the frozen UPDATE policy (004) only check organizer_id, so
-- without this an organizer could create a public event then UPDATE it to
-- visibility='club' + an arbitrary club_id and inject into that club's feed).
-- The inserter/updater is the organizer = auth.uid().
CREATE OR REPLACE FUNCTION public.enforce_club_event_membership()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only enforce for interactive callers (auth.uid() set). System paths
  -- (pg_cron recurrence, service-role) run with a NULL uid and are trusted;
  -- anon can't reach here anyway (the events INSERT policy requires
  -- auth.uid() = organizer_id). Without this guard, the recurrence cron —
  -- which carries club_id forward (section 12) — would fail is_club_member()
  -- (NULL uid) and abort every hour once a recurring club event exists.
  IF NEW.visibility::text = 'club' AND auth.uid() IS NOT NULL THEN
    IF NEW.club_id IS NULL OR NOT public.is_club_member(NEW.club_id) THEN
      RAISE EXCEPTION 'not_a_club_member' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_club_event_membership ON public.events;
CREATE TRIGGER enforce_club_event_membership
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_club_event_membership();

-- 5. venue-photos storage: allow a clubs/ prefix (092 frozen — extended) -----
-- Reproduce 092's INSERT policy in full, adding 'clubs' to the prefix
-- allow-list (club avatars upload under clubs/<club-or-user-id>/<ts>.jpg).
DROP POLICY IF EXISTS "Authenticated upload venue photos" ON storage.objects;
CREATE POLICY "Authenticated upload venue photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'venue-photos'
    AND (storage.foldername(name))[1] IN ('venues', 'change-requests', 'condition-votes', 'clubs')
    AND array_length(storage.foldername(name), 1) >= 2
    AND (
      SELECT count(*) FROM storage.objects o
      WHERE o.bucket_id = 'venue-photos'
        AND o.owner = auth.uid()
        AND o.created_at > now() - interval '24 hours'
    ) < 10
  );

-- 6. Notification category + type allowlist (reproduce full bodies) ---------
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
    'play_broadcast', 'play_join', 'play_converted',
    'match_invite', 'match_invite_accepted',
    'dm_message',
    'bracket_match_ready',
    'season_ended',
    'club_event_created'   -- F040
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
    WHEN p_type IN ('match_invite', 'match_invite_accepted') THEN 'match_invites'
    WHEN p_type IN ('dm_message') THEN 'messages'
    WHEN p_type IN ('bracket_match_ready') THEN 'tournaments'
    WHEN p_type IN ('season_ended') THEN 'seasons'
    WHEN p_type IN ('club_event_created') THEN 'club_event'
    ELSE NULL
  END;
$$;

-- 7. Rate limits (047 pattern) ---------------------------------------------
INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('create_club', 'user',  3600,  5, '5 clubs created per hour'),
  ('create_club', 'user', 86400, 20, '20 clubs created per day'),
  ('join_club',   'user',  3600, 30, '30 club joins per hour'),
  ('join_club',   'user', 86400, 80, '80 club joins per day')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_enforce_create_club() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('create_club'); RETURN new; END $$;
DROP TRIGGER IF EXISTS rate_limit_create_club ON public.clubs;
CREATE TRIGGER rate_limit_create_club
  BEFORE INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_create_club();

CREATE OR REPLACE FUNCTION public.trg_enforce_join_club() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('join_club'); RETURN new; END $$;
DROP TRIGGER IF EXISTS rate_limit_join_club ON public.club_members;
CREATE TRIGGER rate_limit_join_club
  BEFORE INSERT ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_join_club();

-- 8. Join-code generation (035 generate_username collision-retry, base-less) -
CREATE OR REPLACE FUNCTION public.generate_club_join_code()
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  candidate TEXT;
  -- Uppercase alphanumeric; ambiguous chars are fine here (codes are shared as
  -- text, not transcribed by hand from a distance).
  alphabet TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INT;
  attempts INT := 0;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * 36)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clubs WHERE join_code = candidate);
    attempts := attempts + 1;
    IF attempts > 25 THEN
      -- Astronomically unlikely; widen to 7 chars to guarantee progress.
      candidate := candidate || substr(alphabet, 1 + floor(random() * 36)::int, 1);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clubs WHERE join_code = candidate);
      attempts := 0;
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 9. Club fan-out on club-event insert (097 choke point) --------------------
CREATE OR REPLACE FUNCTION public.notify_club_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_member uuid;
  v_club_name text;
BEGIN
  SELECT name INTO v_club_name FROM public.clubs WHERE id = NEW.club_id;
  FOR v_member IN
    SELECT cm.user_id FROM public.club_members cm
    WHERE cm.club_id = NEW.club_id AND cm.user_id <> NEW.organizer_id
  LOOP
    PERFORM public.create_and_send_notification(
      v_member, NEW.organizer_id, 'club_event_created',
      'Eveniment nou în club',
      'Un eveniment nou a fost adăugat în "' || COALESCE(v_club_name, 'clubul tău') || '".',
      jsonb_build_object('screen', '/(tabs)/events', 'eventId', NEW.id)
    );
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS notify_club_event ON public.events;
CREATE TRIGGER notify_club_event
  AFTER INSERT ON public.events
  FOR EACH ROW
  WHEN (NEW.visibility::text = 'club' AND NEW.club_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_club_event();

-- 10. Write RPCs -----------------------------------------------------------
-- Create a club, make the caller its admin, return the new club id.
CREATE OR REPLACE FUNCTION public.create_club(
  p_name text,
  p_description text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_city_id int DEFAULT NULL,
  p_home_venue_id int DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) < 2 THEN
    RAISE EXCEPTION 'club name too short';
  END IF;

  INSERT INTO public.clubs (owner_id, name, description, avatar_url, city_id, home_venue_id, join_code)
  VALUES (
    v_uid,
    btrim(p_name),
    NULLIF(btrim(coalesce(p_description, '')), ''),
    NULLIF(btrim(coalesce(p_avatar_url, '')), ''),
    p_city_id,
    p_home_venue_id,
    public.generate_club_join_code()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (v_id, v_uid, 'admin');

  RETURN v_id;
END;
$$;

-- Join a club by its (case-insensitive) code; return the club id.
CREATE OR REPLACE FUNCTION public.join_club_by_code(p_code text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_code IS NULL OR btrim(p_code) = '' THEN RAISE EXCEPTION 'empty join code'; END IF;

  SELECT id INTO v_id FROM public.clubs WHERE join_code = upper(btrim(p_code));
  IF v_id IS NULL THEN RAISE EXCEPTION 'club_not_found'; END IF;

  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (v_id, v_uid, 'member')
  ON CONFLICT (club_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

-- Leave a club; an admin may not leave while they are the only admin.
CREATE OR REPLACE FUNCTION public.leave_club(p_club_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_admin_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT role INTO v_role FROM public.club_members WHERE club_id = p_club_id AND user_id = v_uid;
  IF v_role IS NULL THEN RAISE EXCEPTION 'not a member'; END IF;

  IF v_role = 'admin' THEN
    SELECT count(*)::int INTO v_admin_count
    FROM public.club_members WHERE club_id = p_club_id AND role = 'admin';
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'last_admin_cannot_leave';
    END IF;
  END IF;

  DELETE FROM public.club_members WHERE club_id = p_club_id AND user_id = v_uid;
END;
$$;

-- Admin removes another member (never the last admin, never self via this path).
CREATE OR REPLACE FUNCTION public.remove_club_member(p_club_id bigint, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target_role text;
  v_admin_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_club_admin(p_club_id) THEN RAISE EXCEPTION 'not_club_admin' USING ERRCODE = '42501'; END IF;
  IF p_user_id = v_uid THEN RAISE EXCEPTION 'use leave_club to remove yourself'; END IF;

  SELECT role INTO v_target_role FROM public.club_members WHERE club_id = p_club_id AND user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'not a member'; END IF;

  IF v_target_role = 'admin' THEN
    SELECT count(*)::int INTO v_admin_count
    FROM public.club_members WHERE club_id = p_club_id AND role = 'admin';
    IF v_admin_count <= 1 THEN RAISE EXCEPTION 'last_admin_cannot_be_removed'; END IF;
  END IF;

  DELETE FROM public.club_members WHERE club_id = p_club_id AND user_id = p_user_id;
END;
$$;

-- Admin rotates the join code; returns the fresh code.
CREATE OR REPLACE FUNCTION public.rotate_club_join_code(p_club_id bigint)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_club_admin(p_club_id) THEN RAISE EXCEPTION 'not_club_admin' USING ERRCODE = '42501'; END IF;

  v_code := public.generate_club_join_code();
  UPDATE public.clubs SET join_code = v_code WHERE id = p_club_id;
  RETURN v_code;
END;
$$;

-- 11. Read RPCs ------------------------------------------------------------
-- Clubs the caller belongs to (with member counts + home-venue name).
CREATE OR REPLACE FUNCTION public.get_my_clubs()
RETURNS TABLE (
  id bigint, name text, avatar_url text, role text, member_count integer,
  city_id int, home_venue_id int, home_venue_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.name, c.avatar_url, cm.role,
         (SELECT count(*)::int FROM public.club_members m WHERE m.club_id = c.id),
         c.city_id, c.home_venue_id, v.name
  FROM public.clubs c
  JOIN public.club_members cm ON cm.club_id = c.id AND cm.user_id = auth.uid()
  LEFT JOIN public.venues v ON v.id = c.home_venue_id
  ORDER BY c.created_at DESC;
$$;

-- Full club detail (members-only): club fields + members + upcoming events.
CREATE OR REPLACE FUNCTION public.get_club_detail(p_club_id bigint)
RETURNS TABLE (
  id bigint, name text, description text, avatar_url text, join_code text,
  city_id int, home_venue_id int, home_venue_name text, owner_id uuid,
  my_role text, member_count integer, members jsonb, upcoming_events jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.name, c.description, c.avatar_url, c.join_code,
         c.city_id, c.home_venue_id, v.name AS home_venue_name, c.owner_id,
         (SELECT role FROM public.club_members WHERE club_id = c.id AND user_id = auth.uid()) AS my_role,
         (SELECT count(*)::int FROM public.club_members m WHERE m.club_id = c.id) AS member_count,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'user_id', m.user_id, 'full_name', p.full_name, 'avatar_url', p.avatar_url,
             'username', p.username, 'role', m.role
           ) ORDER BY (m.role = 'admin') DESC, m.joined_at ASC)
           FROM public.club_members m
           JOIN public.profiles p ON p.id = m.user_id
           WHERE m.club_id = c.id
         ), '[]'::jsonb) AS members,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'venue_id', e.venue_id
           ) ORDER BY e.starts_at ASC)
           FROM (
             SELECT e.id, e.title, e.starts_at, e.venue_id
             FROM public.events e
             WHERE e.club_id = c.id
               AND e.visibility::text = 'club'
               AND e.status NOT IN ('cancelled', 'completed')
               AND e.starts_at >= now() - interval '2 hours'
             ORDER BY e.starts_at ASC
             LIMIT 20
           ) e
         ), '[]'::jsonb) AS upcoming_events
  FROM public.clubs c
  LEFT JOIN public.venues v ON v.id = c.home_venue_id
  WHERE c.id = p_club_id AND public.is_club_member(c.id);
$$;

-- Pre-join preview by code (any authenticated user may peek a code).
CREATE OR REPLACE FUNCTION public.get_club_by_code(p_code text)
RETURNS TABLE (
  id bigint, name text, avatar_url text, member_count integer, already_member boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.name, c.avatar_url,
         (SELECT count(*)::int FROM public.club_members m WHERE m.club_id = c.id),
         EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = c.id AND m.user_id = auth.uid())
  FROM public.clubs c
  WHERE c.join_code = upper(btrim(p_code));
$$;

-- 12. Recurrence fix: propagate visibility + club_id (016 frozen — replaced) -
CREATE OR REPLACE FUNCTION public.generate_recurring_events()
RETURNS void AS $$
DECLARE
  rec RECORD;
  next_start TIMESTAMPTZ;
  next_end TIMESTAMPTZ;
  duration INTERVAL;
  root_id INT;
  new_event_id INT;
BEGIN
  FOR rec IN
    WITH latest_per_series AS (
      SELECT DISTINCT ON (COALESCE(parent_event_id, id))
        *
      FROM public.events
      WHERE recurrence_rule IS NOT NULL
        AND status NOT IN ('cancelled')
      ORDER BY COALESCE(parent_event_id, id), starts_at DESC
    )
    SELECT * FROM latest_per_series
    WHERE starts_at < NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.events e2
        WHERE e2.starts_at > NOW()
          AND e2.status != 'cancelled'
          AND (
            e2.parent_event_id = COALESCE(latest_per_series.parent_event_id, latest_per_series.id)
            OR (e2.id = COALESCE(latest_per_series.parent_event_id, latest_per_series.id)
                AND e2.recurrence_rule IS NOT NULL)
          )
      )
  LOOP
    duration := COALESCE(rec.ends_at - rec.starts_at, INTERVAL '0');
    root_id := COALESCE(rec.parent_event_id, rec.id);

    -- Advance starts_at until it is in the future
    next_start := rec.starts_at;
    LOOP
      CASE rec.recurrence_rule
        WHEN 'daily'   THEN next_start := next_start + INTERVAL '1 day';
        WHEN 'weekly'  THEN next_start := next_start + INTERVAL '7 days';
        WHEN 'monthly' THEN next_start := next_start + INTERVAL '1 month';
      END CASE;
      EXIT WHEN next_start > NOW();
    END LOOP;

    next_end := CASE
      WHEN rec.ends_at IS NOT NULL THEN next_start + duration
      ELSE NULL
    END;

    -- F040: carry visibility AND club_id forward (016 copied neither, so
    -- recurring instances silently became 'public').
    INSERT INTO public.events (
      title, description, venue_id, table_number, organizer_id,
      starts_at, ends_at, max_participants, status, event_type,
      recurrence_rule, recurrence_day, parent_event_id,
      visibility, club_id
    ) VALUES (
      rec.title, rec.description, rec.venue_id, rec.table_number, rec.organizer_id,
      next_start, next_end, rec.max_participants, 'open', rec.event_type,
      rec.recurrence_rule, rec.recurrence_day, root_id,
      rec.visibility, rec.club_id
    )
    RETURNING id INTO new_event_id;

    -- Auto-join the organizer
    INSERT INTO public.event_participants (event_id, user_id)
    VALUES (new_event_id, rec.organizer_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 13. Grants ---------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_club_member(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_club_member(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.is_club_admin(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_club_admin(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.generate_club_join_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_club(text, text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_club(text, text, text, int, int) TO authenticated;
REVOKE ALL ON FUNCTION public.join_club_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_club_by_code(text) TO authenticated;
REVOKE ALL ON FUNCTION public.leave_club(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_club(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_club_member(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_club_member(bigint, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.rotate_club_join_code(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_club_join_code(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_clubs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_clubs() TO authenticated;
REVOKE ALL ON FUNCTION public.get_club_detail(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_club_detail(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.get_club_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_club_by_code(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
