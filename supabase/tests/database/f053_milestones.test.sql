-- F053 — Lifetime milestone moments (migration 129).
-- Verifies: the 10th check-in inserts the 'checkin_10' milestone (and not
-- before); re-firing the trigger (an 11th check-in) does not double-award;
-- distinct-venue + hours thresholds award their keys; the first review awards
-- 'first_review'; get_profile_stats surfaces reviews_written + member_since AND
-- still carries the six prior columns (regression-checks the F050 streak
-- columns); and a stranger cannot read another user's milestones (RLS).
--
-- The AFTER INSERT triggers milestones_sync_on_checkin / _on_event_participant
-- / _on_review award the durable rows per insert, so seeds are inserted as the
-- acting user so DEFAULT auth.uid() / the worker attribute rows correctly.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(12);

-- Milestones are LIFETIME (10/50/100 check-ins accrued over days), but this test
-- compresses them into one transaction, which trips the per-window check-in rate
-- limit (047: 10/300s). Disable just that BEFORE INSERT guard for the seed; the
-- milestone sync triggers (milestones_sync_on_checkin etc.) stay enabled. All
-- rolled back at the end.
ALTER TABLE public.checkins DISABLE TRIGGER rate_limit_checkin;

-- ── seed: two players + a city + venues ─────────────────────────────────────
-- (the on_auth_user_created trigger auto-creates the profile rows.)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('d0530000-0000-4000-8000-000000000001', 'f053-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('d0530000-0000-4000-8000-000000000002', 'f053-b@example.com', '{"full_name":"Bob"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Milestown', 'RO', 'Romania', 44.0, 26.0);

-- 12 distinct venues (enough to cross the 10-distinct-venue milestone).
INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
SELECT
  'Venue ' || g,
  'sala_indoor',
  'Milestown',
  (SELECT id FROM public.cities WHERE name='Milestown'),
  'Addr ' || g,
  44.0, 26.0, true
FROM generate_series(1, 12) g;

-- ── act as Ana ──────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'd0530000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"d0530000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- (1) Nine check-ins to the SAME venue → checkin_10 NOT yet awarded (9 < 10),
--     and only 1 distinct venue.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at)
SELECT 'd0530000-0000-4000-8000-000000000001',
       (SELECT id FROM public.venues WHERE name='Venue 1'),
       now() - (g || ' days')::interval,
       now() - (g || ' days')::interval + INTERVAL '1 hour'
FROM generate_series(1, 9) g;

SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.user_milestones
              WHERE user_id='d0530000-0000-4000-8000-000000000001' AND milestone_key='checkin_10'),
  'checkin_10 is NOT awarded at 9 check-ins');

-- (2) The 10th check-in crosses the threshold → checkin_10 awarded.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at)
VALUES ('d0530000-0000-4000-8000-000000000001',
        (SELECT id FROM public.venues WHERE name='Venue 1'),
        now(), now() + INTERVAL '1 hour');

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.user_milestones
          WHERE user_id='d0530000-0000-4000-8000-000000000001' AND milestone_key='checkin_10'),
  'the 10th check-in awards checkin_10');

-- (3) Idempotency: an 11th check-in does not add a second checkin_10 row.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at)
VALUES ('d0530000-0000-4000-8000-000000000001',
        (SELECT id FROM public.venues WHERE name='Venue 1'),
        now(), now() + INTERVAL '1 hour');

SELECT extensions.is(
  (SELECT count(*)::int FROM public.user_milestones
   WHERE user_id='d0530000-0000-4000-8000-000000000001' AND milestone_key='checkin_10'),
  1, 'an 11th check-in does not double-award checkin_10 (UNIQUE + ON CONFLICT)');

-- (4) Distinct-venue milestone: visiting 9 MORE distinct venues (Venue 2..10)
--     reaches 10 distinct venues → venues_10 awarded.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at)
SELECT 'd0530000-0000-4000-8000-000000000001',
       (SELECT id FROM public.venues WHERE name='Venue ' || g),
       now(), now() + INTERVAL '1 hour'
FROM generate_series(2, 10) g;

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.user_milestones
          WHERE user_id='d0530000-0000-4000-8000-000000000001' AND milestone_key='venues_10'),
  'reaching 10 distinct venues awards venues_10');

SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.user_milestones
              WHERE user_id='d0530000-0000-4000-8000-000000000001' AND milestone_key='venues_25'),
  'venues_25 is NOT awarded at 10 distinct venues');

-- (5) Hours milestone: one long check-in (60h) crosses hours_50 (checkin
--     durations contribute to the hours total).
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at)
VALUES ('d0530000-0000-4000-8000-000000000001',
        (SELECT id FROM public.venues WHERE name='Venue 11'),
        now(), now() + INTERVAL '60 hours');

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.user_milestones
          WHERE user_id='d0530000-0000-4000-8000-000000000001' AND milestone_key='hours_50'),
  'crossing 50 total hours awards hours_50');

-- (6) first_review: Ana's first review awards first_review.
INSERT INTO public.reviews (venue_id, user_id, rating, body)
VALUES ((SELECT id FROM public.venues WHERE name='Venue 1'),
        'd0530000-0000-4000-8000-000000000001', 5, 'Great tables');

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.user_milestones
          WHERE user_id='d0530000-0000-4000-8000-000000000001' AND milestone_key='first_review'),
  'the first review awards first_review');

-- (7) A second review does not add a duplicate first_review row.
INSERT INTO public.reviews (venue_id, user_id, rating, body)
VALUES ((SELECT id FROM public.venues WHERE name='Venue 2'),
        'd0530000-0000-4000-8000-000000000001', 4, 'Solid');

SELECT extensions.is(
  (SELECT count(*)::int FROM public.user_milestones
   WHERE user_id='d0530000-0000-4000-8000-000000000001' AND milestone_key='first_review'),
  1, 'a second review does not double-award first_review');

-- ── get_profile_stats: new columns + the six prior columns intact ───────────
-- (8) reviews_written reflects the two reviews.
SELECT extensions.is(
  (SELECT reviews_written FROM public.get_profile_stats('d0530000-0000-4000-8000-000000000001')),
  2, 'get_profile_stats surfaces reviews_written');

-- (9) member_since is non-null (the profile created_at).
SELECT extensions.ok(
  (SELECT member_since FROM public.get_profile_stats('d0530000-0000-4000-8000-000000000001')) IS NOT NULL,
  'get_profile_stats surfaces member_since');

-- (10) Regression: the F050 streak columns are still present (a check-in
--      created a live streak, so current_streak >= 1).
SELECT extensions.ok(
  (SELECT current_streak FROM public.get_profile_stats('d0530000-0000-4000-8000-000000000001')) >= 1,
  'get_profile_stats still carries the F050 current_streak column');

-- ── RLS: Bob cannot read Ana's milestones ───────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'd0530000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"d0530000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  (SELECT count(*)::int FROM public.user_milestones
   WHERE user_id='d0530000-0000-4000-8000-000000000001'),
  0, 'a stranger cannot read another user''s milestones (RLS SELECT-own)');

SELECT extensions.finish();
ROLLBACK;
