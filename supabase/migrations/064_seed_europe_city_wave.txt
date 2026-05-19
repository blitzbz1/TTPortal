-- First expansion wave: country records + city shells.
--
-- These are the launch countries/cities exposed by the location welcome and
-- header switcher. Venue rows can be added gradually; zero-count shell cities
-- still need stable ids so the client can select them, center the map, and
-- keep language/country filtering consistent.

INSERT INTO public.countries (code, name, active)
VALUES ('RO', 'Romania', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('AT', 'Austria', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('CZ', 'Czechia', true)
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
VALUES ('FR', 'France', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('GB', 'United Kingdom', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('IT', 'Italy', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

INSERT INTO public.countries (code, name, active)
VALUES ('PL', 'Poland', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

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
  ('Vienna', NULL, 'AT', 'Austria', 'Vienna', NULL, 48.2082, 16.3738, 12, 0, true, 'researching'),
  ('Berlin', NULL, 'DE', 'Germany', 'Berlin', NULL, 52.5200, 13.4050, 11, 0, true, 'researching'),
  ('Barcelona', NULL, 'ES', 'Spain', 'Catalonia', NULL, 41.3874, 2.1686, 12, 0, true, 'researching'),
  ('Madrid', NULL, 'ES', 'Spain', 'Community of Madrid', NULL, 40.4168, -3.7038, 11, 0, true, 'researching'),
  ('Prague', NULL, 'CZ', 'Czechia', 'Prague', NULL, 50.0755, 14.4378, 12, 0, true, 'community_review'),
  ('Warsaw', NULL, 'PL', 'Poland', 'Masovian Voivodeship', NULL, 52.2297, 21.0122, 11, 0, true, 'researching'),
  ('London', NULL, 'GB', 'United Kingdom', 'England', NULL, 51.5074, -0.1278, 10, 0, true, 'researching'),
  ('Paris', NULL, 'FR', 'France', 'Ile-de-France', NULL, 48.8566, 2.3522, 11, 0, true, 'researching'),
  ('Rome', NULL, 'IT', 'Italy', 'Lazio', NULL, 41.9028, 12.4964, 11, 0, true, 'researching')
ON CONFLICT (country_code, name) DO UPDATE
SET
  country_name = EXCLUDED.country_name,
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
