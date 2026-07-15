-- Migration 143: new cities use the current (country_code, name) uniqueness.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(4);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('14300000-0000-4000-8000-000000000001', 'm143-city@example.com', '{"full_name":"City Tester"}'::jsonb);

SELECT set_config('request.jwt.claim.sub', '14300000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"14300000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.lives_ok(
  $q$ SELECT public.find_or_create_city(
        'M143 New City', 'IE', 'Ireland', 53.3498, -6.2603, 12) $q$,
  'a genuinely new city can be created');

SELECT extensions.is(
  public.find_or_create_city('m143 new city', 'IE', 'Ireland', 53.35, -6.26, 13),
  (SELECT id FROM public.cities WHERE country_code = 'IE' AND name = 'M143 New City'),
  'case-insensitive retries return the existing city');

SELECT extensions.lives_ok(
  $q$ SELECT public.find_or_create_city(
        'M143 New City', 'US', 'United States', 40.0, -75.0, 12) $q$,
  'the same city name can exist in a different country');

SELECT extensions.is(
  (SELECT count(*)::int FROM public.cities WHERE name = 'M143 New City'),
  2,
  'country-scoped uniqueness keeps both same-named cities');

RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
