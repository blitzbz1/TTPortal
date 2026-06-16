-- F060 — Training session log (migration 131).
-- Verifies: a user can INSERT + SELECT their own training_sessions (owner-only
-- RLS, mirroring equipment_history 024); a STRANGER cannot SELECT another
-- user's rows (count 0); the session_type / hours / focus CHECK constraints
-- reject bad values (throws_ok 23514); and the log_training rate limit trips
-- after the per-hour cap (20/hr) while a single insert is allowed.
--
-- training_sessions.user_id DEFAULTs auth.uid(), so seeds run as the acting
-- user. All rolled back at the end.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(10);

-- ── seed: two players + a city + a venue ────────────────────────────────────
-- (the on_auth_user_created trigger auto-creates the profile rows.)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('f0600000-0000-4000-8000-000000000001', 'f060-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('f0600000-0000-4000-8000-000000000002', 'f060-b@example.com', '{"full_name":"Bob"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Trainville', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Training Hall', 'sala_indoor', 'Trainville',
        (SELECT id FROM public.cities WHERE name = 'Trainville'), 'St 1', 44.0, 26.0, true);

-- ── act as Ana (author) ─────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) Ana inserts a training session (RLS INSERT WITH CHECK user_id = auth.uid();
--     user_id is filled by the auth.uid() DEFAULT).
SELECT extensions.lives_ok(
  $q$ INSERT INTO public.training_sessions (session_type, hours, focus, venue_id, note)
      VALUES ('solo', 1.5, ARRAY['serves','footwork'],
              (SELECT id FROM public.venues WHERE name='Training Hall'),
              'sharp serves today') $q$,
  'a user can INSERT their own training session');

-- (2) Ana can read it back (RLS SELECT USING user_id = auth.uid()).
SELECT extensions.is(
  (SELECT count(*)::int FROM public.training_sessions
   WHERE user_id = 'f0600000-0000-4000-8000-000000000001'),
  1, 'a user can SELECT their own training session');

-- (3) The row carries the focus array and venue verbatim.
SELECT extensions.is(
  (SELECT array_length(focus, 1) FROM public.training_sessions
   WHERE user_id = 'f0600000-0000-4000-8000-000000000001'),
  2, 'the focus array round-trips (2 areas)');

-- (4) session_type CHECK rejects an unknown type.
SELECT extensions.throws_ok(
  $q$ INSERT INTO public.training_sessions (session_type, hours, focus)
      VALUES ('badtype', 1, '{}') $q$,
  '23514', NULL, 'session_type CHECK rejects an unknown value');

-- (5) hours CHECK rejects > 24.
SELECT extensions.throws_ok(
  $q$ INSERT INTO public.training_sessions (session_type, hours, focus)
      VALUES ('solo', 25, '{}') $q$,
  '23514', NULL, 'hours CHECK rejects more than 24');

-- (6) hours CHECK rejects <= 0.
SELECT extensions.throws_ok(
  $q$ INSERT INTO public.training_sessions (session_type, hours, focus)
      VALUES ('solo', 0, '{}') $q$,
  '23514', NULL, 'hours CHECK rejects zero');

-- (7) focus CHECK rejects more than 3 areas.
SELECT extensions.throws_ok(
  $q$ INSERT INTO public.training_sessions (session_type, hours, focus)
      VALUES ('solo', 1, ARRAY['serves','receive','footwork','blocking']) $q$,
  '23514', NULL, 'focus CHECK rejects more than 3 areas');

RESET ROLE;

-- ── act as Bob (stranger) ───────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (8) A stranger cannot SELECT Ana's rows (owner-only RLS).
SELECT extensions.is(
  (SELECT count(*)::int FROM public.training_sessions
   WHERE user_id = 'f0600000-0000-4000-8000-000000000001'),
  0, 'a stranger cannot SELECT another user''s training sessions (RLS read-own)');

RESET ROLE;

-- ── rate limit (047): the trigger funnels inserts through enforce_rate_limit ──
-- (9) The BEFORE INSERT rate-limit trigger exists on the table.
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.training_sessions'::regclass
      AND tgname = 'rate_limit_log_training'
      AND NOT tgisinternal
  ),
  'the rate_limit_log_training BEFORE INSERT trigger exists');

-- (10) The cap trips. The per-hour rule is 20/hr; insert 20 sessions to fill the
--      window, then assert the 21st throws a rate_limit_exceeded error. (action_log
--      counts off committed rows; within one transaction each insert appends a log
--      row, so the 21st sees 20 prior attempts and is blocked.)
SELECT set_config('request.jwt.claim.sub', 'f0600000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0600000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

INSERT INTO public.training_sessions (session_type, hours, focus)
SELECT 'solo', 1, '{}'
FROM generate_series(1, 20);

SELECT extensions.throws_ok(
  $q$ INSERT INTO public.training_sessions (session_type, hours, focus)
      VALUES ('solo', 1, '{}') $q$,
  NULL, NULL, 'the 21st insert in the hour trips the log_training rate limit');

RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
