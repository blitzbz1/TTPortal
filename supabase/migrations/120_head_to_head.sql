-- Migration: 120_head_to_head (F031)
-- Head-to-head records + rivals, derived from CONFIRMED matches (105). No new
-- tables. SECURITY DEFINER (consistent with the 105 match RPCs) + block-filtered:
-- a blocked pairing returns nothing, and blocked players never appear in rivals.

-- 1. Head-to-head vs one opponent (W-L, set ratio, streak, last-5) ----------
CREATE OR REPLACE FUNCTION public.get_head_to_head(p_opponent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_my_wins int := 0; v_their_wins int := 0;
  v_my_sets int := 0; v_their_sets int := 0;
  v_streak int := 0; v_last boolean; v_init boolean := false; v_streak_done boolean := false;
  v_last5 jsonb;
  rec record;
BEGIN
  IF v_uid IS NULL OR p_opponent_id IS NULL OR p_opponent_id = v_uid THEN
    RETURN jsonb_build_object('total', 0);
  END IF;
  -- Block filtering (either direction) → no record.
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = v_uid AND b.blocked_id = p_opponent_id)
       OR (b.blocker_id = p_opponent_id AND b.blocked_id = v_uid)
  ) THEN
    RETURN jsonb_build_object('total', 0);
  END IF;

  FOR rec IN
    SELECT
      (m.winner_id = v_uid) AS i_won,
      m.created_at,
      (SELECT count(*) FROM jsonb_array_elements(m.sets) st
        WHERE (CASE WHEN m.reporter_id = v_uid THEN (st->>'a')::int ELSE (st->>'b')::int END)
            > (CASE WHEN m.reporter_id = v_uid THEN (st->>'b')::int ELSE (st->>'a')::int END)) AS my_set_wins,
      (SELECT count(*) FROM jsonb_array_elements(m.sets) st
        WHERE (CASE WHEN m.reporter_id = v_uid THEN (st->>'a')::int ELSE (st->>'b')::int END)
            < (CASE WHEN m.reporter_id = v_uid THEN (st->>'b')::int ELSE (st->>'a')::int END)) AS opp_set_wins
    FROM public.matches m
    WHERE m.status = 'confirmed' AND m.winner_id IS NOT NULL
      AND ((m.reporter_id = v_uid AND m.opponent_id = p_opponent_id)
        OR (m.opponent_id = v_uid AND m.reporter_id = p_opponent_id))
    ORDER BY m.created_at DESC
  LOOP
    IF rec.i_won THEN v_my_wins := v_my_wins + 1; ELSE v_their_wins := v_their_wins + 1; END IF;
    v_my_sets := v_my_sets + rec.my_set_wins;
    v_their_sets := v_their_sets + rec.opp_set_wins;
    -- streak: consecutive same-result from the most recent match backward
    -- (rows arrive newest-first). Stop accumulating at the first different result.
    IF NOT v_streak_done THEN
      IF NOT v_init THEN
        v_init := true; v_last := rec.i_won;
        v_streak := CASE WHEN rec.i_won THEN 1 ELSE -1 END;
      ELSIF rec.i_won = v_last THEN
        v_streak := v_streak + (CASE WHEN rec.i_won THEN 1 ELSE -1 END);
      ELSE
        v_streak_done := true;
      END IF;
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_agg(l.i_won), '[]'::jsonb) INTO v_last5 FROM (
    SELECT (m.winner_id = v_uid) AS i_won, m.created_at
    FROM public.matches m
    WHERE m.status = 'confirmed' AND m.winner_id IS NOT NULL
      AND ((m.reporter_id = v_uid AND m.opponent_id = p_opponent_id)
        OR (m.opponent_id = v_uid AND m.reporter_id = p_opponent_id))
    ORDER BY m.created_at DESC LIMIT 5
  ) l;

  RETURN jsonb_build_object(
    'my_wins', v_my_wins, 'their_wins', v_their_wins, 'total', v_my_wins + v_their_wins,
    'my_sets', v_my_sets, 'their_sets', v_their_sets,
    'streak', CASE WHEN v_init THEN v_streak ELSE 0 END,
    'last5', v_last5
  );
END;
$$;

-- 2. Rivals — most-played opponents (top 5), block-filtered ----------------
CREATE OR REPLACE FUNCTION public.get_rivals(p_limit integer DEFAULT 5)
RETURNS TABLE (
  user_id uuid, full_name text, avatar_url text,
  my_wins bigint, their_wins bigint, total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH my_matches AS (
    SELECT CASE WHEN m.reporter_id = auth.uid() THEN m.opponent_id ELSE m.reporter_id END AS other,
           (m.winner_id = auth.uid()) AS i_won
    FROM public.matches m
    WHERE m.status = 'confirmed' AND m.winner_id IS NOT NULL
      AND auth.uid() IN (m.reporter_id, m.opponent_id)
  )
  SELECT mm.other, p.full_name, p.avatar_url,
         count(*) FILTER (WHERE mm.i_won) AS my_wins,
         count(*) FILTER (WHERE NOT mm.i_won) AS their_wins,
         count(*) AS total
  FROM my_matches mm
  JOIN public.profiles p ON p.id = mm.other
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = mm.other)
       OR (b.blocker_id = mm.other AND b.blocked_id = auth.uid())
  )
  GROUP BY mm.other, p.full_name, p.avatar_url
  ORDER BY total DESC, my_wins DESC
  LIMIT GREATEST(p_limit, 1);
$$;

-- 3. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_head_to_head(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_head_to_head(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_rivals(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rivals(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
