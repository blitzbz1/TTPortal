-- Migration: 106_venue_busyness (F010)
-- Live busyness + typical-hours histogram — turns check-in exhaust into the
-- "should I go now?" signal (and the mspec Phase-2 peak-hours heatmap shares
-- this same view: build once, serve both).
--
-- Design notes
-- ============
-- - venue_busyness_hourly is a materialized view over a 12-week trailing
--   window: per (venue_id, weekday, hour) it holds the check-in count and a
--   per-week average. Refreshed daily by pg_cron (018/096 pattern). A unique
--   index lets the refresh run CONCURRENTLY so detail reads never block.
-- - get_venue_busyness(p_venue_id) serves the venue-detail block: the live
--   count NOW (reusing 084's anonymous active-checkin definition), the typical
--   histogram for a weekday selector, the peak hour, and the 12-week sample
--   size that gates the "not enough data yet" empty state.
-- - get_live_venue_counts(p_city_id) backs the map pin dots: one anonymous
--   COUNT per venue with an active check-in. **Counts only, no identities** —
--   same privacy contract as get_venue_active_checkin_count (084).
-- - Both RPCs are SECURITY DEFINER so they read check-ins regardless of the
--   caller's row access (084 scoped checkins SELECT to self+friends).

-- 1. Materialized view -----------------------------------------------------
-- now() inside the definition is re-evaluated on every REFRESH, so the 12-week
-- window slides forward each day.
DROP MATERIALIZED VIEW IF EXISTS public.venue_busyness_hourly;
CREATE MATERIALIZED VIEW public.venue_busyness_hourly AS
  SELECT
    c.venue_id,
    EXTRACT(DOW  FROM c.started_at)::int AS dow,   -- 0=Sun .. 6=Sat
    EXTRACT(HOUR FROM c.started_at)::int AS hour,   -- 0..23 (server tz)
    COUNT(*)::int                        AS checkin_count,
    ROUND(COUNT(*)::numeric / 12.0, 2)   AS avg_per_week
  FROM public.checkins c
  WHERE c.started_at >= now() - INTERVAL '12 weeks'
  GROUP BY c.venue_id, EXTRACT(DOW FROM c.started_at), EXTRACT(HOUR FROM c.started_at)
WITH DATA;

-- Unique index is required for REFRESH ... CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS venue_busyness_hourly_pk
  ON public.venue_busyness_hourly (venue_id, dow, hour);
CREATE INDEX IF NOT EXISTS venue_busyness_hourly_venue_idx
  ON public.venue_busyness_hourly (venue_id);

COMMENT ON MATERIALIZED VIEW public.venue_busyness_hourly IS
  'Per (venue, weekday, hour) check-in counts over a 12-week trailing window. '
  'Refreshed daily by pg_cron. Read only through get_venue_busyness (no direct grant).';

-- 2. Venue-detail busyness bundle ------------------------------------------
-- Returns NULL histogram below MIN_SAMPLE so the screen shows the empty state.
CREATE OR REPLACE FUNCTION public.get_venue_busyness(p_venue_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_min_sample CONSTANT int := 8;   -- need a handful of visits before a curve means anything
  v_live       int;
  v_sample     int;
  v_by_weekday jsonb;
  v_overall    jsonb;
  v_peak_hour  int;
BEGIN
  -- Live count NOW (mirrors get_venue_active_checkin_count / 084).
  SELECT count(*)::int INTO v_live
  FROM public.checkins c
  WHERE c.venue_id = p_venue_id
    AND (c.ended_at > now()
         OR (c.ended_at IS NULL AND c.started_at >= date_trunc('day', now())));

  SELECT COALESCE(SUM(checkin_count), 0)::int INTO v_sample
  FROM public.venue_busyness_hourly WHERE venue_id = p_venue_id;

  IF v_sample < v_min_sample THEN
    RETURN jsonb_build_object('live_count', v_live, 'sample_size', v_sample, 'histogram', NULL);
  END IF;

  -- Per-weekday histograms: { "0": [{hour,count}, ...], ... } — only the
  -- hours that actually have data, ordered by hour.
  SELECT jsonb_object_agg(dow::text, hours) INTO v_by_weekday
  FROM (
    SELECT dow,
           jsonb_agg(jsonb_build_object('hour', hour, 'count', checkin_count) ORDER BY hour) AS hours
    FROM public.venue_busyness_hourly
    WHERE venue_id = p_venue_id
    GROUP BY dow
  ) g;

  -- Overall (all weekdays) hour curve + the single busiest hour.
  SELECT jsonb_agg(jsonb_build_object('hour', hour, 'count', cnt) ORDER BY hour) INTO v_overall
  FROM (
    SELECT hour, SUM(checkin_count)::int AS cnt
    FROM public.venue_busyness_hourly WHERE venue_id = p_venue_id
    GROUP BY hour
  ) o;

  SELECT hour INTO v_peak_hour
  FROM public.venue_busyness_hourly WHERE venue_id = p_venue_id
  GROUP BY hour ORDER BY SUM(checkin_count) DESC, hour LIMIT 1;

  RETURN jsonb_build_object(
    'live_count',  v_live,
    'sample_size', v_sample,
    'peak_hour',   v_peak_hour,
    'histogram',   v_overall,
    'by_weekday',  v_by_weekday
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_venue_busyness(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_busyness(integer) TO authenticated, anon;

-- 3. Map live-count dots ---------------------------------------------------
-- One anonymous count per venue in the city that currently has someone there.
CREATE OR REPLACE FUNCTION public.get_live_venue_counts(p_city_id integer)
RETURNS TABLE (venue_id integer, active_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.venue_id, count(*)::int AS active_count
  FROM public.checkins c
  JOIN public.venues v ON v.id = c.venue_id
  WHERE (p_city_id IS NULL OR v.city_id = p_city_id)
    AND (c.ended_at > now()
         OR (c.ended_at IS NULL AND c.started_at >= date_trunc('day', now())))
  GROUP BY c.venue_id;
$$;

REVOKE ALL ON FUNCTION public.get_live_venue_counts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_venue_counts(integer) TO authenticated, anon;

-- 4. Daily refresh ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_venue_busyness()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- CONCURRENTLY keeps detail reads unblocked; safe because the MV is created
  -- WITH DATA and carries a unique index. Falls back to a plain refresh if a
  -- concurrent one can't proceed (e.g. first run after a manual TRUNCATE).
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.venue_busyness_hourly;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.venue_busyness_hourly;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_venue_busyness() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'refresh_venue_busyness';
    PERFORM cron.schedule(
      'refresh_venue_busyness',
      '41 4 * * *',  -- 04:41 daily, off-peak
      $cron$SELECT public.refresh_venue_busyness()$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron unavailable — refresh venue_busyness_hourly externally (daily).';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
