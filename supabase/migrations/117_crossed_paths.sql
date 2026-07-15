-- Migration: 117_crossed_paths (F022)
-- "You played at the same place" — surfaces non-friends whose check-ins
-- overlapped yours at the same venue in the last ~30 days, as a dismissible
-- Add/Dismiss suggestion strip on the Friends screen.
--
-- Design notes
-- ============
-- - get_crossed_paths is SECURITY DEFINER: migration 084 scoped the checkins
--   SELECT policy to self+friends, so a cross-user overlap query cannot run
--   under the caller's RLS rows — it must read past them (precedent:
--   get_friends_at_venue 083, get_venue_player_mix 104). It still derives the
--   caller from auth.uid() and never leaks identities of friends/blocked users.
-- - Block filtering is done in the RPC, bidirectionally, NOT in RLS (072
--   rationale: an RLS reference to user_blocks explodes every read plan).
-- - suggestion_dismissals persists "not interested"; writes flow through the
--   SECURITY DEFINER dismiss_crossed_path RPC (the table is not in generated
--   client types, so the client never touches it directly).
-- - No push for v1 (per the source sketch) — purely a pull surface.

-- 1. Table -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suggestion_dismissals (
  id                bigserial PRIMARY KEY,
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suggestion_dismissals_distinct CHECK (user_id <> dismissed_user_id),
  UNIQUE (user_id, dismissed_user_id)
);

COMMENT ON TABLE public.suggestion_dismissals IS
  'Per-user "not interested" record for people suggestions (F022 crossed paths).';

-- Index that backs the overlap self-join (source-sketch requirement).
CREATE INDEX IF NOT EXISTS idx_checkins_venue_started
  ON public.checkins (venue_id, started_at);

-- 2. RLS: read/insert own only; broad overlap reads go through the RPC -------
ALTER TABLE public.suggestion_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suggestion dismissals read own" ON public.suggestion_dismissals;
CREATE POLICY "Suggestion dismissals read own" ON public.suggestion_dismissals
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Suggestion dismissals insert own" ON public.suggestion_dismissals;
CREATE POLICY "Suggestion dismissals insert own" ON public.suggestion_dismissals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 3. RPCs ------------------------------------------------------------------
-- Recent shared-venue overlaps with non-friends. One row per other user,
-- carrying their most-crossed venue + how many times you crossed there.
CREATE OR REPLACE FUNCTION public.get_crossed_paths(
  p_days  integer DEFAULT 30,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  user_id        uuid,
  full_name      text,
  avatar_url     text,
  city           text,
  username       text,
  skill_level    text,
  venue_id       integer,
  venue_name     text,
  shared_count   integer,
  last_crossed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH my_checkins AS (
    SELECT c.venue_id, c.started_at, c.ended_at
    FROM public.checkins c
    WHERE c.user_id = auth.uid()
      AND c.started_at >= now() - make_interval(days => GREATEST(p_days, 1))
  ),
  my_friends AS (
    SELECT CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS friend_id
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND auth.uid() IN (f.requester_id, f.addressee_id)
  ),
  crossings AS (   -- NB: "overlaps" is a reserved SQL keyword — do not use as a CTE name
    SELECT oc.user_id AS other_id,
           oc.id      AS other_checkin_id,
           oc.venue_id,
           GREATEST(oc.started_at, mc.started_at) AS overlap_start
    FROM public.checkins oc
    JOIN my_checkins mc ON oc.venue_id = mc.venue_id
     AND tstzrange(oc.started_at, COALESCE(oc.ended_at, oc.started_at + interval '2 hours'))
         && tstzrange(mc.started_at, COALESCE(mc.ended_at, mc.started_at + interval '2 hours'))
    WHERE oc.user_id <> auth.uid()
      AND oc.started_at >= now() - make_interval(days => GREATEST(p_days, 1))
  ),
  filtered AS (
    SELECT o.*
    FROM crossings o
    WHERE o.other_id NOT IN (SELECT friend_id FROM my_friends)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = o.other_id)
           OR (b.blocker_id = o.other_id AND b.blocked_id = auth.uid())
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.suggestion_dismissals d
        WHERE d.user_id = auth.uid() AND d.dismissed_user_id = o.other_id
      )
  ),
  per_user_venue AS (
    SELECT other_id, venue_id,
           count(DISTINCT other_checkin_id) AS cnt,
           max(overlap_start) AS last_at
    FROM filtered
    GROUP BY other_id, venue_id
  ),
  ranked AS (
    SELECT puv.*,
           row_number() OVER (PARTITION BY other_id ORDER BY cnt DESC, last_at DESC) AS rn
    FROM per_user_venue puv
  )
  SELECT r.other_id AS user_id,
         p.full_name, p.avatar_url, p.city, p.username, p.skill_level,
         r.venue_id, v.name AS venue_name,
         r.cnt::int AS shared_count,
         r.last_at AS last_crossed_at
  FROM ranked r
  JOIN public.profiles p ON p.id = r.other_id
  LEFT JOIN public.venues v ON v.id = r.venue_id
  WHERE r.rn = 1
  ORDER BY r.last_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

COMMENT ON FUNCTION public.get_crossed_paths(integer, integer) IS
  'F022: non-friend players whose recent check-ins overlapped the caller''s at the same venue.';

-- Persist a "not interested" dismissal (idempotent).
CREATE OR REPLACE FUNCTION public.dismiss_crossed_path(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_user_id IS NULL OR p_user_id = v_uid THEN RETURN; END IF;
  INSERT INTO public.suggestion_dismissals (user_id, dismissed_user_id)
  VALUES (v_uid, p_user_id)
  ON CONFLICT (user_id, dismissed_user_id) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.dismiss_crossed_path(uuid) IS
  'F022: hide a crossed-paths suggestion for the caller.';

-- 4. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_crossed_paths(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_crossed_paths(integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.dismiss_crossed_path(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_crossed_path(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
