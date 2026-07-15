-- Migration: 136_dm_admin_only
-- Restrict 1:1 direct messages to a STAFF-MEDIATED channel:
--   * Only admins/moderators (public.can_moderate()) may START a conversation
--     — and they may reach any user (the old friend/shared-event eligibility no
--     longer applies to initiation).
--   * A regular user may SEND only into a thread whose OTHER participant is an
--     admin/moderator (i.e. replying to staff). user<->user sends are blocked,
--     including in legacy peer threads created before this rule.
--   * user_blocks is still honored (a mutual block bars messaging both ways),
--     preserving 118's block semantics — only the eligibility gate changed.
--
-- 118's get_or_create_dm_thread + send_dm are the ONLY write paths into
-- dm_threads/dm_messages (no INSERT grants, no INSERT RLS, no other writers), so
-- replacing their gate here is sufficient. 118 is already applied to prod, so we
-- forward CREATE OR REPLACE rather than editing it. can_message() (118) is left
-- in place but is no longer the send/initiate gate — it is now vestigial.
-- can_moderate() reads auth.uid()'s role and is unaffected by SECURITY DEFINER.

-- 1. Initiation: admins/moderators only --------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_dm_thread(p_other uuid)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid(); v_a uuid; v_b uuid; v_id bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_other IS NULL OR p_other = v_uid THEN RAISE EXCEPTION 'cannot_message'; END IF;
  -- Only staff may open a conversation (with any user).
  IF NOT public.can_moderate() THEN RAISE EXCEPTION 'cannot_message'; END IF;
  -- Preserve 118's block semantics: a mutual block bars the conversation.
  IF EXISTS (SELECT 1 FROM public.user_blocks b
             WHERE (b.blocker_id = v_uid AND b.blocked_id = p_other)
                OR (b.blocker_id = p_other AND b.blocked_id = v_uid))
  THEN RAISE EXCEPTION 'cannot_message'; END IF;
  v_a := LEAST(v_uid, p_other);
  v_b := GREATEST(v_uid, p_other);
  INSERT INTO public.dm_threads (user_a, user_b) VALUES (v_a, v_b)
  ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = public.dm_threads.user_a
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 2. Sending: caller is staff, OR the other participant is staff (a reply) -----
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
  -- Preserve 118's block semantics: a mutual block bars sending either way.
  IF EXISTS (SELECT 1 FROM public.user_blocks b
             WHERE (b.blocker_id = v_uid AND b.blocked_id = v_other)
                OR (b.blocker_id = v_other AND b.blocked_id = v_uid))
  THEN RAISE EXCEPTION 'cannot_message'; END IF;
  -- Staff-mediated: send allowed only if YOU are staff, or you are replying to
  -- staff (the other participant is admin/mod). Blocks user<->user (incl. legacy).
  IF NOT (
    public.can_moderate()
    OR EXISTS (SELECT 1 FROM public.profiles p
               WHERE p.id = v_other AND (p.is_admin OR p.is_moderator))
  ) THEN RAISE EXCEPTION 'cannot_message'; END IF;

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

-- 3. Client reply gate: may the caller send in this thread? -------------------
-- Single source of truth mirroring send_dm's authorization, so the UI can show
-- a read-only state instead of an input that would fail. Returns false (never
-- raises) for non-participants / unauthenticated / blocked.
CREATE OR REPLACE FUNCTION public.can_send_in_thread(p_thread_id bigint)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid(); v_t public.dm_threads; v_other uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_t FROM public.dm_threads WHERE id = p_thread_id;
  IF NOT FOUND OR v_uid NOT IN (v_t.user_a, v_t.user_b) THEN RETURN false; END IF;
  v_other := CASE WHEN v_uid = v_t.user_a THEN v_t.user_b ELSE v_t.user_a END;
  IF EXISTS (SELECT 1 FROM public.user_blocks b
             WHERE (b.blocker_id = v_uid AND b.blocked_id = v_other)
                OR (b.blocker_id = v_other AND b.blocked_id = v_uid))
  THEN RETURN false; END IF;
  RETURN public.can_moderate()
      OR EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = v_other AND (p.is_admin OR p.is_moderator));
END;
$$;

REVOKE ALL ON FUNCTION public.can_send_in_thread(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_send_in_thread(bigint) TO authenticated;

NOTIFY pgrst, 'reload schema';
