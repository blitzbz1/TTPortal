-- F041 — Referral links with auto-friend on join (migration 124).
-- Verifies: claim_referral inserts an ACCEPTED friendship both parties can see;
-- the referee row is created (get_referral_stats counts it for the referrer);
-- the Recruiter bronze badge is awarded at the 1st referral; a double-claim by
-- the same referee is rejected; a self-referral is rejected; and the
-- notifications.type CHECK accepts 'referral_joined' but rejects a bogus type.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(10);

-- ── seed: A referrer, B referee, C self-referral actor ──────────────────────
-- (the on_auth_user_created trigger auto-creates each profile row, including a
-- referral_code via handle_new_user → generate_referral_code.)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('c0410000-0000-4000-8000-000000000001', 'f041-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('c0410000-0000-4000-8000-000000000002', 'f041-b@example.com', '{"full_name":"Bob"}'::jsonb),
  ('c0410000-0000-4000-8000-000000000003', 'f041-c@example.com', '{"full_name":"Cara"}'::jsonb);

-- (0a) every new profile gets a referral_code.
SELECT extensions.isnt(
  (SELECT referral_code FROM public.profiles WHERE id = 'c0410000-0000-4000-8000-000000000001'),
  NULL, 'a new profile gets a referral_code');

-- Stash A's and C's referral codes (readable as superuser between role switches).
SELECT set_config('f041.code_a',
  (SELECT referral_code FROM public.profiles WHERE id='c0410000-0000-4000-8000-000000000001'), true);
SELECT set_config('f041.code_c',
  (SELECT referral_code FROM public.profiles WHERE id='c0410000-0000-4000-8000-000000000003'), true);

-- ── act as B: claim A's referral code ───────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'c0410000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"c0410000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) claim returns the referrer's id (use lowercased code to prove case-insens).
SELECT extensions.is(
  public.claim_referral(lower(current_setting('f041.code_a'))),
  'c0410000-0000-4000-8000-000000000001'::uuid,
  'claim_referral returns the referrer id');

-- (2) B can see an ACCEPTED friendship with A (RLS: participant read).
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id='c0410000-0000-4000-8000-000000000001' AND addressee_id='c0410000-0000-4000-8000-000000000002')
        OR (requester_id='c0410000-0000-4000-8000-000000000002' AND addressee_id='c0410000-0000-4000-8000-000000000001'))
  ),
  'referee sees an accepted friendship with the referrer');

-- (3) a double-claim by the same referee is rejected.
SELECT extensions.throws_ok(
  format($q$ SELECT public.claim_referral(%L) $q$, lower(current_setting('f041.code_a'))),
  NULL, 'already_referred', 'a second claim by the same referee is rejected');

RESET ROLE;

-- ── act as A (referrer): both sides see the friendship; stats + badge ───────
SELECT set_config('request.jwt.claim.sub', 'c0410000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"c0410000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (4) the referrer also sees the accepted friendship (both parties).
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.friendships WHERE status='accepted'
          AND addressee_id='c0410000-0000-4000-8000-000000000002'),
  'referrer also sees the accepted friendship');

-- (5) get_referral_stats counts the referral for the referrer.
SELECT extensions.is(
  (SELECT invited_count FROM public.get_referral_stats()),
  1, 'get_referral_stats reports invited_count = 1');

-- (6) the Recruiter bronze badge is awarded at the 1st referral.
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.badge_awards
          WHERE user_id='c0410000-0000-4000-8000-000000000001'
            AND category='recruiter' AND tier='bronze'),
  'Recruiter bronze badge awarded at the 1st referral');

RESET ROLE;

-- ── act as C: self-referral is rejected ─────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'c0410000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"c0410000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (7) claiming your own code is rejected.
SELECT extensions.throws_ok(
  format($q$ SELECT public.claim_referral(%L) $q$, current_setting('f041.code_c')),
  NULL, 'self_referral', 'a self-referral is rejected');

RESET ROLE;

-- (8) notifications.type CHECK accepts referral_joined, rejects a bogus type.
SELECT extensions.lives_ok(
  $q$ INSERT INTO public.notifications (recipient_id, type, title, body)
      VALUES ('c0410000-0000-4000-8000-000000000001', 'referral_joined', 'T', 'B') $q$,
  'notifications_type_check accepts referral_joined');

SELECT extensions.throws_ok(
  $q$ INSERT INTO public.notifications (recipient_id, type, title, body)
      VALUES ('c0410000-0000-4000-8000-000000000001', 'bogus_type_xyz', 'T', 'B') $q$,
  '23514', NULL, 'notifications_type_check rejects an unknown type');

SELECT extensions.finish();
ROLLBACK;
