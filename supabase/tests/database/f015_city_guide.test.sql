-- F015 — public city guide RPC (migration 111).
-- Verifies: anon can read it, it returns the city + venues, hidden cities are
-- excluded, and it leaks no private data (no user identities in the payload).

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(5);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Guideville', 'RO', 'Romania', 46.7, 23.6),
       ('Hiddentown', 'RO', 'Romania', 45.0, 25.0);

UPDATE public.cities SET expansion_status = 'hidden' WHERE name = 'Hiddentown';

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved, free_access)
VALUES ('Guide Park', 'parc_exterior', 'Guideville',
        (SELECT id FROM public.cities WHERE name = 'Guideville'), 'St 1', 46.7, 23.6, true, true);

-- (1) Anon can read the guide.
SET LOCAL ROLE anon;
SELECT extensions.isnt(
  public.get_city_guide((SELECT id FROM public.cities WHERE name = 'Guideville')),
  NULL,
  'anon can read get_city_guide'
);
RESET ROLE;

-- (2) It returns the city name.
SELECT extensions.is(
  (public.get_city_guide((SELECT id FROM public.cities WHERE name = 'Guideville')) #>> '{city,name}'),
  'Guideville',
  'guide returns the city name'
);

-- (3) It includes the approved venue in the outdoor list.
SELECT extensions.is(
  (public.get_city_guide((SELECT id FROM public.cities WHERE name = 'Guideville')) #>> '{outdoor,0,name}'),
  'Guide Park',
  'guide lists the city''s outdoor venues'
);

-- (4) Hidden cities are not exposed.
SELECT extensions.ok(
  public.get_city_guide((SELECT id FROM public.cities WHERE name = 'Hiddentown')) IS NULL,
  'hidden cities return NULL'
);

-- (5) No private data leaks (no user identity keys in the payload).
SELECT extensions.ok(
  public.get_city_guide((SELECT id FROM public.cities WHERE name = 'Guideville'))::text NOT LIKE '%user_id%'
  AND public.get_city_guide((SELECT id FROM public.cities WHERE name = 'Guideville'))::text NOT LIKE '%@%',
  'guide payload carries no user identities'
);

SELECT extensions.finish();
ROLLBACK;
