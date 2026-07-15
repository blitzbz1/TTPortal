-- Migration: 096_async_stats_refresh (T075)
-- Move materialized-view refreshes off the write path.
--
-- Problem: 018 + 028 wired AFTER-STATEMENT triggers that run
-- public.refresh_stats() — i.e. FOUR `REFRESH MATERIALIZED VIEW
-- CONCURRENTLY` statements — synchronously inside every review write and
-- every profile rename. Each refresh rescans the full checkins/reviews/
-- venues tables; as venues scale (OSM imports), review submission latency
-- grows linearly and concurrent review writes serialize on the refresh.
--
-- Fix: drop the triggers; refresh on a pg_cron schedule every 3 minutes.
-- Accepted staleness: a new review's effect on the venue rating and the
-- leaderboards appears within ≤3 minutes. (Bonus: check-ins previously
-- NEVER triggered a refresh — leaderboard_checkins only updated when an
-- unrelated review/rename happened to fire refresh_stats. The cron now
-- refreshes everything on a uniform clock.)

-- 1. Drop the synchronous triggers + their wrapper functions.
DROP TRIGGER IF EXISTS on_review_change_refresh_stats ON public.reviews;
DROP FUNCTION IF EXISTS public.refresh_stats_on_review_change();

DROP TRIGGER IF EXISTS on_profile_updated_refresh_lb ON public.profiles;
DROP FUNCTION IF EXISTS public.refresh_leaderboards_on_profile_change();

-- 2. Schedule the refresh. pg_cron ships with Supabase; the guard keeps
--    the migration green on local stacks without it (scratch harness uses
--    plain postgres:15-alpine — assertions check trigger removal only).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    -- Re-schedule idempotently.
    PERFORM cron.unschedule(jobid)
      FROM cron.job WHERE jobname = 'refresh_stats_matviews';
    PERFORM cron.schedule(
      'refresh_stats_matviews',
      '*/3 * * * *',
      'SELECT public.refresh_stats()'
    );
  ELSE
    RAISE NOTICE 'pg_cron unavailable — schedule refresh_stats() externally (3-minute cadence).';
  END IF;
END $$;

-- 3. One immediate refresh so nothing is stale at cutover.
SELECT public.refresh_stats();
