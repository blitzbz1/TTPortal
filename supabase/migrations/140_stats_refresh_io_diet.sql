-- Migration: 140_stats_refresh_io_diet
-- Cut the Disk IO that public.refresh_stats() imposes on the nano instance.
--
-- Problem: 096 scheduled refresh_stats() at '*/3 * * * *' (480 runs/day),
-- and it runs FOUR `REFRESH MATERIALIZED VIEW CONCURRENTLY` statements
-- REGARDLESS of whether anything changed. On the free-tier nano this is the
-- dominant, traffic-independent disk-IO consumer:
--   * Only venue_stats (005:8-19) is expensive — it scans the whole venues
--     table via a Cartesian LEFT-JOIN fan-out (venues x reviews x checkins x
--     favorites) cleaned up by COUNT(DISTINCT). The 3 leaderboards are tiny.
--   * CONCURRENTLY builds a full temp copy + diffs it against the old heap
--     every run (~2x IO; spills to temp files on nano's small work_mem),
--     applying ~zero deltas in alpha. CONCURRENTLY was only needed for the
--     synchronous-trigger path that 096 already removed.
--
-- Fix (three independent IO cuts; safe under every cache hypothesis):
--   1. Rewrite venue_stats to pre-aggregate each child table BEFORE joining
--      -> no fan-out, no COUNT(DISTINCT), no temp spill. Identical output
--      columns/types, so no reader changes (all consumers reference it by
--      name via LEFT JOIN / scalar subquery, not a view dependency).
--   2. Drop CONCURRENTLY in refresh_stats() -> ~halves per-run IO. Plain
--      REFRESH takes a brief AccessExclusiveLock per matview; harmless at
--      alpha traffic, and only every 30 min now.
--   3. Re-schedule the cron from every 3 min to every 30 min (480 -> 48/day).
--      Staleness budget for ratings/leaderboards goes <=3min -> <=30min.
--
-- Frozen-migration rule: 000-099 are untouched; this replaces the function
-- and matview as a NEW migration. See 141 (follow-up) for an optional
-- skip-if-unchanged guard that collapses idle ticks to near-zero.

-- ============================================================
-- 1. De-fanned venue_stats (one row per venue; identical columns/types)
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS public.venue_stats;

CREATE MATERIALIZED VIEW public.venue_stats AS
SELECT
  v.id                                    AS venue_id,
  COALESCE(r.avg_rating, 0)::NUMERIC(2,1) AS avg_rating,
  COALESCE(r.review_count, 0)::INT        AS review_count,
  COALESCE(c.checkin_count, 0)::INT       AS checkin_count,
  COALESCE(f.favorite_count, 0)::INT      AS favorite_count
FROM public.venues v
LEFT JOIN (
  SELECT venue_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
  FROM public.reviews GROUP BY venue_id
) r ON r.venue_id = v.id
LEFT JOIN (
  SELECT venue_id, COUNT(*) AS checkin_count
  FROM public.checkins GROUP BY venue_id
) c ON c.venue_id = v.id
LEFT JOIN (
  SELECT venue_id, COUNT(*) AS favorite_count
  FROM public.favorites GROUP BY venue_id
) f ON f.venue_id = v.id;

-- Unique index is required for any future CONCURRENTLY refresh and is used by
-- readers that look up stats by venue_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_stats_venue ON public.venue_stats(venue_id);

-- Support the favorites sub-aggregate (favorites had only an index on user_id).
CREATE INDEX IF NOT EXISTS idx_favorites_venue ON public.favorites(venue_id);

-- ============================================================
-- 2. refresh_stats() without CONCURRENTLY (plain refresh = ~half the IO)
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_stats() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.venue_stats;
  REFRESH MATERIALIZED VIEW public.leaderboard_checkins;
  REFRESH MATERIALIZED VIEW public.leaderboard_reviews;
  REFRESH MATERIALIZED VIEW public.leaderboard_venues;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Slow the cadence: every 3 min -> every 30 min (480 -> 48 runs/day)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid)
      FROM cron.job WHERE jobname = 'refresh_stats_matviews';
    PERFORM cron.schedule(
      'refresh_stats_matviews',
      '*/30 * * * *',
      'SELECT public.refresh_stats()'
    );
  ELSE
    RAISE NOTICE 'pg_cron unavailable — schedule refresh_stats() externally (30-minute cadence).';
  END IF;
END $$;

-- The CREATE MATERIALIZED VIEW above already populated venue_stats WITH DATA;
-- the leaderboards were not dropped, so no extra refresh is needed at cutover.
