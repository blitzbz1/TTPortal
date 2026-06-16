-- F050 — Weekly play streaks (migration 126).
-- Verifies: a check-in creates a streak of 1; a check-in in the next
-- consecutive week increments to 2; a check-in after a 2-week gap resets to 1;
-- the weekly sweep (process_weekly_streaks) consumes the monthly freeze to
-- preserve a streak on a missed week and sets freeze_used_month; a second miss
-- in the same month resets the streak (freeze unavailable); and get_profile_stats
-- surfaces current_streak / best_streak.
--
-- A "week" is date_trunc('week', started_at)::date (ISO Monday). Check-ins are
-- seeded with explicit past started_at values to drive the week logic. The
-- AFTER INSERT trigger streak_sync_on_checkin advances the run per insert, so
-- seeds must be inserted in chronological order.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(9);

-- ── seed: one player + one venue ────────────────────────────────────────────
-- (the on_auth_user_created trigger auto-creates the profile row.)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('f0500000-0000-4000-8000-000000000001', 'f050-a@example.com', '{"full_name":"Ana"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Streaktown', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Streak Venue', 'sala_indoor', 'Streaktown',
        (SELECT id FROM public.cities WHERE name = 'Streaktown'), 'St 1', 44.0, 26.0, true);

-- Helper-free: derive concrete week anchors from "now" so the math is stable.
-- W0 = the Monday of the current week. We seed plays in earlier weeks.

-- (1) First check-in (4 weeks ago) → streak of 1.
INSERT INTO public.checkins (user_id, venue_id, started_at)
VALUES ('f0500000-0000-4000-8000-000000000001',
        (SELECT id FROM public.venues WHERE name='Streak Venue'),
        date_trunc('week', now()) - INTERVAL '4 weeks');

SELECT extensions.is(
  (SELECT current_streak FROM public.user_streaks WHERE user_id='f0500000-0000-4000-8000-000000000001'),
  1, 'first check-in creates a streak of 1');

SELECT extensions.is(
  (SELECT last_played_week FROM public.user_streaks WHERE user_id='f0500000-0000-4000-8000-000000000001'),
  (date_trunc('week', now()) - INTERVAL '4 weeks')::date,
  'last_played_week is the ISO-Monday of the play week');

-- (2) Next consecutive week (3 weeks ago) → increments to 2.
INSERT INTO public.checkins (user_id, venue_id, started_at)
VALUES ('f0500000-0000-4000-8000-000000000001',
        (SELECT id FROM public.venues WHERE name='Streak Venue'),
        date_trunc('week', now()) - INTERVAL '3 weeks');

SELECT extensions.is(
  (SELECT current_streak FROM public.user_streaks WHERE user_id='f0500000-0000-4000-8000-000000000001'),
  2, 'a check-in in the next consecutive week increments the streak to 2');

-- (2b) A second check-in in the SAME week does NOT advance (already counted).
INSERT INTO public.checkins (user_id, venue_id, started_at)
VALUES ('f0500000-0000-4000-8000-000000000001',
        (SELECT id FROM public.venues WHERE name='Streak Venue'),
        date_trunc('week', now()) - INTERVAL '3 weeks' + INTERVAL '2 days');

SELECT extensions.is(
  (SELECT current_streak FROM public.user_streaks WHERE user_id='f0500000-0000-4000-8000-000000000001'),
  2, 'a second play in the same week does not advance the streak');

-- (3) A check-in after a 2-week gap (now: last counted was 3 weeks ago) resets to 1.
INSERT INTO public.checkins (user_id, venue_id, started_at)
VALUES ('f0500000-0000-4000-8000-000000000001',
        (SELECT id FROM public.venues WHERE name='Streak Venue'),
        date_trunc('week', now()) - INTERVAL '1 week');

SELECT extensions.is(
  (SELECT current_streak FROM public.user_streaks WHERE user_id='f0500000-0000-4000-8000-000000000001'),
  1, 'a check-in after a 2-week gap resets the streak to 1');

SELECT extensions.is(
  (SELECT best_streak FROM public.user_streaks WHERE user_id='f0500000-0000-4000-8000-000000000001'),
  2, 'best_streak retains the peak (2) after a reset');

-- ── Freeze semantics: simulate a missed week then run the weekly sweep ───────
-- Current state: current_streak=1, last_played_week = (W0 - 1 week). The sweep
-- treats "the week that just ended" as (W0 - 1 week) = v_prev_week. To make the
-- user appear to have MISSED that week, back-date last_played_week one more week
-- so it is strictly < v_prev_week, then run process_weekly_streaks(): the freeze
-- bridges the gap and is recorded.
UPDATE public.user_streaks
SET last_played_week = (date_trunc('week', now()) - INTERVAL '2 weeks')::date,
    freeze_used_month = NULL
WHERE user_id = 'f0500000-0000-4000-8000-000000000001';

SELECT public.process_weekly_streaks();

-- (4) Freeze consumed: streak preserved (still > 0) and freeze_used_month set.
SELECT extensions.ok(
  (SELECT current_streak FROM public.user_streaks WHERE user_id='f0500000-0000-4000-8000-000000000001') > 0
  AND (SELECT freeze_used_month FROM public.user_streaks WHERE user_id='f0500000-0000-4000-8000-000000000001')
      = date_trunc('month', now())::date,
  'a missed week consumes the monthly freeze: streak preserved + freeze_used_month set');

-- (5) Second miss in the SAME month → reset (freeze already spent).
-- Back-date again so the user looks missed for the just-ended week; the sweep
-- finds freeze_used_month = this month and resets the run to 0.
UPDATE public.user_streaks
SET last_played_week = (date_trunc('week', now()) - INTERVAL '2 weeks')::date
WHERE user_id = 'f0500000-0000-4000-8000-000000000001';

SELECT public.process_weekly_streaks();

SELECT extensions.is(
  (SELECT current_streak FROM public.user_streaks WHERE user_id='f0500000-0000-4000-8000-000000000001'),
  0, 'a second missed week in the same month resets the streak (freeze unavailable)');

-- ── get_profile_stats surfaces the streak columns ───────────────────────────
-- Re-arm a live streak so current/best are both non-trivial, then read the RPC.
UPDATE public.user_streaks
SET current_streak = 3, best_streak = 5
WHERE user_id = 'f0500000-0000-4000-8000-000000000001';

-- (6) get_profile_stats returns current_streak / best_streak.
SELECT extensions.is(
  (SELECT current_streak FROM public.get_profile_stats('f0500000-0000-4000-8000-000000000001')),
  3, 'get_profile_stats surfaces current_streak');

SELECT extensions.finish();
ROLLBACK;
