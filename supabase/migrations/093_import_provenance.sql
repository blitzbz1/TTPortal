-- Migration: 093_import_provenance
-- Provenance for bulk venue imports (§2.5).
--
-- Production data operations previously ran from untracked scripts whose
-- only record was a watermark dot-file on one laptop, and rollback relied
-- on `id > <watermark> AND submitted_by IS NULL` — which would delete a
-- real user's venue submitted mid-import.
--
-- This adds:
--   - venues.source        'user' (default) | 'curated_seed' | 'osm_<batch>'
--   - venues.import_run_id FK into the new import_runs ledger
--   - import_runs          one row per apply-script execution
-- Rollback becomes an exact `DELETE WHERE import_run_id = X`.
-- The apply scripts (supabase/seeds/osm/*.sh, now tracked) write the
-- ledger row and stamp inserted venues at the end of each live run.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS import_run_id BIGINT;

COMMENT ON COLUMN public.venues.source IS
  'Row provenance: user (in-app submission), curated_seed, or osm_<batch-timestamp>.';

CREATE TABLE IF NOT EXISTS public.import_runs (
  id               BIGSERIAL PRIMARY KEY,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  source_label     TEXT NOT NULL,            -- becomes venues.source
  files            TEXT,                     -- space-separated seed files
  radius_m         INT,
  new_cities_only  BOOLEAN,
  city_watermark   INT,                      -- max(cities.id) before the run
  venue_watermark  INT,                      -- max(venues.id) before the run
  cities_inserted  INT,
  venues_inserted  INT,
  notes            TEXT
);

COMMENT ON TABLE public.import_runs IS
  'Ledger of bulk venue/city import runs. venues.import_run_id points here; rollback = DELETE FROM venues WHERE import_run_id = <id>.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_import_run_fk'
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_import_run_fk
      FOREIGN KEY (import_run_id) REFERENCES public.import_runs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_venues_import_run ON public.venues(import_run_id)
  WHERE import_run_id IS NOT NULL;

-- Ops table: admins read, nobody else. The apply scripts connect as
-- postgres/service_role and bypass RLS.
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS import_runs_admin_read ON public.import_runs;
CREATE POLICY import_runs_admin_read ON public.import_runs
  FOR SELECT TO authenticated
  USING (public.is_current_user_admin());
GRANT SELECT ON public.import_runs TO authenticated;

-- ----------------------------------------------------------------------
-- Backfill: the 2026-06-08 OSM wave (44 countries) is derivable from its
-- committed watermark file (.geo_dedup_watermarks_20260608T075340Z.txt:
-- C0=1058, V0=3922). Stamp those rows and record the run retroactively.
-- ----------------------------------------------------------------------

DO $$
DECLARE
  v_run_id BIGINT;
BEGIN
  -- Only backfill where the wave actually exists (prod); fresh replays
  -- have no venues past the watermark.
  IF EXISTS (
    SELECT 1 FROM public.venues
    WHERE id > 3922 AND submitted_by IS NULL AND source = 'user'
  ) THEN
    INSERT INTO public.import_runs
      (started_at, finished_at, source_label, files, radius_m, new_cities_only,
       city_watermark, venue_watermark, notes)
    VALUES
      ('2026-06-08T07:53:40Z', '2026-06-08T07:53:40Z', 'osm_20260608',
       'al am at ba be bg by ch cy cz de dk dz ee es fi fr gb ge gr hr hu ie ir is it li lt lu lv mc md me nl no pl pt rs ru se si sk tr ua',
       50, false, 1058, 3922,
       'Backfilled by migration 093 from .geo_dedup_watermarks_20260608T075340Z.txt')
    RETURNING id INTO v_run_id;

    UPDATE public.venues
       SET source = 'osm_20260608', import_run_id = v_run_id
     WHERE id > 3922 AND submitted_by IS NULL AND source = 'user';

    UPDATE public.import_runs
       SET venues_inserted = (SELECT count(*) FROM public.venues WHERE import_run_id = v_run_id),
           cities_inserted = (SELECT count(*) FROM public.cities WHERE id > 1058)
     WHERE id = v_run_id;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
