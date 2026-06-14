-- Migration: 107_table_reports (F011)
-- One-tap "how many tables are free" reports — the freshest on-site signal for
-- "should I go now?". Reports are anonymous to viewers (only the latest fresh
-- one is surfaced, without identity) and decay after ~90 minutes.
--
-- Design notes
-- ============
-- - table_reports is append-only; writes go through report_free_tables (a
--   SECURITY DEFINER RPC), reads through get_venue_free_tables (latest fresh,
--   no user_id). No direct SELECT grant — individual reports/identities are
--   never exposed (privacy contract mirrors 084/106 counts-only surfaces).
-- - Rate limiting reuses 047 via a BEFORE INSERT trigger (the 105 pattern).
-- - A daily pg_cron job prunes rows older than 24h — the freshness window is
--   90 minutes, so anything older is dead weight.

-- 1. Table -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.table_reports (
  id          bigserial PRIMARY KEY,
  venue_id    integer NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  free_count  integer NOT NULL CHECK (free_count >= 0 AND free_count <= 99),
  group_size  integer CHECK (group_size IS NULL OR (group_size >= 1 AND group_size <= 20)),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_table_reports_venue_recent
  ON public.table_reports (venue_id, created_at DESC);

-- 2. RLS: insert-own only. No SELECT policy — reads go through the aggregate
--    RPC, so individual reporters stay anonymous.
ALTER TABLE public.table_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Table reports insert own" ON public.table_reports;
CREATE POLICY "Table reports insert own" ON public.table_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Rate limit (047 / 105 pattern).
INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('report_free_tables', 'user',   600,  6, '6 free-table reports per 10 minutes'),
  ('report_free_tables', 'user', 86400, 50, '50 free-table reports per 24 hours')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_enforce_report_free_tables() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN PERFORM public.enforce_rate_limit('report_free_tables'); RETURN new; END $$;

DROP TRIGGER IF EXISTS rate_limit_report_free_tables ON public.table_reports;
CREATE TRIGGER rate_limit_report_free_tables
  BEFORE INSERT ON public.table_reports
  FOR EACH ROW EXECUTE FUNCTION public.trg_enforce_report_free_tables();

-- 4. RPCs ------------------------------------------------------------------
-- Report free tables (reporter = caller). The rate-limit trigger fires on the
-- INSERT; auth.uid() is unaffected by SECURITY DEFINER, so the cap is per-user.
CREATE OR REPLACE FUNCTION public.report_free_tables(
  p_venue_id integer,
  p_free_count integer,
  p_group_size integer DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF p_free_count IS NULL OR p_free_count < 0 OR p_free_count > 99 THEN
    RAISE EXCEPTION 'invalid free_count';
  END IF;

  INSERT INTO public.table_reports (venue_id, user_id, free_count, group_size)
  VALUES (p_venue_id, v_uid, p_free_count,
          CASE WHEN p_group_size BETWEEN 1 AND 20 THEN p_group_size ELSE NULL END)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Latest fresh report for a venue (decays after ~90 min). Anonymous: no
-- user_id is returned. NULL when nothing fresh.
CREATE OR REPLACE FUNCTION public.get_venue_free_tables(p_venue_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
           'free_count',  tr.free_count,
           'group_size',  tr.group_size,
           'reported_at', tr.created_at,
           'age_minutes', GREATEST(0, floor(extract(epoch FROM (now() - tr.created_at)) / 60))::int
         )
  FROM public.table_reports tr
  WHERE tr.venue_id = p_venue_id
    AND tr.created_at >= now() - INTERVAL '90 minutes'
  ORDER BY tr.created_at DESC
  LIMIT 1;
$$;

-- 5. Cleanup cron ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_table_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count int;
BEGIN
  WITH del AS (
    DELETE FROM public.table_reports WHERE created_at < now() - INTERVAL '24 hours' RETURNING 1
  ) SELECT count(*) INTO v_count FROM del;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_table_reports() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'prune_table_reports';
    PERFORM cron.schedule(
      'prune_table_reports',
      '29 3 * * *',  -- 03:29 daily
      $cron$SELECT public.prune_table_reports()$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron unavailable — prune table_reports externally (daily).';
  END IF;
END $$;

-- 6. Grants ----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.report_free_tables(integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_venue_free_tables(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_free_tables(integer, integer, integer) TO authenticated;
-- Latest-fresh aggregate is anonymous and useful pre-login on the web profile.
GRANT EXECUTE ON FUNCTION public.get_venue_free_tables(integer) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
