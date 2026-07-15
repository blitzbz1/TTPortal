-- Migration 142: venue submissions derive submitted_by from auth.uid().

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(8);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('14200000-0000-4000-8000-000000000001', 'm142-player@example.com', '{"full_name":"Player"}'::jsonb),
  ('14200000-0000-4000-8000-000000000002', 'm142-admin@example.com',  '{"full_name":"Admin"}'::jsonb);

UPDATE public.profiles
SET is_admin = true
WHERE id = '14200000-0000-4000-8000-000000000002';

INSERT INTO public.cities (id, name, country_code, country_name, lat, lng, zoom)
VALUES (914200, 'M142 Test City', 'RO', 'Romania', 44.4, 26.1, 12);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.venues'::regclass
      AND tgname = 'set_venue_submitted_by_from_auth'
      AND NOT tgisinternal
  ),
  'the venue identity trigger exists');

-- A regular authenticated client may omit submitted_by, as AddVenueScreen does.
SELECT set_config('request.jwt.claim.sub', '14200000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"14200000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $q$ INSERT INTO public.venues
        (name, type, city, city_id, address, lat, lng, approved)
      VALUES
        ('M142 Omitted Owner', 'parc_exterior', 'M142 Test City', 914200,
         'Test Address 1', 44.41, 26.11, false) $q$,
  'an authenticated venue insert may omit submitted_by');

-- A caller also cannot spoof ownership or self-approve by supplying protected
-- moderation values.
SELECT extensions.lives_ok(
  $q$ INSERT INTO public.venues
        (name, type, city, city_id, address, lat, lng, approved, verified,
         review_status, source, submitted_by)
      VALUES
        ('  M142 Spoofed Owner  ', 'parc_exterior', 'Wrong Client City', 914200,
         'Test Address 2', 44.42, 26.12, true, true, 'approved', 'curated_seed',
         '14200000-0000-4000-8000-000000000002') $q$,
  'a regular-user insert cannot claim another owner or moderation state');

RESET ROLE;

SELECT extensions.is(
  (SELECT count(*)::int
   FROM public.venues
   WHERE name IN ('M142 Omitted Owner', 'M142 Spoofed Owner')
     AND submitted_by = '14200000-0000-4000-8000-000000000001'),
  2,
  'both regular-user submissions are owned by auth.uid()');

SELECT extensions.is(
  (SELECT concat_ws('|', approved, verified, review_status, source)
   FROM public.venues
   WHERE name = 'M142 Spoofed Owner'),
  'false|false|pending|user',
  'regular users cannot bypass pending moderation');

SELECT extensions.is(
  (SELECT concat_ws('|', name, city)
   FROM public.venues
   WHERE name = 'M142 Spoofed Owner'),
  'M142 Spoofed Owner|M142 Test City',
  'regular-user input is trimmed and city text follows the catalog city id');

SELECT extensions.throws_ok(
  $q$ INSERT INTO public.venues
        (name, type, city, city_id, address, lat, lng, approved)
      VALUES
        ('M142 Invalid Pin', 'parc_exterior', 'M142 Test City', 914200,
         'Test Address 4', 91, 26.14, false) $q$,
  '22023', 'invalid_venue_coordinates',
  'out-of-range venue coordinates are rejected at the database boundary');

-- Admin submissions use the same ownership path; rate-limit bypass remains in
-- enforce_rate_limit and is independent of this trigger.
SELECT set_config('request.jwt.claim.sub', '14200000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"14200000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

INSERT INTO public.venues
  (name, type, city, city_id, address, lat, lng, approved)
VALUES
  ('M142 Admin Owner', 'sala_indoor', 'M142 Test City', 914200,
   'Test Address 3', 44.43, 26.13, false);

SELECT extensions.is(
  (SELECT submitted_by::text
   FROM public.venues
   WHERE name = 'M142 Admin Owner'),
  '14200000-0000-4000-8000-000000000002',
  'an admin submission is owned by the authenticated admin');

RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
