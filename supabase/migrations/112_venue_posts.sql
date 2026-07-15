-- Migration: 112_venue_posts (F016)
-- Venue board & Q&A: short questions/notes with one level of reply + a helpful
-- vote. UGC, so it wires into the existing trust & safety stack:
--   - block filtering via user_blocks (072), at the RPC layer (not RLS — 072's
--     rationale: an RLS reference to user_blocks explodes every read plan).
--   - content_reports gains a 'venue_post' type (admin Reports tab renders it
--     generically — no UI change).
--   - ugc_suspicious() (098) soft-flags suspicious posts on insert (never blocks).
--   - answer notifications route through create_and_send_notification (097), new
--     'venue_board' category.
-- Reads use a paged RPC kept OFF the venue bundle (keeps detail light).

-- 1. content_reports: allow reporting a board post --------------------------
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_content_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_content_type_check
  CHECK (content_type IN ('review', 'venue', 'checkin', 'photo', 'profile', 'venue_post'));

-- 2. Tables ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venue_posts (
  id            bigserial PRIMARY KEY,
  venue_id      integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id     bigint REFERENCES public.venue_posts(id) ON DELETE CASCADE,
  body          text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  helpful_count int NOT NULL DEFAULT 0,
  flagged       boolean NOT NULL DEFAULT false,
  deleted_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_posts_top
  ON public.venue_posts (venue_id, created_at DESC)
  WHERE parent_id IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_venue_posts_parent ON public.venue_posts (parent_id);

CREATE TABLE IF NOT EXISTS public.venue_post_votes (
  post_id    bigint NOT NULL REFERENCES public.venue_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- 3. RLS: insert/read own; the rest flows through SECURITY DEFINER RPCs ------
ALTER TABLE public.venue_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Venue posts insert own" ON public.venue_posts;
CREATE POLICY "Venue posts insert own" ON public.venue_posts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Venue posts read own" ON public.venue_posts;
CREATE POLICY "Venue posts read own" ON public.venue_posts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.venue_post_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Post votes own" ON public.venue_post_votes;
CREATE POLICY "Post votes own" ON public.venue_post_votes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Auto-flag suspicious posts (098 pattern; soft flag, never blocks) -------
CREATE OR REPLACE FUNCTION public.autoflag_suspicious_venue_post()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.ugc_suspicious(NEW.body) THEN
    NEW.flagged := TRUE;
    PERFORM public.log_moderation_action('venue_post_autoflagged', 'venue_post',
      COALESCE(NEW.id::text, 'pending'), jsonb_build_object('venue_id', NEW.venue_id));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS autoflag_suspicious_venue_post ON public.venue_posts;
CREATE TRIGGER autoflag_suspicious_venue_post
  BEFORE INSERT OR UPDATE OF body ON public.venue_posts
  FOR EACH ROW EXECUTE FUNCTION public.autoflag_suspicious_venue_post();

-- 5. Rate limit (047 / 105 pattern) ----------------------------------------
INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('post_venue_message', 'user',   600, 10, '10 board posts per 10 minutes'),
  ('post_venue_message', 'user', 86400, 60, '60 board posts per 24 hours')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_enforce_post_venue_message() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('post_venue_message'); RETURN new; END $$;

DROP TRIGGER IF EXISTS rate_limit_post_venue_message ON public.venue_posts;
CREATE TRIGGER rate_limit_post_venue_message
  BEFORE INSERT ON public.venue_posts
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_post_venue_message();

-- 6. Notification category (extends 097/105; reproduce full body + venue_board)
CREATE OR REPLACE FUNCTION public.notification_category(p_type TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
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
    ELSE NULL
  END;
$$;

-- 7. RPCs ------------------------------------------------------------------
-- Post a question/note (parent_id NULL) or a single-level reply.
CREATE OR REPLACE FUNCTION public.post_venue_message(
  p_venue_id integer,
  p_body text,
  p_parent_id bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id bigint;
  v_parent public.venue_posts;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN RAISE EXCEPTION 'empty body'; END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT * INTO v_parent FROM public.venue_posts WHERE id = p_parent_id;
    IF v_parent.id IS NULL THEN RAISE EXCEPTION 'parent not found'; END IF;
    IF v_parent.parent_id IS NOT NULL THEN RAISE EXCEPTION 'replies are one level deep'; END IF;
    IF v_parent.venue_id <> p_venue_id THEN RAISE EXCEPTION 'parent belongs to another venue'; END IF;
  END IF;

  INSERT INTO public.venue_posts (venue_id, user_id, parent_id, body)
  VALUES (p_venue_id, v_uid, p_parent_id, btrim(p_body))
  RETURNING id INTO v_id;

  -- Notify the asker when someone answers (not on self-reply).
  IF p_parent_id IS NOT NULL AND v_parent.user_id <> v_uid THEN
    SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;
    PERFORM public.create_and_send_notification(
      v_parent.user_id, v_uid, 'venue_post_reply',
      'Răspuns nou',
      COALESCE(v_name, 'Cineva') || ' a răspuns la întrebarea ta.',
      jsonb_build_object('screen', '/venue/' || p_venue_id, 'venueId', p_venue_id)
    );
  END IF;

  RETURN v_id;
END;
$$;

-- Paged board read: top-level posts (newest first) + their replies, excluding
-- flagged posts and authors the caller has blocked (072). Anonymous-safe author
-- display (name + avatar only).
CREATE OR REPLACE FUNCTION public.get_venue_board(p_venue_id integer, p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH blocked AS (
    SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid()
  ),
  tops AS (
    SELECT p.id, p.user_id, p.body, p.helpful_count, p.created_at,
           pr.full_name, pr.avatar_url
    FROM public.venue_posts p
    JOIN public.profiles pr ON pr.id = p.user_id
    WHERE p.venue_id = p_venue_id
      AND p.parent_id IS NULL
      AND p.deleted_at IS NULL
      AND NOT p.flagged
      AND p.user_id NOT IN (SELECT blocked_id FROM blocked)
    ORDER BY p.created_at DESC
    LIMIT GREATEST(p_limit, 1)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'user_id', t.user_id,
    'body', t.body,
    'helpful_count', t.helpful_count,
    'created_at', t.created_at,
    'author_name', t.full_name,
    'author_avatar', t.avatar_url,
    'viewer_voted', EXISTS (SELECT 1 FROM public.venue_post_votes v WHERE v.post_id = t.id AND v.user_id = auth.uid()),
    'replies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'user_id', r.user_id, 'body', r.body, 'created_at', r.created_at,
        'author_name', rp.full_name, 'author_avatar', rp.avatar_url
      ) ORDER BY r.created_at)
      FROM public.venue_posts r
      JOIN public.profiles rp ON rp.id = r.user_id
      WHERE r.parent_id = t.id AND r.deleted_at IS NULL AND NOT r.flagged
        AND r.user_id NOT IN (SELECT blocked_id FROM blocked)
    ), '[]'::jsonb)
  ) ORDER BY t.created_at DESC), '[]'::jsonb)
  FROM tops t;
$$;

-- Toggle a helpful vote; returns the new count.
CREATE OR REPLACE FUNCTION public.toggle_post_helpful(p_post_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid(); v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF EXISTS (SELECT 1 FROM public.venue_post_votes WHERE post_id = p_post_id AND user_id = v_uid) THEN
    DELETE FROM public.venue_post_votes WHERE post_id = p_post_id AND user_id = v_uid;
  ELSE
    INSERT INTO public.venue_post_votes (post_id, user_id) VALUES (p_post_id, v_uid)
    ON CONFLICT DO NOTHING;
  END IF;
  SELECT count(*)::int INTO v_count FROM public.venue_post_votes WHERE post_id = p_post_id;
  UPDATE public.venue_posts SET helpful_count = v_count WHERE id = p_post_id;
  RETURN v_count;
END;
$$;

-- Author soft-delete.
CREATE OR REPLACE FUNCTION public.delete_venue_post(p_post_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.venue_posts SET deleted_at = now()
   WHERE id = p_post_id AND user_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'post not found or not yours'; END IF;
END;
$$;

-- 8. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.post_venue_message(integer, text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_post_helpful(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_venue_post(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_venue_message(integer, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_post_helpful(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_venue_post(bigint) TO authenticated;
-- Board is readable pre-login (venue detail renders anon on web).
REVOKE ALL ON FUNCTION public.get_venue_board(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_board(integer, integer) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
