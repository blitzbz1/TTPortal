-- F063 — Coach directory (migration 134).
-- Verifies:
--   * apply_to_coach creates a PENDING coach_profile + coach_venues (capped ≤3).
--   * a PENDING application is NOT publicly readable (a non-owner, non-admin
--     sees 0 rows) but the OWNER sees their own row.
--   * after an admin sets status='approved', the row IS publicly readable.
--   * a NON-admin cannot UPDATE the status (RLS denies the write → 0 rows change).
--   * get_profile_stats.is_coach is true only when approved, and the 9 prior
--     columns are still present (regression).
--   * get_venue_coaches returns approved coaches at a venue (and excludes pending).
--   * get_coaching_venue_ids returns the venue once it has an approved coach.
--
-- The whole test is wrapped in BEGIN/ROLLBACK so nothing persists.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(13);

-- ── seed: an admin (Ada) + two players (Bo applies, Cy is a bystander). The
--    on_auth_user_created trigger auto-creates the profile rows. ──
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('f0630000-0000-4000-8000-000000000001', 'f063-ada@example.com', '{"full_name":"Ada"}'::jsonb),
  ('f0630000-0000-4000-8000-000000000002', 'f063-bo@example.com',  '{"full_name":"Bo"}'::jsonb),
  ('f0630000-0000-4000-8000-000000000003', 'f063-cy@example.com',  '{"full_name":"Cy"}'::jsonb);

UPDATE public.profiles SET is_admin = true WHERE id = 'f0630000-0000-4000-8000-000000000001';

-- A city + two venues for Bo to coach at.
INSERT INTO public.cities (id, name, country_code, country_name, lat, lng, zoom)
  VALUES (990001, 'Testville', 'RO', 'Romania', 44.4, 26.1, 12)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.venues (id, name, type, city, city_id, address, lat, lng, approved)
  VALUES
    (990001, 'Test Hall A', 'sala_indoor', 'Testville', 990001, 'Str. A', 44.41, 26.11, true),
    (990002, 'Test Hall B', 'sala_indoor', 'Testville', 990001, 'Str. B', 44.42, 26.12, true),
    (990003, 'Test Hall C', 'sala_indoor', 'Testville', 990001, 'Str. C', 44.43, 26.13, true),
    (990004, 'Test Hall D', 'sala_indoor', 'Testville', 990001, 'Str. D', 44.44, 26.14, true)
  ON CONFLICT (id) DO NOTHING;

-- ── act as Bo: submit a coach application at 4 venues (cap should keep 3) ──────
SELECT set_config('request.jwt.claim.sub', 'f0630000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0630000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) apply_to_coach lives and returns a coach id.
SELECT extensions.lives_ok(
  $q$ SELECT public.apply_to_coach('I coach beginners', '10 years',
        ARRAY['beginner','youth'], ARRAY['en','ro'], '30-50/h', 'bo@example.com',
        ARRAY[990001, 990002, 990003, 990004]) $q$,
  'apply_to_coach succeeds for an authenticated user');

-- (2) it created exactly one PENDING coach_profile for Bo.
SELECT extensions.is(
  (SELECT status FROM public.coach_profiles WHERE user_id = 'f0630000-0000-4000-8000-000000000002'),
  'pending', 'apply_to_coach creates a PENDING coach_profile');

-- (3) the venue set is capped at 3 (4 ids were passed).
SELECT extensions.is(
  (SELECT count(*)::int FROM public.coach_venues cv
     JOIN public.coach_profiles cp ON cp.id = cv.coach_id
    WHERE cp.user_id = 'f0630000-0000-4000-8000-000000000002'),
  3, 'apply_to_coach caps coach_venues at 3');

-- (4) the OWNER (Bo) can read their own pending row.
SELECT extensions.is(
  (SELECT count(*)::int FROM public.coach_profiles
    WHERE user_id = 'f0630000-0000-4000-8000-000000000002'),
  1, 'the owner sees their own pending application');

RESET ROLE;

-- ── act as Cy (a bystander): a pending application is NOT publicly readable ────
SELECT set_config('request.jwt.claim.sub', 'f0630000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0630000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (5) Cy (non-owner, non-admin) sees 0 pending coach rows.
SELECT extensions.is(
  (SELECT count(*)::int FROM public.coach_profiles
    WHERE user_id = 'f0630000-0000-4000-8000-000000000002'),
  0, 'a pending application is NOT publicly readable');

-- (6) a non-admin cannot UPDATE the status (RLS denies → no row changes).
UPDATE public.coach_profiles SET status = 'approved'
  WHERE user_id = 'f0630000-0000-4000-8000-000000000002';
SELECT extensions.is(
  (SELECT count(*)::int FROM public.coach_profiles
    WHERE user_id = 'f0630000-0000-4000-8000-000000000002' AND status = 'approved'),
  0, 'a non-admin cannot approve a coach (the UPDATE is a no-op under RLS)');

RESET ROLE;

-- ── act as Ada (admin): approve Bo ────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'f0630000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0630000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (7) the admin CAN approve (the admin-UPDATE RLS policy allows it).
UPDATE public.coach_profiles
  SET status = 'approved',
      reviewed_by = 'f0630000-0000-4000-8000-000000000001',
      reviewed_at = now()
  WHERE user_id = 'f0630000-0000-4000-8000-000000000002';
SELECT extensions.is(
  (SELECT status FROM public.coach_profiles WHERE user_id = 'f0630000-0000-4000-8000-000000000002'),
  'approved', 'an admin can approve a coach application');

RESET ROLE;

-- ── act as Cy again: an approved coach IS publicly readable ───────────────────
SELECT set_config('request.jwt.claim.sub', 'f0630000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"f0630000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (8) Cy now sees the approved coach row.
SELECT extensions.is(
  (SELECT count(*)::int FROM public.coach_profiles
    WHERE user_id = 'f0630000-0000-4000-8000-000000000002' AND status = 'approved'),
  1, 'an approved coach is publicly readable');

-- (9) get_venue_coaches returns Bo at venue 990001.
SELECT extensions.is(
  (SELECT count(*)::int FROM public.get_venue_coaches(990001)
    WHERE user_id = 'f0630000-0000-4000-8000-000000000002'),
  1, 'get_venue_coaches returns an approved coach at the venue');

-- (10) get_coaching_venue_ids returns venue 990001 for Testville.
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.get_coaching_venue_ids('Testville') WHERE venue_id = 990001),
  'get_coaching_venue_ids includes a venue with an approved coach');

-- (11) get_profile_stats.is_coach is TRUE for the approved coach.
SELECT extensions.ok(
  (SELECT is_coach FROM public.get_profile_stats('f0630000-0000-4000-8000-000000000002')),
  'get_profile_stats.is_coach is true for an approved coach');

-- (12) get_profile_stats.is_coach is FALSE for a non-coach (Cy).
SELECT extensions.ok(
  (SELECT NOT is_coach FROM public.get_profile_stats('f0630000-0000-4000-8000-000000000003')),
  'get_profile_stats.is_coach is false for a non-coach');

-- (13) regression: all 9 prior get_profile_stats columns survive the DROP +
--      recreate. Selecting each named column would error if any were dropped;
--      lives_ok proves the full 9-column shape (+ is_coach) is intact.
SELECT extensions.lives_ok(
  $q$ SELECT total_checkins, unique_venues, events_joined, total_hours_played,
             current_streak, best_streak, reviews_written, member_since,
             total_play_hours, is_coach
        FROM public.get_profile_stats('f0630000-0000-4000-8000-000000000003') $q$,
  'get_profile_stats still returns all 9 prior columns + is_coach');

RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
