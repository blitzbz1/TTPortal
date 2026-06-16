-- Migration: 122_city_ladder (F033)
-- City ladder with quarterly seasons. Ranks players within a city by their
-- F030 Elo rating, gated on ≥5 confirmed matches this season ("placement").
-- A pg_cron rollover closes the active season, snapshots final standings
-- (season_results → permanent top-3 trophies), opens the next quarter, and
-- notifies the top finishers. Builds on confirmed matches (105) + ratings (119).
--
-- Design notes
-- ============
-- - get_city_ladder is SECURITY DEFINER (reads past the participant-only match
--   RLS to rank all players) and returns the 040/leaderboard row shape
--   (user_id, full_name, rank, score) so it drops into the existing client.
-- - Seasons are global quarters; the ladder is sliced per city at read time.

-- 1. Tables ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ladder_seasons (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ladder_seasons_window CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_ladder_seasons_window ON public.ladder_seasons (starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.season_results (
  id         bigserial PRIMARY KEY,
  season_id  bigint NOT NULL REFERENCES public.ladder_seasons(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city       text,
  rank       integer NOT NULL,
  rating     integer NOT NULL,
  wins       integer NOT NULL,
  played     integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_season_results_user ON public.season_results (user_id, rank);

ALTER TABLE public.ladder_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Seasons readable by all" ON public.ladder_seasons;
CREATE POLICY "Seasons readable by all" ON public.ladder_seasons
  FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Season results readable by all" ON public.season_results;
CREATE POLICY "Season results readable by all" ON public.season_results
  FOR SELECT TO authenticated, anon USING (true);
GRANT SELECT ON public.ladder_seasons TO authenticated, anon;
GRANT SELECT ON public.season_results TO authenticated, anon;

-- Seed the current quarter so the ladder works immediately.
INSERT INTO public.ladder_seasons (name, starts_at, ends_at)
SELECT 'Q' || extract(quarter FROM now())::int || ' ' || extract(year FROM now())::int,
       date_trunc('quarter', now()), date_trunc('quarter', now()) + interval '3 months'
WHERE NOT EXISTS (SELECT 1 FROM public.ladder_seasons WHERE now() >= starts_at AND now() < ends_at);

-- 2. Notification category + type allowlist (reproduce full bodies) ---------
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
    'season_ended'   -- F033
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
    ELSE NULL
  END;
$$;

-- 3. Current-season helper -------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_ladder_season()
RETURNS public.ladder_seasons
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.ladder_seasons
  WHERE now() >= starts_at AND now() < ends_at
  ORDER BY starts_at DESC LIMIT 1;
$$;

-- 4. The ladder (Elo-ranked, ≥5-match placement gate) ----------------------
CREATE OR REPLACE FUNCTION public.get_city_ladder(
  p_city text DEFAULT NULL,
  p_season_id bigint DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  user_id uuid, full_name text, avatar_url text, city text,
  played bigint, wins bigint, rating integer, rank integer, score integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH season AS (
    SELECT COALESCE(
      (SELECT s FROM public.ladder_seasons s WHERE s.id = p_season_id),
      public.current_ladder_season()
    ) AS s
  ),
  played AS (
    SELECT pl.id AS user_id, pl.full_name, pl.avatar_url, pl.city,
           count(*) AS played,
           count(*) FILTER (WHERE m.winner_id = pl.id) AS wins
    FROM public.profiles pl
    JOIN public.matches m ON (m.reporter_id = pl.id OR m.opponent_id = pl.id), season
    WHERE m.status = 'confirmed' AND m.winner_id IS NOT NULL
      AND m.created_at >= (season.s).starts_at AND m.created_at < (season.s).ends_at
      AND (p_city IS NULL OR pl.city = p_city)
    GROUP BY pl.id, pl.full_name, pl.avatar_url, pl.city
    HAVING count(*) >= 5
  )
  SELECT pd.user_id, pd.full_name, pd.avatar_url, pd.city, pd.played, pd.wins,
         COALESCE(pr.rating, 1200) AS rating,
         (ROW_NUMBER() OVER (ORDER BY COALESCE(pr.rating, 1200) DESC, pd.wins DESC))::int AS rank,
         COALESCE(pr.rating, 1200) AS score
  FROM played pd
  LEFT JOIN public.player_ratings pr ON pr.user_id = pd.user_id
  ORDER BY rating DESC, pd.wins DESC
  LIMIT GREATEST(p_limit, 1);
$$;

-- The caller's own placement progress (X / 5) + rank when placed.
CREATE OR REPLACE FUNCTION public.get_my_ladder_standing(p_city text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_played int; v_rank int; v_season public.ladder_seasons;
BEGIN
  v_season := public.current_ladder_season();
  IF v_season IS NULL THEN RETURN jsonb_build_object('played', 0, 'placed', false, 'needed', 5); END IF;
  SELECT count(*) INTO v_played FROM public.matches m
    WHERE m.status = 'confirmed' AND m.winner_id IS NOT NULL
      AND auth.uid() IN (m.reporter_id, m.opponent_id)
      AND m.created_at >= v_season.starts_at AND m.created_at < v_season.ends_at;
  IF v_played >= 5 THEN
    SELECT l.rank INTO v_rank FROM public.get_city_ladder(p_city, v_season.id, 1000) l WHERE l.user_id = auth.uid();
  END IF;
  RETURN jsonb_build_object('played', v_played, 'placed', v_played >= 5, 'rank', v_rank,
                            'needed', 5, 'season', v_season.name);
END;
$$;

-- 5. Quarterly rollover (pg_cron) ------------------------------------------
CREATE OR REPLACE FUNCTION public.rollover_ladder_seasons()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_season public.ladder_seasons;
  v_count int := 0;
  r record;
BEGIN
  SELECT * INTO v_season FROM public.ladder_seasons
    WHERE now() >= ends_at ORDER BY ends_at DESC LIMIT 1;
  IF v_season IS NULL THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.season_results WHERE season_id = v_season.id) THEN RETURN 0; END IF; -- already rolled

  -- Snapshot final standings per city (placed players only).
  INSERT INTO public.season_results (season_id, user_id, city, rank, rating, wins, played)
  SELECT v_season.id, rk.user_id, rk.city, rk.rank, rk.rating, rk.wins, rk.played
  FROM (
    SELECT pl.id AS user_id, pl.city, COALESCE(pr.rating, 1200) AS rating,
           count(*) FILTER (WHERE m.winner_id = pl.id) AS wins,
           count(*) AS played,
           ROW_NUMBER() OVER (PARTITION BY pl.city ORDER BY COALESCE(pr.rating, 1200) DESC,
                              count(*) FILTER (WHERE m.winner_id = pl.id) DESC)::int AS rank
    FROM public.profiles pl
    JOIN public.matches m ON (m.reporter_id = pl.id OR m.opponent_id = pl.id)
    LEFT JOIN public.player_ratings pr ON pr.user_id = pl.id
    WHERE m.status = 'confirmed' AND m.winner_id IS NOT NULL AND pl.city IS NOT NULL
      AND m.created_at >= v_season.starts_at AND m.created_at < v_season.ends_at
    GROUP BY pl.id, pl.city, pr.rating
    HAVING count(*) >= 5
  ) rk;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Notify top-3 per city.
  FOR r IN SELECT user_id FROM public.season_results WHERE season_id = v_season.id AND rank <= 3 LOOP
    PERFORM public.create_and_send_notification(
      r.user_id, NULL, 'season_ended',
      'Sezon încheiat', 'Clasamentul sezonului s-a închis — vezi unde ai terminat.',
      jsonb_build_object('screen', '/(protected)/leaderboard'));
  END LOOP;

  -- Open the next quarter if none is currently active.
  INSERT INTO public.ladder_seasons (name, starts_at, ends_at)
  SELECT 'Q' || extract(quarter FROM v_season.ends_at)::int || ' ' || extract(year FROM v_season.ends_at)::int,
         v_season.ends_at, v_season.ends_at + interval '3 months'
  WHERE NOT EXISTS (SELECT 1 FROM public.ladder_seasons WHERE now() >= starts_at AND now() < ends_at);

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.rollover_ladder_seasons() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rollover_ladder_seasons';
    PERFORM cron.schedule('rollover_ladder_seasons', '53 4 * * *',
      $cron$SELECT public.rollover_ladder_seasons()$cron$);
  ELSE
    RAISE NOTICE 'pg_cron unavailable — roll over ladder seasons externally (daily).';
  END IF;
END $$;

-- 6. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.current_ladder_season() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_ladder_season() TO authenticated, anon;
REVOKE ALL ON FUNCTION public.get_city_ladder(text, bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_city_ladder(text, bigint, integer) TO authenticated, anon;
REVOKE ALL ON FUNCTION public.get_my_ladder_standing(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_ladder_standing(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
