-- F033 — city ladder + seasons (migration 122).
-- Verifies: placed players (≥5 confirmed matches this season) are ranked by Elo
-- (A above B), an under-placement player is excluded from the ladder, and the
-- placement standing reports progress toward the 5-match gate.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(4);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'f033-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('c0000000-0000-4000-8000-000000000002', 'f033-b@example.com', '{"full_name":"Bob"}'::jsonb),
  ('c0000000-0000-4000-8000-000000000003', 'f033-c@example.com', '{"full_name":"Cara"}'::jsonb);
UPDATE public.profiles SET city = 'Ladderville'
 WHERE id IN ('c0000000-0000-4000-8000-000000000001',
              'c0000000-0000-4000-8000-000000000002',
              'c0000000-0000-4000-8000-000000000003');

-- A beats B five times (both reach placement; A's Elo climbs, B's drops);
-- A also beats C twice (C stays under the 5-match gate). All this season.
INSERT INTO public.matches (reporter_id, opponent_id, winner_id, status, confirmed_at, created_at)
SELECT 'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
       'c0000000-0000-4000-8000-000000000001', 'confirmed', now(), now()
FROM generate_series(1, 5);
INSERT INTO public.matches (reporter_id, opponent_id, winner_id, status, confirmed_at, created_at)
SELECT 'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003',
       'c0000000-0000-4000-8000-000000000001', 'confirmed', now(), now()
FROM generate_series(1, 2);

-- (1)/(2) placed players ranked by rating: A first, B second.
SELECT extensions.is(
  (SELECT rank FROM public.get_city_ladder('Ladderville') WHERE user_id = 'c0000000-0000-4000-8000-000000000001'),
  1, 'the higher-rated placed player ranks #1');
SELECT extensions.is(
  (SELECT rank FROM public.get_city_ladder('Ladderville') WHERE user_id = 'c0000000-0000-4000-8000-000000000002'),
  2, 'the lower-rated placed player ranks #2');

-- (3) C has only 2 matches → not placed → not on the ladder.
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.get_city_ladder('Ladderville') WHERE user_id = 'c0000000-0000-4000-8000-000000000003'),
  'a player under the 5-match gate is excluded');

-- (4) C's standing reports placement progress (2/5, not placed).
SELECT set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(
  (public.get_my_ladder_standing('Ladderville') ->> 'played')::int || ':' ||
  (public.get_my_ladder_standing('Ladderville') ->> 'placed'),
  '2:false', 'standing reports 2/5 played and not yet placed');
RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
