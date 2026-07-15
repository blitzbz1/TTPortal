-- Migration: 105_matches (F002)
-- Peer-confirmed match recording — the primitive the competitive layer
-- (ratings, head-to-head, ladders, brackets) builds on. Confirm/dispute model
-- mirrors the half-built challenge-validation flow (094). Notifications go
-- through the 097 choke point (create_and_send_notification); a new 'matches'
-- category is registered so the preference center can gate them.

-- 1. Table -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matches (
  id            bigserial PRIMARY KEY,
  reporter_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  winner_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sets          jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{"a":11,"b":9}, ...]
  venue_id      integer REFERENCES public.venues(id) ON DELETE SET NULL,
  event_id      integer REFERENCES public.events(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'disputed', 'void')),
  dispute_count int NOT NULL DEFAULT 0,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz,
  CONSTRAINT matches_distinct_players CHECK (reporter_id <> opponent_id),
  CONSTRAINT matches_winner_is_player CHECK (winner_id IS NULL OR winner_id IN (reporter_id, opponent_id))
);

CREATE INDEX IF NOT EXISTS idx_matches_reporter ON public.matches(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_opponent ON public.matches(opponent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_pending ON public.matches(status) WHERE status = 'pending';

-- 2. RLS: participant-only SELECT; writes go through the SECURITY DEFINER RPCs.
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Matches readable by participants" ON public.matches;
CREATE POLICY "Matches readable by participants" ON public.matches
  FOR SELECT TO authenticated
  USING (auth.uid() IN (reporter_id, opponent_id));
GRANT SELECT ON public.matches TO authenticated;

-- 3. Rate limit (047 pattern): cap match logging.
INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('log_match', 'user',   600, 15, '15 match logs per 10 minutes'),
  ('log_match', 'user', 86400, 60, '60 match logs per 24 hours')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_enforce_log_match() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('log_match'); RETURN new; END $$;

DROP TRIGGER IF EXISTS rate_limit_log_match ON public.matches;
CREATE TRIGGER rate_limit_log_match
  BEFORE INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_log_match();

-- 4. Notification category (extends 097; unmapped types fail-open, but a real
--    category lets users mute match prompts). Full body reproduced + matches.
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
    ELSE NULL
  END;
$$;

-- 5. RPCs ------------------------------------------------------------------
-- Log a match (reporter = caller). Insert is pending until the opponent acts.
CREATE OR REPLACE FUNCTION public.log_match(
  p_opponent_id uuid,
  p_sets jsonb DEFAULT '[]'::jsonb,
  p_winner_id uuid DEFAULT NULL,
  p_venue_id integer DEFAULT NULL,
  p_event_id integer DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reporter uuid := auth.uid();
  v_match public.matches;
  v_reporter_name text;
BEGIN
  IF v_reporter IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_opponent_id = v_reporter THEN RAISE EXCEPTION 'cannot log a match against yourself'; END IF;
  IF p_winner_id IS NOT NULL AND p_winner_id NOT IN (v_reporter, p_opponent_id) THEN
    RAISE EXCEPTION 'winner must be one of the two players';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_opponent_id) THEN
    RAISE EXCEPTION 'opponent not found';
  END IF;

  INSERT INTO public.matches (reporter_id, opponent_id, winner_id, sets, venue_id, event_id, note)
  VALUES (v_reporter, p_opponent_id, p_winner_id, COALESCE(p_sets, '[]'::jsonb), p_venue_id, p_event_id, p_note)
  RETURNING * INTO v_match;

  SELECT full_name INTO v_reporter_name FROM public.profiles WHERE id = v_reporter;
  PERFORM public.create_and_send_notification(
    p_opponent_id, v_reporter, 'match_confirm',
    'Confirmă meciul',
    COALESCE(v_reporter_name, 'Cineva') || ' a înregistrat un meci cu tine.',
    jsonb_build_object('screen', '/(tabs)/profile', 'matchId', v_match.id)
  );
  RETURN v_match;
END;
$$;

-- Opponent confirms a pending match.
CREATE OR REPLACE FUNCTION public.confirm_match(p_match_id bigint)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_match public.matches; v_name text;
BEGIN
  UPDATE public.matches
     SET status = 'confirmed', confirmed_at = now()
   WHERE id = p_match_id AND opponent_id = auth.uid() AND status = 'pending'
   RETURNING * INTO v_match;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found or not pending for you'; END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();
  PERFORM public.create_and_send_notification(
    v_match.reporter_id, auth.uid(), 'match_confirmed',
    'Meci confirmat',
    COALESCE(v_name, 'Cineva') || ' a confirmat meciul.',
    jsonb_build_object('screen', '/(tabs)/profile', 'matchId', v_match.id)
  );
  RETURN v_match;
END;
$$;

-- Opponent disputes. First dispute -> 'disputed'; a second -> 'void'.
CREATE OR REPLACE FUNCTION public.dispute_match(p_match_id bigint)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_match public.matches; v_name text; v_new_status text;
BEGIN
  SELECT * INTO v_match FROM public.matches
   WHERE id = p_match_id AND opponent_id = auth.uid() AND status IN ('pending', 'disputed')
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found or not disputable for you'; END IF;

  v_new_status := CASE WHEN v_match.dispute_count + 1 >= 2 THEN 'void' ELSE 'disputed' END;
  UPDATE public.matches
     SET status = v_new_status, dispute_count = dispute_count + 1
   WHERE id = p_match_id
   RETURNING * INTO v_match;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();
  PERFORM public.create_and_send_notification(
    v_match.reporter_id, auth.uid(), 'match_disputed',
    'Meci contestat',
    COALESCE(v_name, 'Cineva') || ' a contestat meciul.',
    jsonb_build_object('screen', '/(tabs)/profile', 'matchId', v_match.id)
  );
  RETURN v_match;
END;
$$;

-- A user's match history. Confirmed matches are public; pending/disputed are
-- visible only to the two participants.
CREATE OR REPLACE FUNCTION public.get_player_matches(p_user_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE (
  id bigint, reporter_id uuid, opponent_id uuid, winner_id uuid,
  sets jsonb, venue_id integer, event_id integer, status text,
  created_at timestamptz, confirmed_at timestamptz,
  reporter_name text, opponent_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.id, m.reporter_id, m.opponent_id, m.winner_id, m.sets, m.venue_id, m.event_id,
         m.status, m.created_at, m.confirmed_at,
         rp.full_name AS reporter_name, op.full_name AS opponent_name
  FROM public.matches m
  JOIN public.profiles rp ON rp.id = m.reporter_id
  JOIN public.profiles op ON op.id = m.opponent_id
  WHERE (m.reporter_id = p_user_id OR m.opponent_id = p_user_id)
    AND (m.status = 'confirmed' OR auth.uid() IN (m.reporter_id, m.opponent_id))
  ORDER BY m.created_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

-- Matches awaiting the caller's confirmation (drives the inbox inline card).
CREATE OR REPLACE FUNCTION public.get_pending_matches()
RETURNS TABLE (
  id bigint, reporter_id uuid, opponent_id uuid, winner_id uuid,
  sets jsonb, created_at timestamptz, reporter_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.id, m.reporter_id, m.opponent_id, m.winner_id, m.sets, m.created_at, rp.full_name
  FROM public.matches m
  JOIN public.profiles rp ON rp.id = m.reporter_id
  WHERE m.opponent_id = auth.uid() AND m.status = 'pending'
  ORDER BY m.created_at DESC;
$$;

-- 6. Auto-confirm matches the opponent ignored for 72h.
CREATE OR REPLACE FUNCTION public.auto_confirm_stale_matches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count int;
BEGIN
  WITH upd AS (
    UPDATE public.matches
       SET status = 'confirmed', confirmed_at = now()
     WHERE status = 'pending' AND created_at < now() - INTERVAL '72 hours'
     RETURNING 1
  ) SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto_confirm_stale_matches';
    PERFORM cron.schedule(
      'auto_confirm_stale_matches',
      '17 * * * *',  -- hourly at :17
      $cron$SELECT public.auto_confirm_stale_matches()$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron unavailable — schedule auto_confirm_stale_matches() externally (hourly).';
  END IF;
END $$;

-- 7. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.log_match(uuid, jsonb, uuid, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_match(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispute_match(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pending_matches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_match(uuid, jsonb, uuid, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_match(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispute_match(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_matches() TO authenticated;
-- Match history is public (confirmed only for non-participants).
GRANT EXECUTE ON FUNCTION public.get_player_matches(uuid, integer) TO authenticated, anon;
