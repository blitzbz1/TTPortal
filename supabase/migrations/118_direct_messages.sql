-- Migration: 118_direct_messages (F023)
-- 1:1 partner chat. Push + fetch-on-focus only — NO realtime (notifications are
-- excluded from supabase_realtime, 055; threads/messages follow the same rule).
--
-- Design notes
-- ============
-- - can_message(): you may DM someone only if you're accepted friends OR share
--   an event, AND neither has blocked the other. Enforced on thread creation
--   AND on every send (a block mid-conversation stops it).
-- - Threads store a canonical (user_a < user_b) pair so the UNIQUE constraint
--   dedupes regardless of who starts. Per-side last_read timestamps drive unread
--   counts without a per-message read table.
-- - Reads go through SECURITY DEFINER RPCs (also block-filtered); RLS additionally
--   scopes raw rows to participants. Block filtering stays at the RPC layer (072).
-- - Messages route through the 097 choke point (new 'messages' category);
--   reportable as 'dm_message' (072) + ugc_suspicious soft-flag (098).

-- 1. content_reports: allow reporting a DM --------------------------------
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_content_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_content_type_check
  CHECK (content_type IN ('review','venue','checkin','photo','profile','venue_post','dm_message'));

-- 2. Tables ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dm_threads (
  id             bigserial PRIMARY KEY,
  user_a         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  a_last_read_at timestamptz,
  b_last_read_at timestamptz,
  CONSTRAINT dm_threads_ordered CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id         bigserial PRIMARY KEY,
  thread_id  bigint NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  flagged    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dm_messages_thread ON public.dm_messages (thread_id, created_at DESC);

-- 3. RLS: participants read; writes go through SECURITY DEFINER RPCs --------
ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DM threads readable by participants" ON public.dm_threads;
CREATE POLICY "DM threads readable by participants" ON public.dm_threads
  FOR SELECT TO authenticated USING (auth.uid() IN (user_a, user_b));
GRANT SELECT ON public.dm_threads TO authenticated;

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "DM messages readable by participants" ON public.dm_messages;
CREATE POLICY "DM messages readable by participants" ON public.dm_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.dm_threads t
            WHERE t.id = dm_messages.thread_id AND auth.uid() IN (t.user_a, t.user_b))
  );
GRANT SELECT ON public.dm_messages TO authenticated;

-- 4. UGC soft-flag (098) + rate limit (047) --------------------------------
CREATE OR REPLACE FUNCTION public.autoflag_suspicious_dm_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.ugc_suspicious(NEW.body) THEN
    NEW.flagged := TRUE;
    PERFORM public.log_moderation_action('dm_message_autoflagged', 'dm_message',
      COALESCE(NEW.id::text, 'pending'), jsonb_build_object('thread_id', NEW.thread_id));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS autoflag_suspicious_dm_message ON public.dm_messages;
CREATE TRIGGER autoflag_suspicious_dm_message
  BEFORE INSERT OR UPDATE OF body ON public.dm_messages
  FOR EACH ROW EXECUTE FUNCTION public.autoflag_suspicious_dm_message();

INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('send_dm', 'user',  3600, 120, '120 messages per hour'),
  ('send_dm', 'user', 86400, 600, '600 messages per day')
ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.trg_enforce_send_dm() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('send_dm'); RETURN new; END $$;
DROP TRIGGER IF EXISTS rate_limit_send_dm ON public.dm_messages;
CREATE TRIGGER rate_limit_send_dm
  BEFORE INSERT ON public.dm_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_send_dm();

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
    'play_broadcast', 'play_join', 'play_converted',
    'match_invite', 'match_invite_accepted',
    'dm_message'   -- F023
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
    ELSE NULL
  END;
$$;

-- 6. can_message gate ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_message(p_other uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_other IS NULL OR p_other = v_uid THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = v_uid AND b.blocked_id = p_other)
       OR (b.blocker_id = p_other AND b.blocked_id = v_uid)
  ) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = v_uid AND f.addressee_id = p_other)
        OR (f.addressee_id = v_uid AND f.requester_id = p_other))
  ) THEN RETURN true; END IF;
  IF EXISTS (
    SELECT 1 FROM public.event_participants e1
    JOIN public.event_participants e2 ON e1.event_id = e2.event_id
    WHERE e1.user_id = v_uid AND e2.user_id = p_other
  ) THEN RETURN true; END IF;
  RETURN false;
END;
$$;

-- 7. RPCs ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_dm_thread(p_other uuid)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid(); v_a uuid; v_b uuid; v_id bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT public.can_message(p_other) THEN RAISE EXCEPTION 'cannot_message'; END IF;
  v_a := LEAST(v_uid, p_other);
  v_b := GREATEST(v_uid, p_other);
  INSERT INTO public.dm_threads (user_a, user_b) VALUES (v_a, v_b)
  ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = public.dm_threads.user_a
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_dm(p_thread_id bigint, p_body text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_t public.dm_threads;
  v_other uuid;
  v_id bigint;
  v_name text;
  v_preview text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN RAISE EXCEPTION 'empty message'; END IF;
  SELECT * INTO v_t FROM public.dm_threads WHERE id = p_thread_id;
  IF NOT FOUND OR v_uid NOT IN (v_t.user_a, v_t.user_b) THEN RAISE EXCEPTION 'not a participant'; END IF;
  v_other := CASE WHEN v_uid = v_t.user_a THEN v_t.user_b ELSE v_t.user_a END;
  IF NOT public.can_message(v_other) THEN RAISE EXCEPTION 'cannot_message'; END IF;

  INSERT INTO public.dm_messages (thread_id, sender_id, body)
  VALUES (p_thread_id, v_uid, btrim(p_body)) RETURNING id INTO v_id;
  UPDATE public.dm_threads SET last_message_at = now() WHERE id = p_thread_id;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;
  v_preview := CASE WHEN char_length(btrim(p_body)) > 80
                    THEN substring(btrim(p_body) FROM 1 FOR 80) || '…'
                    ELSE btrim(p_body) END;
  PERFORM public.create_and_send_notification(
    v_other, v_uid, 'dm_message',
    COALESCE(v_name, 'Mesaj nou'), v_preview,
    jsonb_build_object('screen', '/(protected)/messages', 'threadId', p_thread_id)
  );
  RETURN v_id;
END;
$$;

-- Thread list with other-user, last preview, unread count (block-filtered).
CREATE OR REPLACE FUNCTION public.get_dm_threads()
RETURNS TABLE (
  thread_id bigint, other_id uuid, other_name text, other_avatar text,
  last_message text, last_message_at timestamptz, unread_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT t.id,
         CASE WHEN auth.uid() = t.user_a THEN t.user_b ELSE t.user_a END AS other_id,
         p.full_name, p.avatar_url,
         (SELECT m.body FROM public.dm_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1),
         t.last_message_at,
         (SELECT count(*)::int FROM public.dm_messages m
          WHERE m.thread_id = t.id AND m.sender_id <> auth.uid()
            AND m.created_at > COALESCE(
              CASE WHEN auth.uid() = t.user_a THEN t.a_last_read_at ELSE t.b_last_read_at END,
              '-infinity'::timestamptz))
  FROM public.dm_threads t
  JOIN public.profiles p ON p.id = CASE WHEN auth.uid() = t.user_a THEN t.user_b ELSE t.user_a END
  WHERE auth.uid() IN (t.user_a, t.user_b)
    AND t.last_message_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    )
  ORDER BY t.last_message_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_dm_messages(p_thread_id bigint, p_limit integer DEFAULT 50)
RETURNS TABLE (id bigint, sender_id uuid, body text, created_at timestamptz, is_mine boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT m.id, m.sender_id, m.body, m.created_at, m.sender_id = auth.uid()
  FROM public.dm_messages m
  JOIN public.dm_threads t ON t.id = m.thread_id
  WHERE m.thread_id = p_thread_id
    AND auth.uid() IN (t.user_a, t.user_b)
  ORDER BY m.created_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.mark_dm_thread_read(p_thread_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  UPDATE public.dm_threads
    SET a_last_read_at = CASE WHEN user_a = v_uid THEN now() ELSE a_last_read_at END,
        b_last_read_at = CASE WHEN user_b = v_uid THEN now() ELSE b_last_read_at END
    WHERE id = p_thread_id AND v_uid IN (user_a, user_b);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_dm_count()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(sum(c), 0)::int FROM (
    SELECT (SELECT count(*) FROM public.dm_messages m
            WHERE m.thread_id = t.id AND m.sender_id <> auth.uid()
              AND m.created_at > COALESCE(
                CASE WHEN auth.uid() = t.user_a THEN t.a_last_read_at ELSE t.b_last_read_at END,
                '-infinity'::timestamptz)) AS c
    FROM public.dm_threads t
    WHERE auth.uid() IN (t.user_a, t.user_b)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = CASE WHEN auth.uid()=t.user_a THEN t.user_b ELSE t.user_a END)
           OR (b.blocker_id = CASE WHEN auth.uid()=t.user_a THEN t.user_b ELSE t.user_a END AND b.blocked_id = auth.uid())
      )
  ) s;
$$;

-- 8. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.can_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_message(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_or_create_dm_thread(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_thread(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.send_dm(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_dm(bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_dm_threads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dm_threads() TO authenticated;
REVOKE ALL ON FUNCTION public.get_dm_messages(bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dm_messages(bigint, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.mark_dm_thread_read(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_dm_thread_read(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.get_unread_dm_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_dm_count() TO authenticated;

NOTIFY pgrst, 'reload schema';
