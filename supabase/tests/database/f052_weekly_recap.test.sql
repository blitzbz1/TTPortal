-- F052 — Weekly recap "Your week in TT" (migration 128).
-- Verifies: get_weekly_recap returns correct sessions / venues / hours for a
-- seeded week; new_venues counts only venues whose FIRST-EVER visit falls in the
-- window; friends_played_with unnests checkins.friends[]; an INACTIVE user's
-- recap is all-zeros; send_weekly_recaps() enqueues exactly one 'weekly_recap'
-- notification for a user who played the just-ended week but NONE for an inactive
-- user (the "no guilt spam" rule), and is idempotent (the NOT EXISTS de-dupe);
-- and notifications_type_check accepts 'weekly_recap'.
--
-- The recap windows on date_trunc('week', started_at). send_weekly_recaps()
-- targets the JUST-ENDED week = date_trunc('week', now())::date - 7, so the
-- "active" user's plays are seeded into that week. checkins AFTER INSERT triggers
-- (streak/explorer, F050/F051) fire harmlessly here.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(11);

-- ── seed: two players + a city + two venues + a friend tag target ────────────
-- (the on_auth_user_created trigger auto-creates the profile rows.)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('d0520000-0000-4000-8000-000000000001', 'f052-active@example.com',   '{"full_name":"Ana"}'::jsonb),
  ('d0520000-0000-4000-8000-000000000002', 'f052-inactive@example.com', '{"full_name":"Bob"}'::jsonb),
  ('d0520000-0000-4000-8000-000000000003', 'f052-friend@example.com',   '{"full_name":"Cara"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Recaptown', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved) VALUES
  ('Recap Venue 1', 'sala_indoor', 'Recaptown', (SELECT id FROM public.cities WHERE name='Recaptown'), 'R1', 44.0, 26.0, true),
  ('Recap Venue 2', 'sala_indoor', 'Recaptown', (SELECT id FROM public.cities WHERE name='Recaptown'), 'R2', 44.0, 26.0, true);

-- Week anchors derived from now() so the math is stable regardless of run date.
-- W_PREV = the Monday of the week that JUST ENDED (what send_weekly_recaps targets).
-- We seed Ana's plays into W_PREV.

-- ── Ana: two sessions in W_PREV across TWO distinct venues (2h + 1h). ─────────
-- Venue 1: 2-hour session, tagging Cara as a co-player.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at, friends) VALUES
  ('d0520000-0000-4000-8000-000000000001',
   (SELECT id FROM public.venues WHERE name='Recap Venue 1'),
   date_trunc('week', now()) - INTERVAL '7 days' + INTERVAL '1 day',
   date_trunc('week', now()) - INTERVAL '7 days' + INTERVAL '1 day' + INTERVAL '2 hours',
   ARRAY['d0520000-0000-4000-8000-000000000003']::uuid[]);
-- Venue 2: 1-hour session.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at) VALUES
  ('d0520000-0000-4000-8000-000000000001',
   (SELECT id FROM public.venues WHERE name='Recap Venue 2'),
   date_trunc('week', now()) - INTERVAL '7 days' + INTERVAL '2 days',
   date_trunc('week', now()) - INTERVAL '7 days' + INTERVAL '2 days' + INTERVAL '1 hour');

-- A PRE-window visit to Venue 1 (3 weeks ago) so Venue 1 is NOT new this week,
-- while Venue 2's first-ever visit is inside the window (so it IS new).
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at) VALUES
  ('d0520000-0000-4000-8000-000000000001',
   (SELECT id FROM public.venues WHERE name='Recap Venue 1'),
   date_trunc('week', now()) - INTERVAL '21 days',
   date_trunc('week', now()) - INTERVAL '21 days' + INTERVAL '1 hour');

-- ── get_weekly_recap for Ana over W_PREV ─────────────────────────────────────
-- (1) sessions = 2 in-window checkins (the 3-weeks-ago one is excluded).
SELECT extensions.is(
  (SELECT sessions FROM public.get_weekly_recap(
     'd0520000-0000-4000-8000-000000000001',
     (date_trunc('week', now()) - INTERVAL '7 days')::date)),
  2, 'sessions counts only in-window checkins');

-- (2) venues = 2 distinct in-window venues.
SELECT extensions.is(
  (SELECT venues FROM public.get_weekly_recap(
     'd0520000-0000-4000-8000-000000000001',
     (date_trunc('week', now()) - INTERVAL '7 days')::date)),
  2, 'venues counts distinct in-window venues');

-- (3) hours = 2h + 1h checkin durations = 3.0 (no events seeded).
SELECT extensions.is(
  (SELECT hours FROM public.get_weekly_recap(
     'd0520000-0000-4000-8000-000000000001',
     (date_trunc('week', now()) - INTERVAL '7 days')::date)),
  3.0, 'hours sums in-window checkin durations');

-- (4) new_venues = 1 (Venue 2 first-seen in-window; Venue 1 first-seen earlier).
SELECT extensions.is(
  (SELECT new_venues FROM public.get_weekly_recap(
     'd0520000-0000-4000-8000-000000000001',
     (date_trunc('week', now()) - INTERVAL '7 days')::date)),
  1, 'new_venues counts only first-ever visits inside the window');

-- (5) friends_played_with = 1 (Cara tagged on the Venue 1 session).
SELECT extensions.is(
  (SELECT friends_played_with FROM public.get_weekly_recap(
     'd0520000-0000-4000-8000-000000000001',
     (date_trunc('week', now()) - INTERVAL '7 days')::date)),
  1, 'friends_played_with unnests checkins.friends[]');

-- (6) rank is non-null for the active user (they appear in the week's ranking).
SELECT extensions.ok(
  (SELECT rank FROM public.get_weekly_recap(
     'd0520000-0000-4000-8000-000000000001',
     (date_trunc('week', now()) - INTERVAL '7 days')::date)) IS NOT NULL,
  'rank is populated for a user who checked in during the window');

-- ── inactive user (Bob): all-zeros recap ─────────────────────────────────────
-- (7) sessions = 0.
SELECT extensions.is(
  (SELECT sessions FROM public.get_weekly_recap(
     'd0520000-0000-4000-8000-000000000002',
     (date_trunc('week', now()) - INTERVAL '7 days')::date)),
  0, 'an inactive user gets a zero-sessions recap');

-- (8) rank is NULL for the inactive user (absent from the ranking).
SELECT extensions.ok(
  (SELECT rank FROM public.get_weekly_recap(
     'd0520000-0000-4000-8000-000000000002',
     (date_trunc('week', now()) - INTERVAL '7 days')::date)) IS NULL,
  'an inactive user has a NULL weekly rank');

-- ── Monday fan-out: only users who played get a 'weekly_recap' ───────────────
SELECT public.send_weekly_recaps();

-- (9) the active user (Ana) received exactly one 'weekly_recap' for W_PREV.
SELECT extensions.is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = 'd0520000-0000-4000-8000-000000000001'
     AND type = 'weekly_recap'
     AND data->>'period' = (date_trunc('week', now())::date - 7)::text),
  1, 'send_weekly_recaps enqueues one recap for a user who played');

-- (10) the inactive user (Bob) received NO 'weekly_recap' (no guilt spam).
SELECT extensions.is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = 'd0520000-0000-4000-8000-000000000002'
     AND type = 'weekly_recap'),
  0, 'send_weekly_recaps does NOT notify an inactive user');

-- (11) re-running is idempotent (the NOT EXISTS de-dupe): still exactly one.
SELECT public.send_weekly_recaps();
SELECT extensions.is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = 'd0520000-0000-4000-8000-000000000001'
     AND type = 'weekly_recap'),
  1, 'send_weekly_recaps is idempotent — no duplicate recap on re-run');

SELECT extensions.finish();
ROLLBACK;
