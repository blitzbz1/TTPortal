-- F022 — crossed paths (migration 117).
-- Verifies: overlap detection surfaces a non-friend stranger with the right
-- shared venue + count, accepted friends and blocked users are excluded, and a
-- dismissal persists (the user drops out of the suggestions).

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(5);

-- ── seed: A (caller), B (stranger), C (friend), D (blocked) ─────────────────
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('40000000-0000-4000-8000-000000000001', 'f022-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('40000000-0000-4000-8000-000000000002', 'f022-b@example.com', '{"full_name":"Bogdan"}'::jsonb),
  ('40000000-0000-4000-8000-000000000003', 'f022-c@example.com', '{"full_name":"Carmen"}'::jsonb),
  ('40000000-0000-4000-8000-000000000004', 'f022-d@example.com', '{"full_name":"Dan"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Crosston', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Crossed Venue', 'parc_exterior', 'Crosston',
        (SELECT id FROM public.cities WHERE name = 'Crosston'),
        'St 1', 44.0, 26.0, true);

-- Overlapping check-ins at the same venue (A's window: -30m..+30m).
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at)
SELECT u, (SELECT id FROM public.venues WHERE name = 'Crossed Venue'),
       now() - interval '30 minutes', now() + interval '30 minutes'
FROM (VALUES ('40000000-0000-4000-8000-000000000001'::uuid)) AS s(u);

INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at)
SELECT u, (SELECT id FROM public.venues WHERE name = 'Crossed Venue'),
       now() - interval '20 minutes', now() + interval '20 minutes'
FROM (VALUES
  ('40000000-0000-4000-8000-000000000002'::uuid),
  ('40000000-0000-4000-8000-000000000003'::uuid),
  ('40000000-0000-4000-8000-000000000004'::uuid)) AS s(u);

-- A and C are accepted friends; A has blocked D.
INSERT INTO public.friendships (requester_id, addressee_id, status)
VALUES ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'accepted');

INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004');

-- ── act as A ────────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) the stranger B surfaces.
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.get_crossed_paths()
          WHERE user_id = '40000000-0000-4000-8000-000000000002'),
  'a non-friend who overlapped at the same venue is suggested'
);

-- (2) B carries the right shared venue + count.
SELECT extensions.is(
  (SELECT venue_name || ':' || shared_count FROM public.get_crossed_paths()
   WHERE user_id = '40000000-0000-4000-8000-000000000002'),
  'Crossed Venue:1',
  'the suggestion shows the shared venue and crossing count'
);

-- (3) an accepted friend is never suggested.
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.get_crossed_paths()
              WHERE user_id = '40000000-0000-4000-8000-000000000003'),
  'accepted friends are excluded'
);

-- (4) a blocked user is never suggested.
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.get_crossed_paths()
              WHERE user_id = '40000000-0000-4000-8000-000000000004'),
  'blocked users are excluded'
);

-- (5) dismissing B persists — B drops out.
SELECT public.dismiss_crossed_path('40000000-0000-4000-8000-000000000002');
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.get_crossed_paths()
              WHERE user_id = '40000000-0000-4000-8000-000000000002'),
  'a dismissed suggestion stays hidden'
);

RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
