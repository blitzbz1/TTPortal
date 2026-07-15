-- Fix `nets = true` for the OSM venues added by the 50 m geo-dedup import run.
--
-- Why: the OSM seed files omit the `nets` column, so each imported venue took the
-- venues table DEFAULT at insert time. Migration 077 changes that default to `true`,
-- but only for NEW rows — venues already imported took the old `false` default.
-- This one-time fix aligns the rows already imported.
--
-- Scope: ONLY the venues added by that import run —
--   id > 3922          (the V0 watermark from .geo_dedup_watermarks_20260608T075340Z.txt)
--   submitted_by IS NULL  (system import; never touches user submissions)
-- It deliberately does NOT touch your original curated `006` seed venues, which set
-- `nets` on purpose. Idempotent: re-running changes nothing.
--
-- How to run:
--   • Supabase Dashboard → SQL Editor → paste this whole file → Run
--   • or:  psql "$DB" -f supabase/seeds/osm/fix_imported_venues_nets.sql

-- 1) Apply the fix and report how many rows changed.
WITH updated AS (
  UPDATE public.venues
     SET nets = true
   WHERE id > 3922
     AND submitted_by IS NULL
     AND nets IS NOT TRUE
  RETURNING 1
)
SELECT count(*) AS venues_fixed FROM updated;

-- 2) Verify: every imported venue from this run should now read nets = true.
SELECT nets, count(*) AS venues
  FROM public.venues
 WHERE id > 3922 AND submitted_by IS NULL
 GROUP BY nets
 ORDER BY nets;

-- ---------------------------------------------------------------------------
-- OPTIONAL — align ALL system venues (every earlier OSM import too), per the
-- note in migration 077. CAUTION: this also flips deliberately-`false` nets on
-- your original curated `006` seed venues. Uncomment only if that's intended.
--
-- UPDATE public.venues SET nets = true
--  WHERE submitted_by IS NULL AND nets IS NOT TRUE;
