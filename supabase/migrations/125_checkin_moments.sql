-- Migration: 125_checkin_moments (F042)
-- Session moments: a photo + optional caption attached to a check-in. One moment
-- per check-in (UNIQUE checkin_id). Moments surface in three existing surfaces:
--   - the friend activity feed (get_friend_feed RPC, a THIRD union branch),
--   - the venue detail page via a separate lazy "Recent moments" RPC
--     (get_venue_moments — kept OFF the venue bundle to keep the detail
--     critical path light, the F016/venue-board convention),
--   - the resurrected ActivityFeedScreen.
--
-- Design notes
-- ============
-- - UGC, so it reuses the whole trust & safety stack the way 112 (venue_posts)
--   and 118 (dm_messages) do (these are the line-for-line templates):
--     * content_reports gains a 'checkin_moment' content_type via a full
--       DROP+ADD CHECK reproducing the accumulated 7-value list from 118 and
--       appending — never an in-place edit of a frozen migration.
--     * ugc_suspicious() (098) soft-flags suspicious captions on insert/update
--       (never blocks the write).
--     * rate_limit_config (047) seeds a post_checkin_moment cap with a BEFORE
--       INSERT trigger.
--     * user_blocks (072) filtering happens at the RPC layer (get_venue_moments),
--       NEVER in RLS (072's rationale: an RLS reference to user_blocks explodes
--       every read plan).
-- - Storage: a NEW dedicated 'moments' bucket (separate from venue-photos),
--   mirroring 092's bucket + RLS shape: public read, authenticated owner-stamped
--   uploads under a moments/ prefix with a 20/24h server-side cap inside the
--   INSERT policy, no UPDATE/DELETE (immutable, timestamp-named).
-- - The table is SELECT-only-/insert-own RLS (112 pattern); all public/friend
--   reads flow through SECURITY DEFINER RPCs (get_friend_feed / get_venue_moments)
--   that bypass the read-own RLS.
-- - get_friend_feed (083, frozen — CREATE OR REPLACE here on the CURRENT
--   p_limit signature, NOT 052's uuid[] version) gains a photo_url column on the
--   RETURNS TABLE and a third UNION ALL branch; every branch projects the SAME
--   columns in the SAME order.
-- - F042 adds NO notification type — moments don't push — so notifications.type
--   and notification_category() are intentionally left untouched.

-- 1. Storage: a dedicated 'moments' bucket (mirror 092's defensive guards) ----
-- Bucket creation IS in source control here (092 only reconciled the
-- dashboard-created venue-photos bucket). Insert using only columns that exist
-- on EVERY storage schema version (id, name); set the modern settings
-- (public / file_size_limit / allowed_mime_types) inside a column-existence
-- guard exactly like 092 does — older/scratch storage schemas omit them, and a
-- bare INSERT of those columns errors with "column public does not exist".
INSERT INTO storage.buckets (id, name) VALUES ('moments', 'moments')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'storage' AND table_name = 'buckets'
               AND column_name = 'public') THEN
    UPDATE storage.buckets SET public = true WHERE id = 'moments';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'storage' AND table_name = 'buckets'
               AND column_name = 'file_size_limit') THEN
    UPDATE storage.buckets
       SET file_size_limit = 5242880,
           allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
     WHERE id = 'moments';
  END IF;
END $$;

DROP POLICY IF EXISTS "Public read moments"         ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload moments" ON storage.objects;

CREATE POLICY "Public read moments" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'moments');

CREATE POLICY "Authenticated upload moments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'moments'
    -- App-managed prefix only: moments/<userId>/<file> (second segment exists).
    AND (storage.foldername(name))[1] IN ('moments')
    AND array_length(storage.foldername(name), 1) >= 2
    -- Server-side daily cap (mirrors 092): counts the user's own Storage writes
    -- in the last 24h so skipping the record_image_upload RPC doesn't help.
    AND (
      SELECT count(*) FROM storage.objects o
      WHERE o.bucket_id = 'moments'
        AND o.owner = auth.uid()
        AND o.created_at > now() - interval '24 hours'
    ) < 20
  );
-- No UPDATE/DELETE policies: uploads are immutable (unique timestamped names;
-- upsert: false in the client). Replacing a moment writes a NEW object.

-- 2. content_reports: allow reporting a moment (DROP+ADD full list from 118) --
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_content_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_content_type_check
  CHECK (content_type IN ('review', 'venue', 'checkin', 'photo', 'profile', 'venue_post', 'dm_message', 'checkin_moment'));

-- 3. Tables ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_moments (
  id          bigserial PRIMARY KEY,
  checkin_id  integer NOT NULL UNIQUE REFERENCES public.checkins(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id    integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  photo_url   text NOT NULL,
  caption     text CHECK (caption IS NULL OR char_length(caption) <= 280),
  flagged     boolean NOT NULL DEFAULT false,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Hot read path: latest non-deleted moments for a venue.
CREATE INDEX IF NOT EXISTS idx_checkin_moments_venue
  ON public.checkin_moments (venue_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_checkin_moments_user ON public.checkin_moments (user_id);

-- 4. RLS: insert/read own; public/friend reads flow through DEFINER RPCs ------
ALTER TABLE public.checkin_moments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Checkin moments insert own" ON public.checkin_moments;
CREATE POLICY "Checkin moments insert own" ON public.checkin_moments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Checkin moments read own" ON public.checkin_moments;
CREATE POLICY "Checkin moments read own" ON public.checkin_moments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT ON public.checkin_moments TO authenticated;

-- 5. Auto-flag suspicious captions (098 pattern; soft flag, never blocks) -----
CREATE OR REPLACE FUNCTION public.autoflag_suspicious_checkin_moment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.ugc_suspicious(NEW.caption) THEN
    NEW.flagged := TRUE;
    PERFORM public.log_moderation_action('checkin_moment_autoflagged', 'checkin_moment',
      COALESCE(NEW.id::text, 'pending'), jsonb_build_object('venue_id', NEW.venue_id));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS autoflag_suspicious_checkin_moment ON public.checkin_moments;
CREATE TRIGGER autoflag_suspicious_checkin_moment
  BEFORE INSERT OR UPDATE OF caption ON public.checkin_moments
  FOR EACH ROW EXECUTE FUNCTION public.autoflag_suspicious_checkin_moment();

-- 6. Rate limit (047 / 112 pattern) ----------------------------------------
INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('post_checkin_moment', 'user',   600,  5, '5 moments per 10 minutes'),
  ('post_checkin_moment', 'user', 86400, 30, '30 moments per 24 hours')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_enforce_post_checkin_moment() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('post_checkin_moment'); RETURN new; END $$;

DROP TRIGGER IF EXISTS rate_limit_post_checkin_moment ON public.checkin_moments;
CREATE TRIGGER rate_limit_post_checkin_moment
  BEFORE INSERT ON public.checkin_moments
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_post_checkin_moment();

-- 7. Friend feed: add a photo_url column + a THIRD union branch for moments ---
-- The CURRENT get_friend_feed(p_limit int) lives in 115_open_play.sql (which
-- re-created 083's version with the checkin_visibility privacy gate); it is
-- reproduced here in full and extended. Every UNION ALL branch projects the
-- SAME columns (kind, id, user_id, user_name, venue_id, venue_name, venue_city,
-- rating, ts, photo_url) in the SAME order; checkin/review null out photo_url.
-- Adding the photo_url column changes the RETURNS TABLE shape, so CREATE OR
-- REPLACE alone errors ("cannot change return type"); drop the (int) overload
-- first. This targets ONLY get_friend_feed(int) (115), not the (uuid[], int)
-- compat shim (099).
DROP FUNCTION IF EXISTS public.get_friend_feed(int);
CREATE OR REPLACE FUNCTION public.get_friend_feed(
  p_limit int DEFAULT 30
)
RETURNS TABLE (
  kind         text,
  id           bigint,
  user_id      uuid,
  user_name    text,
  venue_id     int,
  venue_name   text,
  venue_city   text,
  rating       int,
  ts           timestamptz,
  photo_url    text
)
LANGUAGE sql STABLE
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
  feed AS (
    SELECT
      'checkin'::text                AS kind,
      c.id::bigint                   AS id,
      c.user_id                      AS user_id,
      COALESCE(p.full_name, '?')     AS user_name,
      c.venue_id                     AS venue_id,
      COALESCE(v.name, '?')          AS venue_name,
      COALESCE(v.city, '')           AS venue_city,
      NULL::int                      AS rating,
      c.started_at                   AS ts,
      NULL::text                     AS photo_url
    FROM public.checkins c
    JOIN my_friends mf ON mf.friend_id = c.user_id
    JOIN public.profiles p ON p.id = c.user_id
    LEFT JOIN public.venues   v ON v.id = c.venue_id
    -- Preserve 115/091's privacy gate: a friend whose check-ins are 'private'
    -- must NOT have their check-ins surface in the feed. (Reproduced from
    -- 115_open_play.sql:94 — dropping this leaks private-visibility check-ins.)
    WHERE p.checkin_visibility IN ('friends', 'public')

    UNION ALL

    SELECT
      'review'::text                 AS kind,
      r.id::bigint                   AS id,
      r.user_id                      AS user_id,
      COALESCE(r.reviewer_name, '?') AS user_name,
      r.venue_id                     AS venue_id,
      COALESCE(v.name, '?')          AS venue_name,
      ''::text                       AS venue_city,
      r.rating                       AS rating,
      r.created_at                   AS ts,
      NULL::text                     AS photo_url
    FROM public.reviews r
    JOIN my_friends mf ON mf.friend_id = r.user_id
    LEFT JOIN public.venues v ON v.id = r.venue_id

    UNION ALL

    SELECT
      'moment'::text                 AS kind,
      m.id::bigint                   AS id,
      m.user_id                      AS user_id,
      COALESCE(p.full_name, '?')     AS user_name,
      m.venue_id                     AS venue_id,
      COALESCE(v.name, '?')          AS venue_name,
      COALESCE(v.city, '')           AS venue_city,
      NULL::int                      AS rating,
      m.created_at                   AS ts,
      m.photo_url                    AS photo_url
    FROM public.checkin_moments m
    JOIN my_friends mf ON mf.friend_id = m.user_id
    LEFT JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.venues   v ON v.id = m.venue_id
    WHERE m.deleted_at IS NULL AND NOT m.flagged
  )
  SELECT * FROM feed
  ORDER BY ts DESC
  LIMIT GREATEST(COALESCE(p_limit, 30), 1);
$$;

-- 8. RPCs ------------------------------------------------------------------
-- Recent moments for a venue (separate lazy RPC; kept off the venue bundle).
-- Block-filtered at the RPC layer (112 get_venue_board pattern). Anonymous-safe
-- author display (name + avatar + username only).
CREATE OR REPLACE FUNCTION public.get_venue_moments(p_venue_id integer, p_limit integer DEFAULT 12)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH blocked AS (
    SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid()
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
      AND cm.user_id NOT IN (SELECT blocked_id FROM blocked)
    ORDER BY cm.created_at DESC
    LIMIT GREATEST(p_limit, 1)
  ) m
  JOIN public.profiles pr ON pr.id = m.user_id;
$$;

-- Post (or replace) a moment for a check-in the caller owns. One moment per
-- check-in: re-posting REPLACES (ON CONFLICT on the UNIQUE checkin_id).
CREATE OR REPLACE FUNCTION public.post_checkin_moment(
  p_checkin_id integer,
  p_venue_id integer,
  p_photo_url text,
  p_caption text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id bigint;
  v_venue integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_photo_url IS NULL OR btrim(p_photo_url) = '' THEN RAISE EXCEPTION 'empty photo_url'; END IF;

  -- The check-in must belong to the caller; DERIVE the venue from it rather than
  -- trusting p_venue_id (a crafted call could otherwise stamp a moment to a venue
  -- the user never visited — UGC/reputation spoofing that propagates to the venue
  -- strip + friend feed). Mirrors post_venue_message's venue guard (112:137).
  SELECT venue_id INTO v_venue FROM public.checkins WHERE id = p_checkin_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkin not found or not yours';
  END IF;
  IF p_venue_id IS DISTINCT FROM v_venue THEN
    RAISE EXCEPTION 'venue mismatch';
  END IF;

  INSERT INTO public.checkin_moments (checkin_id, user_id, venue_id, photo_url, caption)
  VALUES (p_checkin_id, v_uid, v_venue, p_photo_url, NULLIF(btrim(COALESCE(p_caption, '')), ''))
  ON CONFLICT (checkin_id) DO UPDATE
    SET photo_url  = excluded.photo_url,
        caption    = excluded.caption,
        deleted_at = NULL,
        created_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Author soft-delete.
CREATE OR REPLACE FUNCTION public.delete_checkin_moment(p_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.checkin_moments SET deleted_at = now()
   WHERE id = p_id AND user_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'moment not found or not yours'; END IF;
END;
$$;

-- 9. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.post_checkin_moment(integer, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_checkin_moment(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_checkin_moment(integer, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_checkin_moment(bigint) TO authenticated;
-- Recent moments strip renders on venue detail (authenticated-only lazy RPC).
REVOKE ALL ON FUNCTION public.get_venue_moments(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_moments(integer, integer) TO authenticated;
-- Friend feed grant unchanged (083): authenticated only.
REVOKE ALL ON FUNCTION public.get_friend_feed(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friend_feed(int) TO authenticated;

NOTIFY pgrst, 'reload schema';
