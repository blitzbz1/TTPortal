-- Migration: 104_profiles_skill_goals (F001)
-- Self-declared skill level + play goals on profiles, plus an anonymized
-- venue player-mix aggregate.
--
-- skill_level — single value (new | casual | club | competitive), NULL = unset.
-- play_goals  — multi-select text[] from a fixed vocabulary.
-- Both are non-sensitive, publicly-readable profile fields, so they follow
-- 085's per-column GRANT model and 103's anon re-grant (player cards + the
-- public web profile read them). get_venue_player_mix(p_venue_id) returns a
-- coarse, anonymous composition label only once >= 5 distinct recent visitors
-- have set a level (mspec 4.2's 5-user aggregation threshold), mirroring the
-- champion CTE in 083's get_venue_detail.

-- 1. Columns ---------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skill_level text
    CHECK (skill_level IN ('new', 'casual', 'club', 'competitive'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS play_goals text[] NOT NULL DEFAULT '{}'::text[];

-- Pin the play_goals vocabulary (<@ = "every element is in the allowed set";
-- the empty array trivially satisfies it).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_play_goals_allowed;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_play_goals_allowed
  CHECK (play_goals <@ ARRAY['casual_rallies','competitive_matches','training_partner','doubles']::text[]);

COMMENT ON COLUMN public.profiles.skill_level IS
  'Self-declared skill: new | casual | club | competitive. NULL = not set (F001).';
COMMENT ON COLUMN public.profiles.play_goals IS
  'Self-declared goals (multi): casual_rallies | competitive_matches | training_partner | doubles (F001).';

-- 2. Grants (085 per-column model; 103 anon re-grant) ----------------------
GRANT SELECT (skill_level, play_goals) ON public.profiles TO authenticated;
GRANT UPDATE (skill_level, play_goals) ON public.profiles TO authenticated;
GRANT SELECT (skill_level, play_goals) ON public.profiles TO anon;

-- 3. Anonymized venue player-mix ------------------------------------------
-- Counts only, no identities. SECURITY DEFINER so it reads skill levels +
-- check-ins regardless of the caller's row access (084 scoped checkins to
-- self+friends). Returns NULL below the 5-distinct-visitor threshold.
CREATE OR REPLACE FUNCTION public.get_venue_player_mix(p_venue_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH recent_levellers AS (
    SELECT DISTINCT c.user_id, p.skill_level
    FROM public.checkins c
    JOIN public.profiles p ON p.id = c.user_id
    WHERE c.venue_id = p_venue_id
      AND c.started_at >= now() - INTERVAL '90 days'
      AND p.skill_level IS NOT NULL
  ),
  tally AS (
    SELECT skill_level, COUNT(*)::int AS n
    FROM recent_levellers
    GROUP BY skill_level
  ),
  agg AS (SELECT COALESCE(SUM(n), 0)::int AS total FROM tally)
  SELECT CASE
    WHEN (SELECT total FROM agg) < 5 THEN NULL
    ELSE jsonb_build_object(
      'total',     (SELECT total FROM agg),
      'breakdown', (SELECT jsonb_object_agg(skill_level, n) FROM tally),
      'top',       (SELECT skill_level FROM tally ORDER BY n DESC, skill_level LIMIT 1)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.get_venue_player_mix(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_player_mix(integer) TO authenticated, anon;
