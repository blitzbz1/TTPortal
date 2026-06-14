-- Migration: 110_home_venue (F014)
-- "Home venue" as public player identity + an opt-in Regulars list per venue.
-- Distinct from the planned mspec Follow system (a notification subscription) —
-- this is public identity ("plays at Prater Park").
--
-- home_venue_id  — the venue the user calls home (public).
-- show_as_regular — opt-in to appear in that venue's Regulars list (default on).
-- Both follow 085's per-column GRANT model; home_venue_id is anon-readable
-- (player cards + public web profile read it).

-- 1. Columns ---------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_venue_id integer REFERENCES public.venues(id) ON DELETE SET NULL;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_as_regular boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.home_venue_id IS
  'The venue the user calls home — public identity (F014). NULL = unset.';
COMMENT ON COLUMN public.profiles.show_as_regular IS
  'Opt-in to appear in the home venue''s public Regulars list (F014).';

CREATE INDEX IF NOT EXISTS idx_profiles_home_venue
  ON public.profiles (home_venue_id) WHERE home_venue_id IS NOT NULL;

-- 2. Grants (085 per-column model; 103 anon re-grant) ----------------------
GRANT SELECT (home_venue_id, show_as_regular) ON public.profiles TO authenticated;
GRANT UPDATE (home_venue_id, show_as_regular) ON public.profiles TO authenticated;
GRANT SELECT (home_venue_id) ON public.profiles TO anon;

-- 3. Regulars for a venue --------------------------------------------------
-- Opt-in members (show_as_regular) whose home venue is this one. Count + a
-- capped avatar list. SECURITY DEFINER so it reads regardless of the caller.
CREATE OR REPLACE FUNCTION public.get_venue_regulars(p_venue_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH regs AS (
    SELECT id, full_name, avatar_url
    FROM public.profiles
    WHERE home_venue_id = p_venue_id AND show_as_regular = true
  )
  SELECT jsonb_build_object(
    'count', (SELECT count(*)::int FROM regs),
    'regulars', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('user_id', id, 'full_name', full_name, 'avatar_url', avatar_url))
      FROM (SELECT * FROM regs ORDER BY full_name NULLS LAST LIMIT 12) x
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.get_venue_regulars(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_regulars(integer) TO authenticated, anon;

-- 4. A user's home venue (id + name) for profile cards ---------------------
CREATE OR REPLACE FUNCTION public.get_home_venue(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object('id', v.id, 'name', v.name)
  FROM public.profiles p
  JOIN public.venues v ON v.id = p.home_venue_id
  WHERE p.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_home_venue(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_venue(uuid) TO authenticated, anon;

-- 5. Auto-suggest a home venue from check-in history -----------------------
-- The venue the caller has visited on the most distinct days in the last 90d
-- (>= 3 days), excluding any already-set home venue. NULL when none qualifies.
CREATE OR REPLACE FUNCTION public.suggest_home_venue()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH freq AS (
    SELECT c.venue_id, count(DISTINCT date_trunc('day', c.started_at)) AS days
    FROM public.checkins c
    WHERE c.user_id = auth.uid()
      AND c.started_at >= now() - INTERVAL '90 days'
    GROUP BY c.venue_id
    HAVING count(DISTINCT date_trunc('day', c.started_at)) >= 3
  )
  SELECT jsonb_build_object('id', v.id, 'name', v.name)
  FROM freq
  JOIN public.venues v ON v.id = freq.venue_id
  WHERE freq.venue_id IS DISTINCT FROM (SELECT home_venue_id FROM public.profiles WHERE id = auth.uid())
  ORDER BY freq.days DESC, v.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.suggest_home_venue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_home_venue() TO authenticated;

NOTIFY pgrst, 'reload schema';
