-- Migration: 121_tournament_brackets (F032)
-- Single-elimination brackets for event_type='tournament'. The organizer seeds
-- a bracket from the RSVP roster (seeded by rating, unrated last, fold pairing
-- so byes fall to the top seeds). Per-tile games also land in the F002 matches
-- table (confirmed) so the competitive layer (F030 ratings / F031 H2H) sees
-- tournament play. Writes go through organizer-gated SECURITY DEFINER RPCs;
-- table RLS is SELECT-only, delegated to can_read_event (087) so bracket
-- visibility tracks event visibility (058).
--
-- Round-robin format is out of scope for v1 (single-elim only).

-- 1. Tables ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_brackets (
  id          bigserial PRIMARY KEY,
  event_id    integer NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  size        integer NOT NULL CHECK (size IN (2, 4, 8, 16, 32)),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete')),
  champion_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tournament_slots (
  id         bigserial PRIMARY KEY,
  bracket_id bigint NOT NULL REFERENCES public.tournament_brackets(id) ON DELETE CASCADE,
  round      integer NOT NULL,
  slot_pos   integer NOT NULL,
  player_a   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  player_b   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sets       jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_id   bigint REFERENCES public.matches(id) ON DELETE SET NULL,
  UNIQUE (bracket_id, round, slot_pos),
  CONSTRAINT slot_winner_is_player CHECK (winner_id IS NULL OR winner_id IN (player_a, player_b))
);
CREATE INDEX IF NOT EXISTS idx_tournament_slots_bracket
  ON public.tournament_slots (bracket_id, round, slot_pos);

-- 2. RLS: SELECT-only, delegated to can_read_event (087). Writes via RPCs. ---
ALTER TABLE public.tournament_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_slots    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brackets readable with parent event" ON public.tournament_brackets;
CREATE POLICY "Brackets readable with parent event" ON public.tournament_brackets
  FOR SELECT USING (public.can_read_event(event_id));

DROP POLICY IF EXISTS "Slots readable with bracket" ON public.tournament_slots;
CREATE POLICY "Slots readable with bracket" ON public.tournament_slots
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.tournament_brackets b
    WHERE b.id = tournament_slots.bracket_id AND public.can_read_event(b.event_id)
  ));

GRANT SELECT ON public.tournament_brackets TO authenticated, anon;
GRANT SELECT ON public.tournament_slots    TO authenticated, anon;

-- 3. Notification category + type allowlist (reproduce full bodies) ---------
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
    'bracket_match_ready'   -- F032
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
    ELSE NULL
  END;
$$;

-- 4. Seed a bracket from the roster (organizer only) -----------------------
CREATE OR REPLACE FUNCTION public.create_tournament_bracket(p_event_id integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_players uuid[];
  v_n int; v_size int; v_rounds int; v_tmp int; v_bid bigint;
  r int; pos int; slots_in_round int;
  v_a uuid; v_b uuid; v_seed_b int; v_next_pos int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT organizer_id INTO v_org FROM public.events WHERE id = p_event_id AND event_type = 'tournament';
  IF v_org IS NULL THEN RAISE EXCEPTION 'tournament event not found'; END IF;
  IF v_org <> v_uid THEN RAISE EXCEPTION 'only the organizer can set up the bracket'; END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_brackets WHERE event_id = p_event_id) THEN
    RAISE EXCEPTION 'bracket already exists';
  END IF;

  -- Seed by rating (unrated last), stable tie-break on join order.
  SELECT array_agg(t.uid ORDER BY t.rating DESC NULLS LAST, t.joined_at, t.uid)
  INTO v_players
  FROM (
    SELECT ep.user_id AS uid, ep.joined_at, pr.rating
    FROM public.event_participants ep
    LEFT JOIN public.player_ratings pr ON pr.user_id = ep.user_id
    WHERE ep.event_id = p_event_id
  ) t;

  v_n := COALESCE(array_length(v_players, 1), 0);
  IF v_n < 2 THEN RAISE EXCEPTION 'need at least 2 participants'; END IF;
  IF v_n > 32 THEN RAISE EXCEPTION 'too many participants (max 32)'; END IF;

  v_size := 2;
  WHILE v_size < v_n LOOP v_size := v_size * 2; END LOOP;
  v_rounds := 0; v_tmp := v_size;
  WHILE v_tmp > 1 LOOP v_rounds := v_rounds + 1; v_tmp := v_tmp / 2; END LOOP;

  INSERT INTO public.tournament_brackets (event_id, size) VALUES (p_event_id, v_size) RETURNING id INTO v_bid;

  -- Create every slot empty (size-1 total).
  FOR r IN 1..v_rounds LOOP
    slots_in_round := (v_size / (2 ^ r))::int;
    FOR pos IN 0..(slots_in_round - 1) LOOP
      INSERT INTO public.tournament_slots (bracket_id, round, slot_pos) VALUES (v_bid, r, pos);
    END LOOP;
  END LOOP;

  -- Fold seeding into round 1 (seed[pos] vs seed[size-1-pos]); byes auto-advance.
  FOR pos IN 0..((v_size / 2) - 1) LOOP
    v_a := v_players[pos + 1];
    v_seed_b := v_size - 1 - pos;
    v_b := CASE WHEN v_seed_b < v_n THEN v_players[v_seed_b + 1] ELSE NULL END;
    UPDATE public.tournament_slots SET player_a = v_a, player_b = v_b
      WHERE bracket_id = v_bid AND round = 1 AND slot_pos = pos;
    IF v_a IS NOT NULL AND v_b IS NULL THEN
      UPDATE public.tournament_slots SET winner_id = v_a
        WHERE bracket_id = v_bid AND round = 1 AND slot_pos = pos;
      v_next_pos := pos / 2;
      UPDATE public.tournament_slots
        SET player_a = CASE WHEN pos % 2 = 0 THEN v_a ELSE player_a END,
            player_b = CASE WHEN pos % 2 = 1 THEN v_a ELSE player_b END
        WHERE bracket_id = v_bid AND round = 2 AND slot_pos = v_next_pos;
    END IF;
  END LOOP;

  RETURN v_bid;
END;
$$;

-- 5. Read the whole bracket in one trip -------------------------------------
CREATE OR REPLACE FUNCTION public.get_tournament_bracket(p_event_id integer)
RETURNS TABLE (
  bracket_id bigint, size integer, bracket_status text,
  champion_id uuid, champion_name text,
  slot_id bigint, round integer, slot_pos integer,
  player_a uuid, player_a_name text,
  player_b uuid, player_b_name text,
  winner_id uuid, sets jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT b.id, b.size, b.status, b.champion_id, cp.full_name,
         s.id, s.round, s.slot_pos,
         s.player_a, pa.full_name, s.player_b, pb.full_name,
         s.winner_id, s.sets
  FROM public.tournament_brackets b
  JOIN public.tournament_slots s ON s.bracket_id = b.id
  LEFT JOIN public.profiles pa ON pa.id = s.player_a
  LEFT JOIN public.profiles pb ON pb.id = s.player_b
  LEFT JOIN public.profiles cp ON cp.id = b.champion_id
  WHERE b.event_id = p_event_id AND public.can_read_event(b.event_id)
  ORDER BY s.round, s.slot_pos;
$$;

-- 6. Report a tile result; advance the winner; feed matches ----------------
CREATE OR REPLACE FUNCTION public.report_tournament_slot(
  p_slot_id bigint, p_winner_id uuid, p_sets jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_slot public.tournament_slots;
  v_bracket public.tournament_brackets;
  v_org uuid; v_rounds int; v_tmp int; v_next_pos int;
  v_next public.tournament_slots;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_slot FROM public.tournament_slots WHERE id = p_slot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'slot not found'; END IF;
  SELECT * INTO v_bracket FROM public.tournament_brackets WHERE id = v_slot.bracket_id;
  SELECT organizer_id INTO v_org FROM public.events WHERE id = v_bracket.event_id;
  IF v_org <> v_uid THEN RAISE EXCEPTION 'only the organizer can report results'; END IF;
  IF v_slot.player_a IS NULL OR v_slot.player_b IS NULL THEN RAISE EXCEPTION 'slot is not ready'; END IF;
  IF p_winner_id NOT IN (v_slot.player_a, v_slot.player_b) THEN RAISE EXCEPTION 'winner must be a slot player'; END IF;

  UPDATE public.tournament_slots SET winner_id = p_winner_id, sets = COALESCE(p_sets, '[]'::jsonb)
    WHERE id = p_slot_id;

  -- Feed the matches table (confirmed → F030 rates it). Rate-limit-safe: a
  -- tripped log_match cap must not block bracket advancement.
  BEGIN
    INSERT INTO public.matches (reporter_id, opponent_id, winner_id, sets, event_id, status, confirmed_at)
    VALUES (v_slot.player_a, v_slot.player_b, p_winner_id, COALESCE(p_sets, '[]'::jsonb),
            v_bracket.event_id, 'confirmed', now());
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  v_rounds := 0; v_tmp := v_bracket.size;
  WHILE v_tmp > 1 LOOP v_rounds := v_rounds + 1; v_tmp := v_tmp / 2; END LOOP;

  IF v_slot.round >= v_rounds THEN
    UPDATE public.tournament_brackets SET status = 'complete', champion_id = p_winner_id
      WHERE id = v_bracket.id;
  ELSE
    v_next_pos := v_slot.slot_pos / 2;
    UPDATE public.tournament_slots
      SET player_a = CASE WHEN v_slot.slot_pos % 2 = 0 THEN p_winner_id ELSE player_a END,
          player_b = CASE WHEN v_slot.slot_pos % 2 = 1 THEN p_winner_id ELSE player_b END
      WHERE bracket_id = v_bracket.id AND round = v_slot.round + 1 AND slot_pos = v_next_pos
      RETURNING * INTO v_next;
    -- Both players known → their next match is ready.
    IF v_next.player_a IS NOT NULL AND v_next.player_b IS NOT NULL THEN
      PERFORM public.create_and_send_notification(
        v_next.player_a, v_uid, 'bracket_match_ready', 'Următorul meci',
        'Meciul tău din turneu e gata.',
        jsonb_build_object('screen', '/(tabs)/events', 'eventId', v_bracket.event_id));
      PERFORM public.create_and_send_notification(
        v_next.player_b, v_uid, 'bracket_match_ready', 'Următorul meci',
        'Meciul tău din turneu e gata.',
        jsonb_build_object('screen', '/(tabs)/events', 'eventId', v_bracket.event_id));
    END IF;
  END IF;
END;
$$;

-- 7. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_tournament_bracket(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tournament_bracket(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.report_tournament_slot(bigint, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_tournament_slot(bigint, uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.get_tournament_bracket(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tournament_bracket(integer) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
