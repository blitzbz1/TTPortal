-- Migration: 116_find_players (F021)
-- Opt-in city directory of players + a Challenge → match-invite → on-accept a
-- private 2-person event. Builds on the real equipment profile (grip / style /
-- handedness, 024/025), check-in activity, and event visibility (058).
--
-- Design notes
-- ============
-- - Discoverability is strictly opt-in: profiles.discoverable defaults FALSE.
-- - find_players is SECURITY DEFINER: it reads other users' profiles +
--   current_equipment + recent check-ins (self+friends-scoped under 084), so it
--   must read past the caller's RLS rows. It excludes self, accepted friends,
--   pending requests (either direction), and blocked users (bidirectional) — all
--   at the RPC layer (072 rationale), never in RLS.
-- - Ratings/“rating proximity” are intentionally NOT joined here — F030 (Elo)
--   isn't built yet. The filter is added once player_ratings lands.
-- - accept_match_invite transactionally spins up a PRIVATE event (058) with both
--   players as participants + an event_invitations row for the invitee, so the
--   existing event-reminder cron covers it for free.
-- - Notifications route through the 097 choke point (new 'match_invites'
--   category); no realtime.

-- 1. profiles.discoverable (opt-in) ----------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.discoverable IS
  'F021: opt-in to appear in the Find Players city directory.';
GRANT SELECT (discoverable) ON public.profiles TO authenticated;
GRANT UPDATE (discoverable) ON public.profiles TO authenticated;

-- 2. partner_preferences ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_preferences (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sought_styles text[] NOT NULL DEFAULT '{}',
  availability  text[] NOT NULL DEFAULT '{}',
  note          text CHECK (note IS NULL OR char_length(note) <= 120),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partner prefs manage own" ON public.partner_preferences;
CREATE POLICY "Partner prefs manage own" ON public.partner_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_preferences TO authenticated;

CREATE OR REPLACE FUNCTION public.set_partner_preferences(
  p_sought_styles text[] DEFAULT '{}',
  p_availability text[] DEFAULT '{}',
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  INSERT INTO public.partner_preferences (user_id, sought_styles, availability, note, updated_at)
  VALUES (v_uid, COALESCE(p_sought_styles, '{}'), COALESCE(p_availability, '{}'),
          NULLIF(btrim(coalesce(p_note, '')), ''), now())
  ON CONFLICT (user_id) DO UPDATE
    SET sought_styles = EXCLUDED.sought_styles,
        availability  = EXCLUDED.availability,
        note          = EXCLUDED.note,
        updated_at     = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.set_discoverable(p_value boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  UPDATE public.profiles SET discoverable = COALESCE(p_value, false) WHERE id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_partner_preferences()
RETURNS TABLE (sought_styles text[], availability text[], note text, discoverable boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(pp.sought_styles, '{}'), COALESCE(pp.availability, '{}'), pp.note,
         COALESCE(p.discoverable, false)
  FROM public.profiles p
  LEFT JOIN public.partner_preferences pp ON pp.user_id = p.id
  WHERE p.id = auth.uid();
$$;

-- 3. find_players directory ------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_players(
  p_city  text DEFAULT NULL,
  p_skill text DEFAULT NULL,
  p_style text DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  user_id uuid, full_name text, avatar_url text, city text, username text,
  skill_level text, play_goals text[],
  grip text, playing_style text, dominant_hand text,
  played_this_week boolean, availability text[], pref_note text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH my_friends AS (
    SELECT CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS uid
    FROM public.friendships f
    WHERE auth.uid() IN (f.requester_id, f.addressee_id)
      AND f.status IN ('accepted', 'pending')
  )
  SELECT p.id, p.full_name, p.avatar_url, p.city, p.username,
         p.skill_level, p.play_goals,
         ce.grip, ce.playing_style, ce.dominant_hand,
         EXISTS (SELECT 1 FROM public.checkins c
                 WHERE c.user_id = p.id AND c.started_at >= now() - interval '7 days') AS played_this_week,
         COALESCE(pp.availability, '{}') AS availability,
         pp.note AS pref_note
  FROM public.profiles p
  LEFT JOIN public.current_equipment ce ON ce.user_id = p.id
  LEFT JOIN public.partner_preferences pp ON pp.user_id = p.id
  WHERE p.discoverable = true
    AND p.id <> auth.uid()
    AND p.id NOT IN (SELECT uid FROM my_friends)
    AND (p_city IS NULL OR p.city = p_city)
    AND (p_skill IS NULL OR p.skill_level = p_skill)
    AND (
      p_style IS NULL
      OR (p_style IN ('attacker', 'defender', 'all_rounder') AND ce.playing_style = p_style)
      OR (p_style = 'penholder' AND ce.grip = 'penhold')
      OR (p_style = 'lefty' AND ce.dominant_hand = 'left')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = auth.uid())
    )
  ORDER BY played_this_week DESC, p.full_name ASC
  LIMIT GREATEST(p_limit, 1);
$$;

-- 4. match_invites ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_invites (
  id          bigserial PRIMARY KEY,
  inviter_id  uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id    integer REFERENCES public.venues(id) ON DELETE SET NULL,
  note        text CHECK (note IS NULL OR char_length(note) <= 120),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  event_id    integer REFERENCES public.events(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT match_invites_distinct CHECK (inviter_id <> invitee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_invite_per_pair
  ON public.match_invites (inviter_id, invitee_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_match_invites_invitee
  ON public.match_invites (invitee_id, status);

ALTER TABLE public.match_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Match invites readable by participants" ON public.match_invites;
CREATE POLICY "Match invites readable by participants" ON public.match_invites
  FOR SELECT TO authenticated USING (auth.uid() IN (inviter_id, invitee_id));
GRANT SELECT ON public.match_invites TO authenticated;

-- Rate limit (047): 5 challenges/day.
INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('send_match_invite', 'user', 86400, 5, '5 challenges per day')
ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.trg_enforce_send_match_invite() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('send_match_invite'); RETURN new; END $$;
DROP TRIGGER IF EXISTS rate_limit_send_match_invite ON public.match_invites;
CREATE TRIGGER rate_limit_send_match_invite
  BEFORE INSERT ON public.match_invites
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_send_match_invite();

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
    'match_invite', 'match_invite_accepted'   -- F021
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
    ELSE NULL
  END;
$$;

-- 6. Invite RPCs -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_match_invite(
  p_invitee_id uuid,
  p_venue_id integer DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid(); v_id bigint; v_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_invitee_id = v_uid THEN RAISE EXCEPTION 'cannot challenge yourself'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = v_uid AND b.blocked_id = p_invitee_id)
       OR (b.blocker_id = p_invitee_id AND b.blocked_id = v_uid)
  ) THEN RAISE EXCEPTION 'blocked'; END IF;

  INSERT INTO public.match_invites (inviter_id, invitee_id, venue_id, note)
  VALUES (v_uid, p_invitee_id, p_venue_id, NULLIF(btrim(coalesce(p_note, '')), ''))
  RETURNING id INTO v_id;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;
  PERFORM public.create_and_send_notification(
    p_invitee_id, v_uid, 'match_invite',
    'Provocare la joc',
    COALESCE(v_name, 'Cineva') || ' vrea să joace un meci.',
    jsonb_build_object('screen', '/(protected)/friends', 'inviteId', v_id)
  );
  RETURN v_id;
END;
$$;

-- Accept → transactional private 2-person event.
CREATE OR REPLACE FUNCTION public.accept_match_invite(p_invite_id bigint)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.match_invites;
  v_event_id integer;
  v_venue_name text;
  v_starts timestamptz := date_trunc('hour', now()) + interval '1 day';
  v_invitee_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_inv FROM public.match_invites WHERE id = p_invite_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'invite not found or not pending'; END IF;
  IF v_inv.invitee_id <> v_uid THEN RAISE EXCEPTION 'only the invitee can accept'; END IF;

  SELECT name INTO v_venue_name FROM public.venues WHERE id = v_inv.venue_id;

  INSERT INTO public.events (title, organizer_id, venue_id, starts_at, ends_at,
                             status, event_type, visibility)
  VALUES (COALESCE(v_venue_name, 'Match'), v_inv.inviter_id, v_inv.venue_id,
          v_starts, v_starts + interval '2 hours', 'open', 'casual', 'private')
  RETURNING id INTO v_event_id;

  INSERT INTO public.event_participants (event_id, user_id) VALUES
    (v_event_id, v_inv.inviter_id), (v_event_id, v_inv.invitee_id)
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- Private visibility: the non-organizer (invitee) needs an invitation row.
  INSERT INTO public.event_invitations (event_id, user_id, invited_by)
  VALUES (v_event_id, v_inv.invitee_id, v_inv.inviter_id)
  ON CONFLICT (event_id, user_id) DO NOTHING;

  UPDATE public.match_invites
    SET status = 'accepted', event_id = v_event_id, responded_at = now()
    WHERE id = p_invite_id;

  SELECT full_name INTO v_invitee_name FROM public.profiles WHERE id = v_uid;
  PERFORM public.create_and_send_notification(
    v_inv.inviter_id, v_uid, 'match_invite_accepted',
    'Provocare acceptată',
    COALESCE(v_invitee_name, 'Cineva') || ' a acceptat meciul.',
    jsonb_build_object('screen', '/(tabs)/events', 'eventId', v_event_id)
  );
  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_match_invite(p_invite_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  UPDATE public.match_invites SET status = 'declined', responded_at = now()
   WHERE id = p_invite_id AND invitee_id = v_uid AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'invite not found or not pending'; END IF;
END;
$$;

-- Pending invites addressed to the caller (for the inbox inline card).
CREATE OR REPLACE FUNCTION public.get_pending_match_invites()
RETURNS TABLE (id bigint, inviter_id uuid, inviter_name text, venue_id integer, venue_name text, note text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT mi.id, mi.inviter_id, p.full_name, mi.venue_id, v.name, mi.note, mi.created_at
  FROM public.match_invites mi
  JOIN public.profiles p ON p.id = mi.inviter_id
  LEFT JOIN public.venues v ON v.id = mi.venue_id
  WHERE mi.invitee_id = auth.uid() AND mi.status = 'pending'
  ORDER BY mi.created_at DESC;
$$;

-- 7. Expiry sweep (frees the one-pending-per-pair guard) --------------------
CREATE OR REPLACE FUNCTION public.expire_match_invites()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_count int;
BEGIN
  WITH upd AS (
    UPDATE public.match_invites SET status = 'expired'
     WHERE status = 'pending' AND created_at < now() - interval '14 days' RETURNING 1
  ) SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_match_invites() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'expire_match_invites';
    PERFORM cron.schedule('expire_match_invites', '47 3 * * *',
      $cron$SELECT public.expire_match_invites()$cron$);
  ELSE
    RAISE NOTICE 'pg_cron unavailable — expire match_invites externally (daily).';
  END IF;
END $$;

-- 8. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_partner_preferences(text[], text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_partner_preferences(text[], text[], text) TO authenticated;
REVOKE ALL ON FUNCTION public.set_discoverable(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_discoverable(boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.get_partner_preferences() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_preferences() TO authenticated;
REVOKE ALL ON FUNCTION public.find_players(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_players(text, text, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.send_match_invite(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_match_invite(uuid, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.accept_match_invite(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_match_invite(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.decline_match_invite(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_match_invite(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.get_pending_match_invites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_match_invites() TO authenticated;

NOTIFY pgrst, 'reload schema';
