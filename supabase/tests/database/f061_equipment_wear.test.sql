-- F061 — Rubber wear tracker with replacement reminders (migration 132).
-- Verifies:
--   * get_rubber_wear sums ALL THREE play-hour sources since installed_at — a
--     check-in, an event participation, and a training session AFTER the install
--     date all count; identical activity BEFORE the install date is excluded.
--   * set_rubber_install UPSERTs the per-side setting and resets notified_pct=0
--     (the once-only sent-flag) on re-rubber.
--   * process_rubber_wear() pushes the 80% reminder once, then the 100% reminder
--     once, advancing notified_pct so neither re-fires; a re-rubber
--     (set_rubber_install) re-arms both.
--   * a STRANGER cannot SELECT another user's wear settings (owner-only RLS).
--   * notifications_type_check accepts the new 'rubber_wear' type.
--
-- We seed several check-ins, so the rate_limit_checkin trigger is DISABLED at the
-- top (the whole test is wrapped in BEGIN/ROLLBACK, so this never persists — the
-- f053/f054 idiom). The streak/milestone AFTER INSERT triggers fire harmlessly.

BEGIN;
ALTER TABLE public.checkins DISABLE TRIGGER rate_limit_checkin;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(14);

-- ── seed: two players + a city + an indoor venue ─────────────────────────────
-- (the on_auth_user_created trigger auto-creates the profile rows.)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('f0610000-0000-4000-8000-000000000001', 'f061-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('f0610000-0000-4000-8000-000000000002', 'f061-b@example.com', '{"full_name":"Bob"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Wearville', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Wear Hall', 'sala_indoor', 'Wearville',
        (SELECT id FROM public.cities WHERE name = 'Wearville'), 'St 1', 44.0, 26.0, true);

-- An event organised by Ana that STARTED after the install date (its hours count).
INSERT INTO public.events (title, venue_id, organizer_id, starts_at, status)
VALUES ('In-window event',
        (SELECT id FROM public.venues WHERE name = 'Wear Hall'),
        'f0610000-0000-4000-8000-000000000001',
        '2025-02-01 10:00:00+00', 'open');

-- ── Ana's wear sources, windowed around installed_at = 2025-01-01 ────────────
-- AFTER install (these count toward estimated_hours):
--   * a check-in: 2025-01-05, 4 hours.
--   * an event participation: 6 hours (event starts_at 2025-02-01).
--   * a training session: created_at default now() (>= 2025-01-01), 2 hours.
-- BEFORE install (must be EXCLUDED):
--   * a check-in: 2024-12-20, 10 hours.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at) VALUES
  ('f0610000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Wear Hall'),
   '2025-01-05 10:00:00+00', '2025-01-05 14:00:00+00'),   -- 4h, in-window
  ('f0610000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Wear Hall'),
   '2024-12-20 10:00:00+00', '2024-12-20 20:00:00+00');   -- 10h, BEFORE install

INSERT INTO public.event_participants (event_id, user_id, hours_played) VALUES
  ((SELECT id FROM public.events WHERE title='In-window event'),
   'f0610000-0000-4000-8000-000000000001', 6.0);          -- 6h, in-window

INSERT INTO public.training_sessions (user_id, session_type, hours, focus) VALUES
  ('f0610000-0000-4000-8000-000000000001', 'solo', 2.0, '{}'); -- 2h, in-window (created_at now())

-- ── act as Ana ───────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'f0610000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0610000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) set_rubber_install creates the forehand tracker (installed_at 2025-01-01,
--     expected 60h) via the DEFINER write RPC.
SELECT extensions.lives_ok(
  $q$ SELECT public.set_rubber_install('forehand', '2025-01-01', 60) $q$,
  'set_rubber_install installs the forehand tracker');

-- (2) The setting round-trips with notified_pct = 0 (owner-readable RLS).
SELECT extensions.is(
  (SELECT notified_pct FROM public.equipment_wear_settings
   WHERE user_id = 'f0610000-0000-4000-8000-000000000001' AND side = 'forehand'),
  0, 'a fresh install starts with notified_pct = 0');

-- (3) get_rubber_wear sums the THREE in-window sources: 4 + 6 + 2 = 12.0h.
--     (The 10h pre-install check-in is excluded.)
SELECT extensions.is(
  (SELECT estimated_hours FROM public.get_rubber_wear('f0610000-0000-4000-8000-000000000001')
   WHERE side = 'forehand'),
  12.0, 'get_rubber_wear sums check-in + event + training hours since installed_at');

-- (4) pct = round(12 / 60 * 100) = 20.
SELECT extensions.is(
  (SELECT pct FROM public.get_rubber_wear('f0610000-0000-4000-8000-000000000001')
   WHERE side = 'forehand'),
  20, 'get_rubber_wear computes pct = round(estimated / expected * 100)');

RESET ROLE;

-- ── threshold reminders: drive pct into the 80% band, then 100% ──────────────
-- Lower expected_hours so the existing 12h of play crosses thresholds without
-- seeding more rows. We write expected directly (the DEFINER setting table);
-- notified_pct stays 0 from the install above. expected = 14 → 12/14 = 86% (>=80,
-- <100).
UPDATE public.equipment_wear_settings
SET expected_hours = 14
WHERE user_id = 'f0610000-0000-4000-8000-000000000001' AND side = 'forehand';

-- (5) First sweep: fires the 80% reminder exactly once and sets notified_pct=80.
SELECT public.process_rubber_wear();

SELECT extensions.is(
  (SELECT notified_pct FROM public.equipment_wear_settings
   WHERE user_id = 'f0610000-0000-4000-8000-000000000001' AND side = 'forehand'),
  80, 'process_rubber_wear advances notified_pct to 80 at the 80% threshold');

SELECT extensions.is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = 'f0610000-0000-4000-8000-000000000001' AND type = 'rubber_wear'),
  1, 'process_rubber_wear pushes exactly one rubber_wear reminder at 80%');

-- (6) A second sweep at the SAME band does NOT re-fire (notified_pct already 80).
SELECT public.process_rubber_wear();

SELECT extensions.is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = 'f0610000-0000-4000-8000-000000000001' AND type = 'rubber_wear'),
  1, 'the 80% reminder is once-only (a re-run does not re-fire it)');

-- (7) Drop expected below the play hours → pct >= 100. The next sweep fires the
--     100% reminder once and advances notified_pct to 100.
UPDATE public.equipment_wear_settings
SET expected_hours = 10
WHERE user_id = 'f0610000-0000-4000-8000-000000000001' AND side = 'forehand';

SELECT public.process_rubber_wear();

SELECT extensions.is(
  (SELECT notified_pct FROM public.equipment_wear_settings
   WHERE user_id = 'f0610000-0000-4000-8000-000000000001' AND side = 'forehand'),
  100, 'process_rubber_wear advances notified_pct to 100 at the 100% threshold');

SELECT extensions.is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = 'f0610000-0000-4000-8000-000000000001' AND type = 'rubber_wear'),
  2, 'process_rubber_wear pushes the 100% reminder once (2 total: 80% + 100%)');

-- (8) Another sweep at 100% does not re-fire.
SELECT public.process_rubber_wear();
SELECT extensions.is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = 'f0610000-0000-4000-8000-000000000001' AND type = 'rubber_wear'),
  2, 'the 100% reminder is once-only');

-- ── re-rubber re-arms the reminders ──────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'f0610000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0610000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (9) set_rubber_install on the SAME side resets notified_pct to 0 (UPSERT path).
SELECT public.set_rubber_install('forehand', '2025-01-01', 10);
SELECT extensions.is(
  (SELECT notified_pct FROM public.equipment_wear_settings
   WHERE user_id = 'f0610000-0000-4000-8000-000000000001' AND side = 'forehand'),
  0, 'a re-rubber (set_rubber_install) resets notified_pct to 0');

RESET ROLE;

-- (10) After the re-rubber, a sweep re-fires (pct >= 100 again, flag re-armed).
SELECT public.process_rubber_wear();
SELECT extensions.is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = 'f0610000-0000-4000-8000-000000000001' AND type = 'rubber_wear'),
  3, 'a re-rubber re-arms the reminder (it fires again on the next sweep)');

-- ── RLS: a stranger cannot read another user's wear settings ─────────────────
SELECT set_config('request.jwt.claim.sub', 'f0610000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0610000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (11) Bob sees none of Ana's wear settings (owner-only SELECT RLS).
SELECT extensions.is(
  (SELECT count(*)::int FROM public.equipment_wear_settings
   WHERE user_id = 'f0610000-0000-4000-8000-000000000001'),
  0, 'a stranger cannot SELECT another user''s wear settings (RLS read-own)');

RESET ROLE;

-- (12) notifications_type_check accepts 'rubber_wear'.
INSERT INTO public.notifications (recipient_id, type, title, body, data) VALUES
  ('f0610000-0000-4000-8000-000000000001', 'rubber_wear', 'x', 'y',
   jsonb_build_object('side', 'forehand', 'pct', 100));
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.notifications
          WHERE recipient_id = 'f0610000-0000-4000-8000-000000000001'
            AND type = 'rubber_wear' AND data->>'side' = 'forehand'),
  'notifications_type_check accepts rubber_wear');

SELECT extensions.finish();
ROLLBACK;
