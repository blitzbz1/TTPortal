-- F012 — structured amenities via the venue change-request queue (migration 108).
-- Verifies: submit stores proposed_amenities, admin resolve merges them into
-- venues.amenities, the anon read RPCs work, and resolve stays admin-gated.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(5);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('40000000-0000-4000-8000-0000000000a1', 'f012-admin@example.com', '{"full_name":"Admin"}'::jsonb),
  ('40000000-0000-4000-8000-0000000000b2', 'f012-user@example.com',  '{"full_name":"User"}'::jsonb);

UPDATE public.profiles SET is_admin = true WHERE id = '40000000-0000-4000-8000-0000000000a1';

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Amenton', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Amenity Venue', 'sala_indoor', 'Amenton',
        (SELECT id FROM public.cities WHERE name = 'Amenton'),
        'St 1', 44.0, 26.0, true);

-- ── Regular user submits an amenity change request ──────────────────────────
SELECT set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-0000000000b2', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT public.submit_venue_change_request(
  (SELECT id FROM public.venues WHERE name = 'Amenity Venue'),
  NULL, NULL, NULL, false, NULL, NULL,
  '{"rental": true, "entry_fee": "free"}'::jsonb
);

RESET ROLE;

-- (1) The proposal is stored on the request row.
SELECT extensions.is(
  (SELECT proposed_amenities ->> 'rental' FROM public.venue_change_requests
   WHERE venue_id = (SELECT id FROM public.venues WHERE name = 'Amenity Venue')),
  'true',
  'submit stores proposed_amenities on the change request'
);

-- ── Admin resolves, applying the amenities ──────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-0000000000a1', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT public.resolve_venue_change_request(
  (SELECT id FROM public.venue_change_requests
   WHERE venue_id = (SELECT id FROM public.venues WHERE name = 'Amenity Venue')),
  false, false, false, 'none', true   -- p_apply_amenities := true
);

RESET ROLE;

-- (2) Accepted amenities merged into the venue.
SELECT extensions.is(
  (SELECT amenities ->> 'rental' FROM public.venues WHERE name = 'Amenity Venue'),
  'true',
  'resolve merges accepted amenities into venues.amenities'
);

-- (3) get_venue_amenities surfaces the entry fee.
SELECT extensions.is(
  (public.get_venue_amenities((SELECT id FROM public.venues WHERE name = 'Amenity Venue')) ->> 'entry_fee'),
  'free',
  'get_venue_amenities returns the merged amenities'
);

-- (4) A non-admin cannot resolve.
SELECT set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-0000000000b2', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.throws_ok(
  format($q$ SELECT public.resolve_venue_change_request(%s, false, false, false, 'none', true) $q$,
         (SELECT id FROM public.venue_change_requests
          WHERE venue_id = (SELECT id FROM public.venues WHERE name = 'Amenity Venue'))),
  NULL, NULL,
  'resolve_venue_change_request is admin-gated'
);

RESET ROLE;

-- (5) Anonymous map read returns the venue's amenities.
SET LOCAL ROLE anon;
SELECT extensions.is(
  (SELECT count(*)::int FROM public.get_city_venue_amenities(
     (SELECT id FROM public.cities WHERE name = 'Amenton'))),
  1,
  'anon can read per-city venue amenities for the map chips'
);
RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
