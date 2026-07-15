-- F031 — head-to-head + rivals (migration 120).
-- Verifies the W-L record + current streak vs an opponent, that a blocked
-- pairing returns no record and a blocked player is excluded from rivals.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(6);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('af000000-0000-4000-8000-000000000001', 'f031-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('af000000-0000-4000-8000-000000000002', 'f031-b@example.com', '{"full_name":"Bob"}'::jsonb),
  ('af000000-0000-4000-8000-000000000003', 'f031-c@example.com', '{"full_name":"Cara"}'::jsonb);

-- A vs B: A wins (3d ago), B wins (2d ago), A wins (1d ago, most recent) → 2-1, current streak W1.
INSERT INTO public.matches (reporter_id, opponent_id, winner_id, status, created_at) VALUES
  ('af000000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000002','af000000-0000-4000-8000-000000000001','confirmed', now() - interval '3 days'),
  ('af000000-0000-4000-8000-000000000002','af000000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000002','confirmed', now() - interval '2 days'),
  ('af000000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000002','af000000-0000-4000-8000-000000000001','confirmed', now() - interval '1 day');
-- A vs C: one confirmed match, then A blocks C.
INSERT INTO public.matches (reporter_id, opponent_id, winner_id, status, created_at) VALUES
  ('af000000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000003','af000000-0000-4000-8000-000000000001','confirmed', now() - interval '5 days');
INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('af000000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000003');

-- ── act as A ────────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'af000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"af000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  (public.get_head_to_head('af000000-0000-4000-8000-000000000002') ->> 'my_wins')::int,
  2, 'H2H counts the viewer''s wins');
SELECT extensions.is(
  (public.get_head_to_head('af000000-0000-4000-8000-000000000002') ->> 'their_wins')::int,
  1, 'H2H counts the opponent''s wins');
SELECT extensions.is(
  (public.get_head_to_head('af000000-0000-4000-8000-000000000002') ->> 'streak')::int,
  1, 'current streak is W1 (most recent win, broken by the prior loss)');

-- blocked opponent → empty record
SELECT extensions.is(
  (public.get_head_to_head('af000000-0000-4000-8000-000000000003') ->> 'total')::int,
  0, 'a blocked opponent yields no head-to-head');

-- rivals: B present, blocked C absent
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.get_rivals() WHERE user_id = 'af000000-0000-4000-8000-000000000002'),
  'most-played opponent appears in rivals');
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.get_rivals() WHERE user_id = 'af000000-0000-4000-8000-000000000003'),
  'a blocked player is excluded from rivals');

SELECT extensions.finish();
ROLLBACK;
