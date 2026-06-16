-- Migration: 127_explorer_quests (F051)
-- Venue explorer quests. Lifetime "distinct venues visited" counters with
-- bronze/silver/gold tiers, awarded by a thin AFTER INSERT trigger on checkins
-- that delegates to a heavy worker (the 094/126 thin-trigger → worker idiom),
-- and read for the Challenges "Explore" section via get_explorer_progress.
--
-- Design notes
-- ============
-- - DEDICATED tables, NOT badge_awards / the 'explorer' challenge_category.
--   The existing 'explorer' challenge_category + its badge_awards rows count
--   explorer CHALLENGE submissions (a different metric). F051 quests count
--   DISTINCT VENUES VISITED — a different axis — so sharing the
--   badge_awards (user_id,'explorer',tier) space would COLLIDE. F051 therefore
--   never touches challenge_category, the badge_awards CHECK, or badge_awards
--   at all; the badge *UI* (EarnedBadgeCard/Modal/getBadgeTierPalette) is reused
--   on the client for rendering only.
-- - Awards are LIFETIME and NOT city-scoped: the award count is the caller's
--   global count(DISTINCT venue_id) for the quest's predicate. City scoping is a
--   DISPLAY-only filter applied by get_explorer_progress when p_city is passed
--   and the quest is city_scoped — it never affects which tiers are awarded.
-- - Venue predicate → real 003 columns:
--     'all'      → every approved venue (no type filter)
--     'park'     → venues.type = 'parc_exterior'   (the outdoor/park type)
--     'indoor'   → venues.type = 'sala_indoor'     (the indoor hall type)
--     'verified' → venues.verified = true          (admin-verified flag)
--   All predicates additionally require venues.approved = true (003 default;
--   suppresses unapproved submissions).
-- - explorer_quest_awards is SELECT-own under RLS; ALL writes go through the
--   SECURITY DEFINER worker sync_explorer_quests (the 126 user_streaks shape).
--   No notification type is added — tier completion is a CLIENT celebration via
--   the existing EarnedBadgeModal — so notifications_type_check is untouched.

-- 1. Quest definitions table (seeded here; read-only to clients) --------------
CREATE TABLE IF NOT EXISTS public.explorer_quests (
  key         text PRIMARY KEY,
  -- Which venues count toward this quest (mapped to venues columns below).
  predicate   text NOT NULL CHECK (predicate IN ('all', 'park', 'indoor', 'verified')),
  bronze      int  NOT NULL,
  silver      int  NOT NULL,
  gold        int  NOT NULL,
  -- When true the Explore section may filter the displayed progress to the
  -- selected city; the AWARD count is always lifetime/global regardless.
  city_scoped boolean NOT NULL DEFAULT true,
  sort        int  NOT NULL DEFAULT 0
);

-- Seed the three launch quests (idempotent).
INSERT INTO public.explorer_quests (key, predicate, bronze, silver, gold, city_scoped, sort) VALUES
  ('venue_explorer',   'all',      5, 10, 20, true, 0),
  ('park_hopper',      'park',     3,  7, 15, true, 1),
  ('indoor_initiate',  'indoor',   3,  7, 15, true, 2)
ON CONFLICT (key) DO UPDATE
  SET predicate   = EXCLUDED.predicate,
      bronze      = EXCLUDED.bronze,
      silver      = EXCLUDED.silver,
      gold        = EXCLUDED.gold,
      city_scoped = EXCLUDED.city_scoped,
      sort        = EXCLUDED.sort;

-- Definitions are public reference data.
GRANT SELECT ON public.explorer_quests TO authenticated, anon;

-- 2. Awards table + RLS (SELECT-own; writes via the DEFINER worker only) ------
CREATE TABLE IF NOT EXISTS public.explorer_quest_awards (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_key   text NOT NULL REFERENCES public.explorer_quests(key),
  tier        text NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  awarded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_key, tier)
);
CREATE INDEX IF NOT EXISTS idx_explorer_quest_awards_user
  ON public.explorer_quest_awards (user_id);

ALTER TABLE public.explorer_quest_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own explorer awards" ON public.explorer_quest_awards;
CREATE POLICY "Users read own explorer awards" ON public.explorer_quest_awards
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
GRANT SELECT ON public.explorer_quest_awards TO authenticated;

-- 3. Sync worker: recompute distinct-venue counts + award crossed tiers -------
-- Heavy worker (094/126 idiom). For each quest, count the user's lifetime
-- distinct visited venues matching the predicate and idempotently insert an
-- award row for every tier the count has reached. ON CONFLICT DO NOTHING keeps
-- re-firing the trigger (e.g. a repeat check-in to a known venue) from
-- double-awarding; awarded_at is set only on the FIRST insert.
CREATE OR REPLACE FUNCTION public.sync_explorer_quests(p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  q      RECORD;
  v_count int;
BEGIN
  IF p_user IS NULL THEN
    RETURN;
  END IF;

  FOR q IN SELECT key, predicate, bronze, silver, gold FROM public.explorer_quests LOOP
    SELECT count(DISTINCT c.venue_id)
      INTO v_count
    FROM public.checkins c
    JOIN public.venues v ON v.id = c.venue_id
    WHERE c.user_id = p_user
      AND v.approved = true
      AND (
        q.predicate = 'all'
        OR (q.predicate = 'park'     AND v.type = 'parc_exterior')
        OR (q.predicate = 'indoor'   AND v.type = 'sala_indoor')
        OR (q.predicate = 'verified' AND v.verified = true)
      );

    IF v_count >= q.gold THEN
      INSERT INTO public.explorer_quest_awards (user_id, quest_key, tier)
      VALUES (p_user, q.key, 'gold')
      ON CONFLICT (user_id, quest_key, tier) DO NOTHING;
    END IF;
    IF v_count >= q.silver THEN
      INSERT INTO public.explorer_quest_awards (user_id, quest_key, tier)
      VALUES (p_user, q.key, 'silver')
      ON CONFLICT (user_id, quest_key, tier) DO NOTHING;
    END IF;
    IF v_count >= q.bronze THEN
      INSERT INTO public.explorer_quest_awards (user_id, quest_key, tier)
      VALUES (p_user, q.key, 'bronze')
      ON CONFLICT (user_id, quest_key, tier) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- 4. Thin AFTER INSERT trigger on checkins (009 is frozen; this is a NEW,
--    separately-named trigger, not an edit to 009). ------------------------
CREATE OR REPLACE FUNCTION public.trg_sync_explorer_quests_checkin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sync_explorer_quests(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS explorer_quests_sync_on_checkin ON public.checkins;
CREATE TRIGGER explorer_quests_sync_on_checkin
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_explorer_quests_checkin();

-- 5. Read RPC: per-quest progress + earned tiers for the Explore section ------
-- progress = the caller's distinct-venue count for the predicate, optionally
-- filtered to p_city when the quest is city_scoped (display-only). earned_*
-- come from explorer_quest_awards (which are lifetime/global). One row per quest.
CREATE OR REPLACE FUNCTION public.get_explorer_progress(p_city text DEFAULT NULL)
RETURNS TABLE (
  key            text,
  predicate      text,
  bronze         int,
  silver         int,
  gold           int,
  city_scoped    boolean,
  sort           int,
  progress       int,
  earned_bronze  boolean,
  earned_silver  boolean,
  earned_gold    boolean
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    q.key,
    q.predicate,
    q.bronze,
    q.silver,
    q.gold,
    q.city_scoped,
    q.sort,
    (
      SELECT count(DISTINCT c.venue_id)::int
      FROM public.checkins c
      JOIN public.venues v ON v.id = c.venue_id
      WHERE c.user_id = auth.uid()
        AND v.approved = true
        AND (
          q.predicate = 'all'
          OR (q.predicate = 'park'     AND v.type = 'parc_exterior')
          OR (q.predicate = 'indoor'   AND v.type = 'sala_indoor')
          OR (q.predicate = 'verified' AND v.verified = true)
        )
        -- City scoping is display-only and applies only to city_scoped quests
        -- when the caller passes a city.
        AND (p_city IS NULL OR NOT q.city_scoped OR v.city = p_city)
    ) AS progress,
    EXISTS (SELECT 1 FROM public.explorer_quest_awards a
            WHERE a.user_id = auth.uid() AND a.quest_key = q.key AND a.tier = 'bronze') AS earned_bronze,
    EXISTS (SELECT 1 FROM public.explorer_quest_awards a
            WHERE a.user_id = auth.uid() AND a.quest_key = q.key AND a.tier = 'silver') AS earned_silver,
    EXISTS (SELECT 1 FROM public.explorer_quest_awards a
            WHERE a.user_id = auth.uid() AND a.quest_key = q.key AND a.tier = 'gold')   AS earned_gold
  FROM public.explorer_quests q
  ORDER BY q.sort, q.key;
$$;

GRANT EXECUTE ON FUNCTION public.get_explorer_progress(text) TO authenticated;

-- 6. Read RPC: venue ids in a city the caller has NOT checked into ------------
-- Powers the "new to you" pin tag. One round-trip; the client builds a Set.
CREATE OR REPLACE FUNCTION public.get_unvisited_venue_ids(p_city text)
RETURNS TABLE (venue_id int)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT v.id
  FROM public.venues v
  WHERE v.city = p_city
    AND v.approved = true
    AND NOT EXISTS (
      SELECT 1 FROM public.checkins c
      WHERE c.venue_id = v.id AND c.user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_unvisited_venue_ids(text) TO authenticated;

-- 7. Grants ------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.sync_explorer_quests(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_sync_explorer_quests_checkin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_explorer_progress(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_unvisited_venue_ids(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_explorer_progress(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unvisited_venue_ids(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
