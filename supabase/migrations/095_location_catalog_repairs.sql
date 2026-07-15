-- Migration: 095_location_catalog_repairs
-- Brings two .txt-only repair files into the tracked migration chain.
--
-- 066b_launch_city_seed.txt and 068_repair_missing_romania_city_centers.txt
-- ran against prod manually (the CLI ignores .txt), so their effects exist
-- in prod but not in migration history. Per the history-immutability rule
-- (000–081 are applied and frozen), this lands as a NEW migration rather
-- than a backdated one. The original .txt files are deleted from
-- supabase/migrations/ — this file is their canonical record.
--
-- Prod-safety: the launch-city seed uses ON CONFLICT DO NOTHING here (the
-- original DO UPDATE would re-force active=true / overwrite admin edits on
-- rows prod has since curated); the center repairs are id-gated and only
-- fill NULLs — 0 rows when already applied.

-- ====== 066b_launch_city_seed (DO NOTHING variant) ======
-- Seed shell rows for countries already exposed by the client. These rows are
-- harmless when venues do not exist yet, but give the selector stable city ids.
INSERT INTO public.cities (
  name,
  county,
  country_code,
  country_name,
  admin_area,
  local_area,
  lat,
  lng,
  zoom,
  venue_count,
  active,
  expansion_status
)
VALUES
  ('Vienna', NULL, 'AT', 'Austria', 'Vienna', NULL, 48.2082, 16.3738, 12, 0, true, 'community_review'),
  ('Berlin', NULL, 'DE', 'Germany', 'Berlin', NULL, 52.5200, 13.4050, 11, 0, true, 'researching'),
  ('Barcelona', NULL, 'ES', 'Spain', 'Catalonia', NULL, 41.3874, 2.1686, 12, 0, true, 'researching'),
  ('Madrid', NULL, 'ES', 'Spain', 'Community of Madrid', NULL, 40.4168, -3.7038, 11, 0, true, 'researching'),
  ('Prague', NULL, 'CZ', 'Czechia', 'Prague', NULL, 50.0755, 14.4378, 12, 0, true, 'community_review'),
  ('Warsaw', NULL, 'PL', 'Poland', 'Masovian Voivodeship', NULL, 52.2297, 21.0122, 11, 0, true, 'researching'),
  ('London', NULL, 'GB', 'United Kingdom', 'England', NULL, 51.5074, -0.1278, 10, 0, true, 'researching'),
  ('Paris', NULL, 'FR', 'France', 'Ile-de-France', NULL, 48.8566, 2.3522, 11, 0, true, 'researching'),
  ('Rome', NULL, 'IT', 'Italy', 'Lazio', NULL, 41.9028, 12.4964, 11, 0, true, 'researching')
ON CONFLICT (country_code, name) DO NOTHING;

-- ====== 068_repair_missing_romania_city_centers (verbatim) ======
-- Repair missing map centers found after migrations 063-067.
-- These are city-level centers used only for initial map positioning.

UPDATE public.cities
SET lat = 44.11667,
    lng = 24.35000,
    zoom = COALESCE(zoom, 12),
    updated_at = now()
WHERE country_code = 'RO'
  AND id = 113
  AND (lat IS NULL OR lng IS NULL OR zoom IS NULL);

UPDATE public.cities
SET lat = 44.55000,
    lng = 23.51667,
    zoom = COALESCE(zoom, 12),
    updated_at = now()
WHERE country_code = 'RO'
  AND id = 114
  AND (lat IS NULL OR lng IS NULL OR zoom IS NULL);

UPDATE public.cities
SET lat = 46.91667,
    lng = 26.33333,
    zoom = COALESCE(zoom, 12),
    updated_at = now()
WHERE country_code = 'RO'
  AND id = 135
  AND (lat IS NULL OR lng IS NULL OR zoom IS NULL);

UPDATE public.cities
SET lat = 45.03417,
    lng = 23.27472,
    zoom = COALESCE(zoom, 12),
    updated_at = now()
WHERE country_code = 'RO'
  AND id = 116
  AND (lat IS NULL OR lng IS NULL OR zoom IS NULL);
