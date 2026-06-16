-- Migration: 119_match_ratings (F030)
-- Deterministic Elo rating derived from CONFIRMED matches (105). No ML.
--
-- Design notes
-- ============
-- - Confirmation happens in TWO inline code paths with no existing trigger:
--   confirm_match (RPC) and auto_confirm_stale_matches (set-based cron UPDATE).
--   F032 bracket games are also inserted into matches already-confirmed. So the
--   only place that catches every "becomes confirmed" event is an
--   AFTER INSERT OR UPDATE trigger on matches → apply_match_rating per row.
-- - Per-player K-factor: 40 while provisional (<10 rated matches), else 20.
-- - apply_match_rating is idempotent (rating_history UNIQUE(user_id,match_id));
--   a confirmed→void transition triggers a full deterministic recompute (replay
--   all confirmed matches in confirmed_at order) so dispute reversals stay exact.
-- - Ratings are public read (drive profile chips/sparklines + the F033 ladder).
--   Writes happen only inside SECURITY DEFINER functions called by the trigger.

-- 1. Tables ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_ratings (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rating      integer NOT NULL DEFAULT 1200,
  peak_rating integer NOT NULL DEFAULT 1200,
  matches     integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rating_history (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id   bigint NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  rating     integer NOT NULL,       -- rating AFTER this match
  delta      integer NOT NULL,       -- signed change applied by this match
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);
CREATE INDEX IF NOT EXISTS idx_rating_history_user ON public.rating_history (user_id, created_at);

ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ratings public read" ON public.player_ratings;
CREATE POLICY "Ratings public read" ON public.player_ratings
  FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Rating history public read" ON public.rating_history;
CREATE POLICY "Rating history public read" ON public.rating_history
  FOR SELECT TO authenticated, anon USING (true);
GRANT SELECT ON public.player_ratings TO authenticated, anon;
GRANT SELECT ON public.rating_history TO authenticated, anon;

-- 2. Elo engine ------------------------------------------------------------
-- Idempotent per match (rating_history UNIQUE backstop). K=40 provisional / K=20.
CREATE OR REPLACE FUNCTION public.apply_match_rating(p_match_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_m public.matches;
  v_w uuid; v_l uuid;
  v_rw int; v_rl int;
  v_mw int; v_ml int;
  v_kw int; v_kl int;
  v_exp numeric;
  v_new_w int; v_new_l int;
BEGIN
  SELECT * INTO v_m FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND OR v_m.status <> 'confirmed' OR v_m.winner_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.rating_history WHERE match_id = p_match_id) THEN RETURN; END IF;

  v_w := v_m.winner_id;
  v_l := CASE WHEN v_w = v_m.reporter_id THEN v_m.opponent_id ELSE v_m.reporter_id END;

  INSERT INTO public.player_ratings (user_id) VALUES (v_w), (v_l) ON CONFLICT DO NOTHING;
  SELECT rating, matches INTO v_rw, v_mw FROM public.player_ratings WHERE user_id = v_w;
  SELECT rating, matches INTO v_rl, v_ml FROM public.player_ratings WHERE user_id = v_l;

  v_kw := CASE WHEN v_mw < 10 THEN 40 ELSE 20 END;
  v_kl := CASE WHEN v_ml < 10 THEN 40 ELSE 20 END;
  v_exp := 1.0 / (1.0 + power(10, (v_rl - v_rw) / 400.0));   -- winner's expected score

  v_new_w := GREATEST(100, v_rw + round(v_kw * (1 - v_exp))::int);
  v_new_l := GREATEST(100, v_rl - round(v_kl * (1 - v_exp))::int);

  UPDATE public.player_ratings
     SET rating = v_new_w, peak_rating = GREATEST(peak_rating, v_new_w),
         matches = matches + 1, updated_at = now()
   WHERE user_id = v_w;
  UPDATE public.player_ratings
     SET rating = v_new_l, peak_rating = GREATEST(peak_rating, v_new_l),
         matches = matches + 1, updated_at = now()
   WHERE user_id = v_l;

  INSERT INTO public.rating_history (user_id, match_id, rating, delta, created_at)
  VALUES (v_w, p_match_id, v_new_w, v_new_w - v_rw, COALESCE(v_m.confirmed_at, now())),
         (v_l, p_match_id, v_new_l, v_new_l - v_rl, COALESCE(v_m.confirmed_at, now()));
END;
$$;

-- Full deterministic replay (exact dispute-reversal recompute).
CREATE OR REPLACE FUNCTION public.recompute_player_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id bigint;
BEGIN
  DELETE FROM public.rating_history;
  UPDATE public.player_ratings SET rating = 1200, peak_rating = 1200, matches = 0, updated_at = now();
  FOR v_id IN
    SELECT id FROM public.matches
    WHERE status = 'confirmed' AND winner_id IS NOT NULL
    ORDER BY COALESCE(confirmed_at, created_at), id
  LOOP
    PERFORM public.apply_match_rating(v_id);
  END LOOP;
END;
$$;

-- 3. THE HOOK — fires on every transition into/out of 'confirmed' ----------
CREATE OR REPLACE FUNCTION public.trg_apply_match_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'confirmed' AND NEW.winner_id IS NOT NULL THEN
      PERFORM public.apply_match_rating(NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
      PERFORM public.apply_match_rating(NEW.id);
    ELSIF OLD.status = 'confirmed' AND NEW.status IS DISTINCT FROM 'confirmed' THEN
      PERFORM public.recompute_player_ratings();   -- exact reversal
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_rating_on_confirm ON public.matches;
CREATE TRIGGER apply_rating_on_confirm
  AFTER INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_apply_match_rating();

-- 4. Read RPC: current rating + sparkline + last-5 deltas (null if unrated) -
CREATE OR REPLACE FUNCTION public.get_player_rating(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'rating', pr.rating,
    'peak', pr.peak_rating,
    'matches', pr.matches,
    'provisional', pr.matches < 10,
    'spark', COALESCE((
      SELECT jsonb_agg(s.rating ORDER BY s.created_at)
      FROM (
        SELECT rating, created_at FROM public.rating_history
        WHERE user_id = p_user_id AND created_at >= now() - interval '90 days'
        ORDER BY created_at DESC LIMIT 30
      ) s
    ), '[]'::jsonb),
    'last5', COALESCE((
      SELECT jsonb_agg(l.delta)
      FROM (
        SELECT delta, created_at FROM public.rating_history
        WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 5
      ) l
    ), '[]'::jsonb)
  )
  FROM public.player_ratings pr
  WHERE pr.user_id = p_user_id;
$$;

-- 5. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.apply_match_rating(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_player_ratings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_player_rating(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_rating(uuid) TO authenticated, anon;
-- apply/recompute are trigger-only (definer); no client grant.

NOTIFY pgrst, 'reload schema';
