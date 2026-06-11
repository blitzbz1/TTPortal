-- T020 invariant suite — the four highest-value regressions, run via
-- `supabase test db` (pgTAP). Everything runs in one transaction and
-- rolls back.
--
-- (a) notifications NOT in the supabase_realtime publication (the
--     postmortem's 6.22GB egress incident regression test)
-- (b) anon cannot read other users' checkins/profiles
-- (c) handle_new_user creates a profile row
-- (d) get_venues_delta returns only rows newer than the watermark

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Allow the PostgREST roles to call pgTAP inside this (rolled-back) txn so
-- assertions can run under SET ROLE.
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(9);

-- ----------------------------------------------------------------------
-- (a) realtime publication
-- ----------------------------------------------------------------------

SELECT extensions.is_empty(
  $$ SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'notifications' $$,
  'notifications is NOT in the supabase_realtime publication (postmortem)'
);

-- ----------------------------------------------------------------------
-- (c) handle_new_user (seeded first; (b) and (d) reuse the users)
-- ----------------------------------------------------------------------

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'tap-bob@example.com',
   '{"full_name": "Tap Bob"}'::jsonb),
  ('10000000-0000-4000-8000-000000000002', 'tap-eve@example.com',
   '{"full_name": "Tap Eve"}'::jsonb);

SELECT extensions.is(
  (SELECT count(*)::int FROM public.profiles
   WHERE id IN ('10000000-0000-4000-8000-000000000001',
                '10000000-0000-4000-8000-000000000002')),
  2,
  'handle_new_user creates a profile row per auth user'
);

-- ----------------------------------------------------------------------
-- (b) anon cannot read others' checkins/profiles
-- ----------------------------------------------------------------------

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Tapville', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Tap Venue', 'parc_exterior', 'Tapville',
        (SELECT id FROM public.cities WHERE name = 'Tapville'),
        'Tap St 1', 44.0, 26.0, true);

INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at)
VALUES ('10000000-0000-4000-8000-000000000001',
        (SELECT id FROM public.venues WHERE name = 'Tap Venue'),
        now(), now() + interval '2 hours');

SET LOCAL ROLE anon;

SELECT extensions.throws_ok(
  $$ SELECT email FROM public.profiles LIMIT 1 $$,
  '42501',
  NULL,
  'anon cannot select from profiles (085 column grants)'
);

SELECT extensions.is(
  (SELECT count(*)::int FROM public.checkins),
  0,
  'anon sees zero checkins'
);

RESET ROLE;

-- An authenticated stranger (eve, not friends with bob) sees nothing either.
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims',
  '{"sub": "10000000-0000-4000-8000-000000000002", "role": "authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  (SELECT count(*)::int FROM public.checkins
   WHERE user_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'authenticated stranger sees no foreign checkins (084/091 RLS)'
);

RESET ROLE;

-- ----------------------------------------------------------------------
-- (d) get_venues_delta watermark semantics
-- ----------------------------------------------------------------------

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Tap Venue Old', 'parc_exterior', 'Tapville',
        (SELECT id FROM public.cities WHERE name = 'Tapville'),
        'Tap St 2', 44.1, 26.1, true);

-- Backdate the "old" venue past the watermark. tg_set_updated_at would
-- overwrite the value, so disable triggers for this statement (superuser).
SET LOCAL session_replication_role = replica;
UPDATE public.venues SET updated_at = now() - interval '2 hours'
 WHERE name = 'Tap Venue Old';
UPDATE public.venues SET updated_at = now()
 WHERE name = 'Tap Venue';
SET LOCAL session_replication_role = DEFAULT;

SELECT extensions.ok(
  (SELECT public.get_venues_delta(now() - interval '1 hour', NULL, NULL)->'upserts')
    @> (SELECT jsonb_build_array(jsonb_build_object('id', id))
        FROM public.venues WHERE name = 'Tap Venue'),
  'delta includes rows newer than the watermark'
);

SELECT extensions.ok(
  NOT (
    (SELECT public.get_venues_delta(now() - interval '1 hour', NULL, NULL)->'upserts')
      @> (SELECT jsonb_build_array(jsonb_build_object('id', id))
          FROM public.venues WHERE name = 'Tap Venue Old')
  ),
  'delta excludes rows older than the watermark'
);

SELECT extensions.ok(
  (SELECT public.get_venues_delta(NULL, NULL, NULL)->'upserts')
    @> (SELECT jsonb_build_array(jsonb_build_object('id', id))
        FROM public.venues WHERE name = 'Tap Venue Old'),
  'cold sync (since=NULL) returns the full set'
);

SELECT extensions.ok(
  ((SELECT public.get_venues_delta(now() - interval '1 hour', NULL, NULL)) ? 'synced_at'),
  'delta payload carries synced_at for the next watermark'
);

SELECT extensions.finish();
ROLLBACK;
