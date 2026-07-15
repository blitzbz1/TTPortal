-- Keep the expanded location catalog display-safe for existing data.
--
-- This migration makes older Romania-only rows compatible with the country/city
-- selector and recomputes venue counts from approved venues so recommended-city
-- ordering is accurate.
--
-- Run after 063, 064, and 065. It intentionally repeats the launch country/city
-- upserts from 064 as an idempotent safety net for SQL-editor installs, but it
-- does not replace 065's RPC/index changes.

BEGIN;

INSERT INTO public.countries (code, name, active)
VALUES ('RO', 'Romania', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('AT', 'Austria', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('DE', 'Germany', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('ES', 'Spain', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('CZ', 'Czechia', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('PL', 'Poland', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('GB', 'United Kingdom', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('FR', 'France', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('IT', 'Italy', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS country_name TEXT,
  ADD COLUMN IF NOT EXISTS admin_area TEXT,
  ADD COLUMN IF NOT EXISTS local_area TEXT,
  ADD COLUMN IF NOT EXISTS expansion_status TEXT NOT NULL DEFAULT 'active';

UPDATE public.cities c
SET country_code = COALESCE(c.country_code, 'RO'),
    country_name = COALESCE(c.country_name, 'Romania'),
    admin_area = COALESCE(c.admin_area, c.county),
    expansion_status = CASE
      WHEN c.active = false THEN 'hidden'
      WHEN c.expansion_status IS NULL THEN 'active'
      ELSE c.expansion_status
    END,
    updated_at = now()
WHERE c.country_code IS NULL
   OR c.country_name IS NULL
   OR c.admin_area IS DISTINCT FROM COALESCE(c.admin_area, c.county)
   OR c.expansion_status IS NULL;

ALTER TABLE public.cities
  ALTER COLUMN country_code SET DEFAULT 'RO',
  ALTER COLUMN country_code SET NOT NULL,
  ALTER COLUMN country_name SET DEFAULT 'Romania',
  ALTER COLUMN country_name SET NOT NULL;

ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_country_code_fkey;

ALTER TABLE public.cities
  ADD CONSTRAINT cities_country_code_fkey
  FOREIGN KEY (country_code) REFERENCES public.countries(code)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_expansion_status_check;

ALTER TABLE public.cities
  ADD CONSTRAINT cities_expansion_status_check CHECK (
    expansion_status IN (
      'active',
      'launch_ready',
      'community_review',
      'researching',
      'coming_soon',
      'hidden'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS cities_country_code_name_key
  ON public.cities(country_code, name);

ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_name_key;

ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_name_key1;

DROP INDEX IF EXISTS cities_name_key;
DROP INDEX IF EXISTS cities_name_key1;

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
ON CONFLICT (country_code, name) DO UPDATE
SET country_name = EXCLUDED.country_name,
    admin_area = EXCLUDED.admin_area,
    local_area = EXCLUDED.local_area,
    lat = COALESCE(public.cities.lat, EXCLUDED.lat),
    lng = COALESCE(public.cities.lng, EXCLUDED.lng),
    zoom = COALESCE(public.cities.zoom, EXCLUDED.zoom),
    active = true,
    expansion_status = CASE
      WHEN public.cities.expansion_status = 'hidden' THEN EXCLUDED.expansion_status
      ELSE public.cities.expansion_status
    END,
    updated_at = now();

-- Ensure venues that predate city_id or country_code are attached to a city row.
INSERT INTO public.cities (
  name,
  county,
  country_code,
  country_name,
  admin_area,
  lat,
  lng,
  zoom,
  venue_count,
  active,
  expansion_status
)
SELECT
  trim(v.city) AS name,
  NULLIF(trim(COALESCE(v.county, '')), '') AS county,
  'RO' AS country_code,
  'Romania' AS country_name,
  NULLIF(trim(COALESCE(v.county, '')), '') AS admin_area,
  AVG(v.lat) FILTER (WHERE v.lat IS NOT NULL AND v.lng IS NOT NULL) AS lat,
  AVG(v.lng) FILTER (WHERE v.lat IS NOT NULL AND v.lng IS NOT NULL) AS lng,
  12 AS zoom,
  0 AS venue_count,
  true AS active,
  'active' AS expansion_status
FROM public.venues v
LEFT JOIN public.cities c
  ON c.country_code = 'RO'
 AND lower(c.name) = lower(trim(v.city))
WHERE v.city IS NOT NULL
  AND trim(v.city) <> ''
  AND c.id IS NULL
GROUP BY trim(v.city), NULLIF(trim(COALESCE(v.county, '')), '')
ON CONFLICT (country_code, name) DO NOTHING;

UPDATE public.venues v
SET city_id = c.id
FROM public.cities c
WHERE v.city_id IS NULL
  AND v.city IS NOT NULL
  AND c.country_code = 'RO'
  AND lower(c.name) = lower(trim(v.city));

UPDATE public.venues v
SET city = c.name
FROM public.cities c
WHERE v.city_id = c.id
  AND v.city IS DISTINCT FROM c.name;

WITH venue_centers AS (
  SELECT
    v.city_id,
    AVG(v.lat) FILTER (WHERE v.lat IS NOT NULL AND v.lng IS NOT NULL) AS lat,
    AVG(v.lng) FILTER (WHERE v.lat IS NOT NULL AND v.lng IS NOT NULL) AS lng
  FROM public.venues v
  WHERE v.city_id IS NOT NULL
  GROUP BY v.city_id
)
UPDATE public.cities c
SET lat = COALESCE(c.lat, vc.lat),
    lng = COALESCE(c.lng, vc.lng),
    zoom = COALESCE(c.zoom, 12),
    updated_at = now()
FROM venue_centers vc
WHERE c.id = vc.city_id
  AND (c.lat IS NULL OR c.lng IS NULL OR c.zoom IS NULL)
  AND vc.lat IS NOT NULL
  AND vc.lng IS NOT NULL;

UPDATE public.cities c
SET country_name = co.name,
    updated_at = now()
FROM public.countries co
WHERE c.country_code = co.code
  AND c.country_name IS DISTINCT FROM co.name;

WITH approved_counts AS (
  SELECT v.city_id, COUNT(*)::integer AS venue_count
  FROM public.venues v
  WHERE v.approved = true
    AND v.city_id IS NOT NULL
  GROUP BY v.city_id
)
UPDATE public.cities c
SET venue_count = COALESCE(ac.venue_count, 0),
    updated_at = now()
FROM approved_counts ac
WHERE c.id = ac.city_id
  AND c.venue_count IS DISTINCT FROM ac.venue_count;

UPDATE public.cities c
SET venue_count = 0,
    updated_at = now()
WHERE NOT EXISTS (
    SELECT 1
    FROM public.venues v
    WHERE v.city_id = c.id
      AND v.approved = true
  )
  AND COALESCE(c.venue_count, 0) <> 0;

CREATE INDEX IF NOT EXISTS idx_cities_country_active_status_venue_count
  ON public.cities(country_code, active, expansion_status, venue_count DESC, name);

CREATE INDEX IF NOT EXISTS idx_venues_city_id_approved_updated_at
  ON public.venues(city_id, approved, updated_at DESC);

COMMIT;
