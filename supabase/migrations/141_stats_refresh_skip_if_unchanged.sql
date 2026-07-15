-- Migration: 141_stats_refresh_skip_if_unchanged
-- Make refresh_stats() a no-op when nothing changed, so the every-N-min cron
-- stops paying matview-rebuild IO during idle windows (the common case in alpha).
--
-- Background: 140 de-fanned venue_stats, dropped CONCURRENTLY, and cut the cron
-- to */30. But the job still REFRESHes on EVERY tick regardless of whether the
-- source tables changed. This adds a dirty-flag guard so a tick only refreshes
-- the views whose inputs actually changed since the last refresh.
--
-- Design:
--   * stats_refresh_state holds one is_dirty flag per matview.
--   * Statement-level AFTER triggers on each source table flip the relevant
--     flags. They are STATEMENT-level (fire once per write, not per row) and
--     use `AND NOT is_dirty`, so repeat writes inside a window match no row =
--     take no lock = the flag is not a write hotspot. This keeps refreshes off
--     the write path, exactly as 096 intended (no REFRESH in the trigger).
--   * refresh_stats() clears flags BEFORE refreshing, so a write landing during
--     a refresh re-marks dirty (worst case: one redundant refresh next tick;
--     never a missed update). When nothing is dirty the tick costs one indexed
--     read and zero matview IO.
--
-- Source -> view mapping (effective defs: venue_stats=140; leaderboard_checkins
-- =005 profiles+checkins; leaderboard_reviews=020 profiles+reviews;
-- leaderboard_venues=019 profiles+checkins):
--   reviews   -> venue_stats, leaderboard_reviews
--   checkins  -> venue_stats, leaderboard_checkins, leaderboard_venues
--   favorites -> venue_stats
--   venues    -> venue_stats        (INSERT/DELETE only; see note below)
--   profiles  -> all 3 leaderboards (name/avatar/city changes + removal only)
--
-- Frozen-migration rule honored: replaces refresh_stats() (post-099) via a new
-- migration; touches no 000-099 file. Does NOT change the cron cadence — with
-- idle ticks now free, you can safely tighten it again later if you want
-- fresher stats during active use.

-- ============================================================
-- 1. Dirty-flag state (internal; kept out of the API and under RLS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stats_refresh_state (
  view_name      text PRIMARY KEY,
  is_dirty       boolean NOT NULL DEFAULT true,
  last_refreshed timestamptz
);

ALTER TABLE public.stats_refresh_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stats_refresh_state FROM anon, authenticated;

-- Seed all four views dirty so the first tick after deploy reconciles them.
INSERT INTO public.stats_refresh_state (view_name) VALUES
  ('venue_stats'),
  ('leaderboard_checkins'),
  ('leaderboard_reviews'),
  ('leaderboard_venues')
ON CONFLICT (view_name) DO NOTHING;

-- ============================================================
-- 2. Generic statement-level "mark dirty" trigger fn (views via TG_ARGV)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_stats_dirty() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.stats_refresh_state
     SET is_dirty = true
   WHERE view_name = ANY (TG_ARGV) AND NOT is_dirty;
  RETURN NULL;  -- AFTER STATEMENT: return value is ignored
END;
$$;

-- ============================================================
-- 3. Wire triggers to the matview source tables
-- ============================================================
DROP TRIGGER IF EXISTS trg_mark_stats_dirty ON public.reviews;
CREATE TRIGGER trg_mark_stats_dirty
  AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.reviews
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.mark_stats_dirty('venue_stats', 'leaderboard_reviews');

DROP TRIGGER IF EXISTS trg_mark_stats_dirty ON public.checkins;
CREATE TRIGGER trg_mark_stats_dirty
  AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.checkins
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.mark_stats_dirty('venue_stats', 'leaderboard_checkins', 'leaderboard_venues');

DROP TRIGGER IF EXISTS trg_mark_stats_dirty ON public.favorites;
CREATE TRIGGER trg_mark_stats_dirty
  AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.favorites
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.mark_stats_dirty('venue_stats');

-- venues: only INSERT/DELETE/TRUNCATE change the venue SET (venue_stats has one
-- row per venue and reads no other venues column), so plain edits and approval
-- toggles (UPDATE) are intentionally ignored to avoid OSM-import update churn.
DROP TRIGGER IF EXISTS trg_mark_stats_dirty ON public.venues;
CREATE TRIGGER trg_mark_stats_dirty
  AFTER INSERT OR DELETE OR TRUNCATE ON public.venues
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.mark_stats_dirty('venue_stats');

-- profiles: leaderboards display full_name/avatar_url/city only, so just those
-- column updates (plus row removal) matter — not visibility/play-profile edits.
DROP TRIGGER IF EXISTS trg_mark_stats_dirty_del ON public.profiles;
CREATE TRIGGER trg_mark_stats_dirty_del
  AFTER DELETE OR TRUNCATE ON public.profiles
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.mark_stats_dirty('leaderboard_checkins', 'leaderboard_reviews', 'leaderboard_venues');

DROP TRIGGER IF EXISTS trg_mark_stats_dirty_upd ON public.profiles;
CREATE TRIGGER trg_mark_stats_dirty_upd
  AFTER UPDATE OF full_name, avatar_url, city ON public.profiles
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.mark_stats_dirty('leaderboard_checkins', 'leaderboard_reviews', 'leaderboard_venues');

-- ============================================================
-- 4. refresh_stats(): refresh ONLY dirty views; skip entirely when clean
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_stats() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_dirty text[];
BEGIN
  SELECT array_agg(view_name) INTO v_dirty
    FROM public.stats_refresh_state
   WHERE is_dirty;

  IF v_dirty IS NULL THEN
    RETURN;  -- nothing changed since last run -> zero matview IO
  END IF;

  -- Clear BEFORE refreshing (see header: avoids missed updates).
  UPDATE public.stats_refresh_state
     SET is_dirty = false, last_refreshed = now()
   WHERE view_name = ANY (v_dirty);

  IF 'venue_stats'          = ANY (v_dirty) THEN REFRESH MATERIALIZED VIEW public.venue_stats;          END IF;
  IF 'leaderboard_checkins' = ANY (v_dirty) THEN REFRESH MATERIALIZED VIEW public.leaderboard_checkins; END IF;
  IF 'leaderboard_reviews'  = ANY (v_dirty) THEN REFRESH MATERIALIZED VIEW public.leaderboard_reviews;  END IF;
  IF 'leaderboard_venues'   = ANY (v_dirty) THEN REFRESH MATERIALIZED VIEW public.leaderboard_venues;   END IF;
END;
$$;
