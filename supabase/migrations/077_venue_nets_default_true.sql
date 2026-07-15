-- Venue amenity flag default: assume a table-tennis venue HAS nets unless stated otherwise.
-- The OSM seed files (supabase/seeds/osm/*.sql) omit the `nets` column and rely on this default,
-- and the admin OSM import (075) already coalesces nets -> true; this aligns the base table with
-- both. Night lighting keeps its `false` default (the exception, surfaced in the UI only when true).
ALTER TABLE public.venues ALTER COLUMN nets SET DEFAULT true;

-- Note: this changes the default for NEW rows only. Venues already imported from the OSM seeds
-- (which omitted `nets`, so they took the old `false` default) are not touched here. To align
-- those curated imports with the new default, run once, when ready:
--   UPDATE public.venues SET nets = true WHERE submitted_by IS NULL AND nets IS NOT TRUE;
