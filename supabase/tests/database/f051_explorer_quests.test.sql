-- F051 — Venue explorer quests (migration 127).
-- Verifies: checking into N distinct venues advances get_explorer_progress.progress;
-- crossing a tier inserts an explorer_quest_awards row; the award is idempotent
-- (a repeat check-in to a known venue neither double-counts the progress nor
-- re-awards); get_explorer_progress earned_* flags reflect the awards;
-- predicate-scoped quests (park/indoor) only count matching venue types; a
-- stranger cannot read another user's awards (RLS); and get_unvisited_venue_ids
-- excludes venues the caller has already visited.
--
-- The AFTER INSERT trigger explorer_quests_sync_on_checkin recomputes the
-- distinct-venue counts and awards crossed tiers per check-in, so seeds are
-- inserted as the acting user (auth.uid()) so DEFAULT auth.uid() / the worker
-- attribute rows correctly.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(12);

-- ── seed: two players + a city + venues of each type ────────────────────────
-- (the on_auth_user_created trigger auto-creates the profile rows.)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('c0510000-0000-4000-8000-000000000001', 'f051-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('c0510000-0000-4000-8000-000000000002', 'f051-b@example.com', '{"full_name":"Bob"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Explortown', 'RO', 'Romania', 44.0, 26.0);

-- 6 venues: 4 parks (one verified) + 2 indoor halls.
INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, verified, approved) VALUES
  ('Park 1',   'parc_exterior', 'Explortown', (SELECT id FROM public.cities WHERE name='Explortown'), 'A1', 44.0, 26.0, true,  true),
  ('Park 2',   'parc_exterior', 'Explortown', (SELECT id FROM public.cities WHERE name='Explortown'), 'A2', 44.0, 26.0, false, true),
  ('Park 3',   'parc_exterior', 'Explortown', (SELECT id FROM public.cities WHERE name='Explortown'), 'A3', 44.0, 26.0, false, true),
  ('Park 4',   'parc_exterior', 'Explortown', (SELECT id FROM public.cities WHERE name='Explortown'), 'A4', 44.0, 26.0, false, true),
  ('Hall 1',   'sala_indoor',   'Explortown', (SELECT id FROM public.cities WHERE name='Explortown'), 'B1', 44.0, 26.0, false, true),
  ('Hall 2',   'sala_indoor',   'Explortown', (SELECT id FROM public.cities WHERE name='Explortown'), 'B2', 44.0, 26.0, false, true);

-- (0) the three launch quests were seeded by the migration.
SELECT extensions.is(
  (SELECT count(*)::int FROM public.explorer_quests),
  3, 'migration seeds the three launch quests');

-- ── act as Ana ──────────────────────────────────────────────────────────────
-- The jwt claim drives auth.uid() inside the SECURITY DEFINER read RPCs. Seed
-- check-ins as the table owner (no role switch) so the AFTER INSERT trigger's
-- DEFINER worker runs without tripping checkins INSERT RLS; the explicit
-- user_id attributes every row to Ana.
SELECT set_config('request.jwt.claim.sub', 'c0510000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"c0510000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Ana checks into 3 distinct parks + 1 hall.
INSERT INTO public.checkins (user_id, venue_id) VALUES
  ('c0510000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Park 1')),
  ('c0510000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Park 2')),
  ('c0510000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Park 3')),
  ('c0510000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Hall 1'));

-- (1) venue_explorer progress = 4 distinct venues.
SELECT extensions.is(
  (SELECT progress FROM public.get_explorer_progress() WHERE key='venue_explorer'),
  4, 'venue_explorer progress counts all 4 distinct visited venues');

-- (2) park_hopper progress = 3 (parks only — the hall does not count).
SELECT extensions.is(
  (SELECT progress FROM public.get_explorer_progress() WHERE key='park_hopper'),
  3, 'park_hopper counts only parks (predicate-scoped)');

-- (3) park_hopper bronze (target 3) crossed → an award row exists.
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.explorer_quest_awards
          WHERE user_id='c0510000-0000-4000-8000-000000000001'
            AND quest_key='park_hopper' AND tier='bronze'),
  'crossing park_hopper bronze (3 parks) inserts an award row');

-- (4) get_explorer_progress reflects the earned bronze flag for park_hopper.
SELECT extensions.ok(
  (SELECT earned_bronze FROM public.get_explorer_progress() WHERE key='park_hopper'),
  'get_explorer_progress.earned_bronze is true for park_hopper');

-- (5) venue_explorer bronze NOT earned yet (4 < target 5).
SELECT extensions.ok(
  NOT (SELECT earned_bronze FROM public.get_explorer_progress() WHERE key='venue_explorer'),
  'venue_explorer bronze (target 5) is not earned at 4 venues');

-- (6) Idempotency: re-checking into an ALREADY-visited park does not advance
--     park_hopper progress (still 3) nor add a duplicate award row.
INSERT INTO public.checkins (user_id, venue_id) VALUES
  ('c0510000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Park 1'));

SELECT extensions.is(
  (SELECT progress FROM public.get_explorer_progress() WHERE key='park_hopper'),
  3, 'a repeat check-in to a known venue does not double-count progress');

SELECT extensions.is(
  (SELECT count(*)::int FROM public.explorer_quest_awards
   WHERE user_id='c0510000-0000-4000-8000-000000000001'
     AND quest_key='park_hopper' AND tier='bronze'),
  1, 'a repeat check-in does not re-award (UNIQUE + ON CONFLICT DO NOTHING)');

-- (7) Visiting a 4th distinct park crosses venue_explorer bronze (5 venues now).
INSERT INTO public.checkins (user_id, venue_id) VALUES
  ('c0510000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Park 4'));

SELECT extensions.ok(
  (SELECT earned_bronze FROM public.get_explorer_progress() WHERE key='venue_explorer'),
  'a 5th distinct venue crosses venue_explorer bronze');

-- (8) get_unvisited_venue_ids excludes visited venues. Ana has visited 5 of the
--     6 city venues (Park 1-4 + Hall 1) → only Hall 2 remains unvisited.
SELECT extensions.is(
  (SELECT count(*)::int FROM public.get_unvisited_venue_ids('Explortown')),
  1, 'get_unvisited_venue_ids returns only the unvisited venue');

SELECT extensions.ok(
  (SELECT venue_id FROM public.get_unvisited_venue_ids('Explortown'))
    = (SELECT id FROM public.venues WHERE name='Hall 2'),
  'the unvisited venue is the one never checked into');

-- ── RLS: Bob cannot read Ana's awards ───────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'c0510000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"c0510000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  (SELECT count(*)::int FROM public.explorer_quest_awards
   WHERE user_id='c0510000-0000-4000-8000-000000000001'),
  0, 'a stranger cannot read another user''s explorer awards (RLS SELECT-own)');

SELECT extensions.finish();
ROLLBACK;
