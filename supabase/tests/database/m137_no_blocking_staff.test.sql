-- Migration 137 — users cannot block admins/moderators.
-- Verifies the BEFORE INSERT trigger on user_blocks rejects blocking staff via
-- both the block_user() RPC and a direct insert, while still allowing blocking
-- a regular user.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(4);

-- Ada = admin, Mo = moderator, U1 (actor) + U2 = regular users.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('7b000000-0000-4000-8000-0000000000a1', 'm137-ada@example.com', '{"full_name":"Ada"}'::jsonb),
  ('7b000000-0000-4000-8000-0000000000b2', 'm137-mo@example.com',  '{"full_name":"Mo"}'::jsonb),
  ('7b000000-0000-4000-8000-000000000011', 'm137-u1@example.com',  '{"full_name":"U1"}'::jsonb),
  ('7b000000-0000-4000-8000-000000000012', 'm137-u2@example.com',  '{"full_name":"U2"}'::jsonb);

UPDATE public.profiles SET is_admin     = true WHERE id = '7b000000-0000-4000-8000-0000000000a1';
UPDATE public.profiles SET is_moderator = true WHERE id = '7b000000-0000-4000-8000-0000000000b2';

-- ── act as U1 (regular) ──────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '7b000000-0000-4000-8000-000000000011', true);
SELECT set_config('request.jwt.claims', '{"sub":"7b000000-0000-4000-8000-000000000011","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) cannot block an admin via the block_user RPC.
SELECT extensions.throws_ok(
  $q$ SELECT public.block_user('7b000000-0000-4000-8000-0000000000a1') $q$,
  NULL, 'cannot_block_staff', 'block_user(admin) is rejected');

-- (2) cannot block a moderator either.
SELECT extensions.throws_ok(
  $q$ SELECT public.block_user('7b000000-0000-4000-8000-0000000000b2') $q$,
  NULL, 'cannot_block_staff', 'block_user(moderator) is rejected');

-- (3) cannot bypass via a direct insert into user_blocks.
SELECT extensions.throws_ok(
  $q$ INSERT INTO public.user_blocks (blocker_id, blocked_id)
      VALUES ('7b000000-0000-4000-8000-000000000011', '7b000000-0000-4000-8000-0000000000a1') $q$,
  NULL, 'cannot_block_staff', 'a direct insert blocking staff is rejected by the trigger');

-- (4) can still block a regular user.
SELECT extensions.lives_ok(
  $q$ SELECT public.block_user('7b000000-0000-4000-8000-000000000012') $q$,
  'blocking a regular user still works');

RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
