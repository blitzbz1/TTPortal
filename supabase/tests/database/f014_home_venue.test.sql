-- F014 — home venue & regulars (migration 110).
-- Verifies: opt-in filtering of the Regulars list, that opting out removes you,
-- the home-venue resolver, and the check-in-history suggestion.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(4);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('50000000-0000-4000-8000-0000000000a1', 'f014-a@example.com', '{"full_name":"Dana"}'::jsonb),
  ('50000000-0000-4000-8000-0000000000b2', 'f014-b@example.com', '{"full_name":"Radu"}'::jsonb),
  ('50000000-0000-4000-8000-0000000000c3', 'f014-c@example.com', '{"full_name":"Carmen"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Hometon', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Home Venue', 'parc_exterior', 'Hometon',
        (SELECT id FROM public.cities WHERE name = 'Hometon'),
        'St 1', 44.0, 26.0, true);

-- A: home venue + opted in. B: same home venue but opted OUT.
UPDATE public.profiles
   SET home_venue_id = (SELECT id FROM public.venues WHERE name = 'Home Venue'), show_as_regular = true
 WHERE id = '50000000-0000-4000-8000-0000000000a1';
UPDATE public.profiles
   SET home_venue_id = (SELECT id FROM public.venues WHERE name = 'Home Venue'), show_as_regular = false
 WHERE id = '50000000-0000-4000-8000-0000000000b2';

-- (1) Only the opted-in member counts.
SELECT extensions.is(
  (public.get_venue_regulars((SELECT id FROM public.venues WHERE name = 'Home Venue')) ->> 'count')::int,
  1,
  'Regulars counts only opted-in members (B opted out)'
);

-- (2) Home-venue resolver returns the venue name.
SELECT extensions.is(
  (public.get_home_venue('50000000-0000-4000-8000-0000000000a1') ->> 'name'),
  'Home Venue',
  'get_home_venue returns the home venue name'
);

-- (3) Opting out removes the member from the list.
UPDATE public.profiles SET show_as_regular = false WHERE id = '50000000-0000-4000-8000-0000000000a1';
SELECT extensions.is(
  (public.get_venue_regulars((SELECT id FROM public.venues WHERE name = 'Home Venue')) ->> 'count')::int,
  0,
  'opting out of show_as_regular removes the member from Regulars'
);

-- (4) Suggestion from check-in history: C visits on 3 distinct days.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at)
SELECT '50000000-0000-4000-8000-0000000000c3',
       (SELECT id FROM public.venues WHERE name = 'Home Venue'),
       now() - (g || ' days')::interval, now() - (g || ' days')::interval + interval '2 hours'
FROM generate_series(1, 3) g;

SELECT set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-0000000000c3', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  (public.suggest_home_venue() ->> 'name'),
  'Home Venue',
  'suggest_home_venue surfaces a frequently-visited venue (>= 3 days)'
);

RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
