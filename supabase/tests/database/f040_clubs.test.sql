-- F040 — Clubs & groups (migration 123).
-- Verifies: club RLS (a non-member can't SELECT a club / its members), join by
-- code adds membership, a club-visibility event is visible to members and NOT
-- to a non-member (the core RLS branch), the BEFORE INSERT trigger rejects a
-- club event from a non-member, admin-only guards on remove/rotate, and the
-- notifications.type CHECK accepts 'club_event_created' but rejects a bogus type.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(13);

-- ── seed: A owner/admin, B member-to-be, C stranger ─────────────────────────
-- (the on_auth_user_created trigger auto-creates each profile row.)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('c0400000-0000-4000-8000-000000000001', 'f040-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('c0400000-0000-4000-8000-000000000002', 'f040-b@example.com', '{"full_name":"Bob"}'::jsonb),
  ('c0400000-0000-4000-8000-000000000003', 'f040-c@example.com', '{"full_name":"Cara"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Clubville', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Club Venue', 'sala_indoor', 'Clubville',
        (SELECT id FROM public.cities WHERE name = 'Clubville'), 'St 1', 44.0, 26.0, true);

-- ── act as A (owner) ────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'c0400000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"c0400000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (1) A creates a club; the owner becomes a member.
SELECT extensions.isnt(
  public.create_club('Smashers', 'Sunday club', NULL,
                     (SELECT id FROM public.cities WHERE name='Clubville'),
                     (SELECT id FROM public.venues WHERE name='Club Venue')),
  NULL, 'owner creates a club');

-- (2) A (a member) can SELECT the club row.
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.clubs WHERE name = 'Smashers'),
  'a member can read their club via RLS');

-- A creates a club-visibility event for the club (passes the membership trigger).
INSERT INTO public.events (title, organizer_id, venue_id, starts_at, status, event_type, visibility, club_id)
VALUES ('Club Night', 'c0400000-0000-4000-8000-000000000001',
        (SELECT id FROM public.venues WHERE name='Club Venue'),
        now() + interval '1 day', 'open', 'casual', 'club',
        (SELECT id FROM public.clubs WHERE name='Smashers'));

RESET ROLE;

-- Stash the club's join code (readable as superuser between role switches) so
-- the member-to-be can join by code below.
SELECT set_config('f040.code', (SELECT join_code FROM public.clubs WHERE name='Smashers'), true);
-- Stash the real club id too, so the membership-trigger tests below supply a
-- non-null, existing club_id the stranger is NOT a member of (otherwise the
-- stranger's RLS makes a `SELECT id FROM clubs` subquery resolve to NULL and
-- the trigger short-circuits on the `club_id IS NULL` arm, never exercising the
-- `NOT is_club_member()` arm).
SELECT set_config('f040.club_id', (SELECT id FROM public.clubs WHERE name='Smashers')::text, true);

-- ── act as C (stranger / non-member) ────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'c0400000-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"c0400000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (3) a non-member cannot SELECT the club (RLS).
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.clubs WHERE name = 'Smashers'),
  'a non-member cannot read the club via RLS');

-- (4) a non-member cannot SELECT any club_members rows (RLS).
SELECT extensions.is(
  (SELECT count(*)::int FROM public.club_members),
  0, 'a non-member sees no club_members via RLS');

-- (5) a non-member cannot SEE the club-visibility event (the core RLS branch).
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM public.events WHERE title = 'Club Night'),
  'a non-member does not see a club-visibility event');

-- (6) a non-member cannot INSERT a club event for that club — exercises the
-- `NOT is_club_member()` arm by supplying the real (stashed) club id.
SELECT extensions.throws_ok(
  format($q$ INSERT INTO public.events (title, organizer_id, venue_id, starts_at, status, event_type, visibility, club_id)
      VALUES ('Sneaky', 'c0400000-0000-4000-8000-000000000003',
              (SELECT v.id FROM public.venues v WHERE v.name='Club Venue'),
              now() + interval '1 day', 'open', 'casual', 'club', %s) $q$,
         current_setting('f040.club_id')),
  '42501', NULL, 'a non-member cannot insert a club event');

-- (6b) a non-member cannot UPDATE a public event INTO a club they're not in
-- (the BEFORE INSERT OR UPDATE trigger — guards the
-- INSERT-public-then-UPDATE-to-club injection bypass).
INSERT INTO public.events (title, organizer_id, venue_id, starts_at, status, event_type, visibility)
VALUES ('C Public', 'c0400000-0000-4000-8000-000000000003',
        (SELECT v.id FROM public.venues v WHERE v.name='Club Venue'),
        now() + interval '1 day', 'open', 'casual', 'public');
SELECT extensions.throws_ok(
  format($q$ UPDATE public.events SET visibility='club', club_id=%s
             WHERE title='C Public' AND organizer_id='c0400000-0000-4000-8000-000000000003' $q$,
         current_setting('f040.club_id')),
  '42501', NULL, 'a non-member cannot UPDATE a public event into a club');

RESET ROLE;

-- ── act as B: join by code, then read the event ─────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'c0400000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"c0400000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (7) B joins via the (lowercased, to prove case-insensitivity) join code.
SELECT extensions.isnt(
  public.join_club_by_code(lower(current_setting('f040.code'))),
  NULL, 'join_club_by_code adds membership');

-- (8) now a member, B sees the club-visibility event.
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.events WHERE title = 'Club Night'),
  'a member sees the club-visibility event');

-- (9) a non-admin member cannot rotate the join code (admin-only).
SELECT extensions.throws_ok(
  format($q$ SELECT public.rotate_club_join_code(%s) $q$,
         (SELECT id FROM public.clubs ORDER BY id LIMIT 1)),
  '42501', NULL, 'a non-admin cannot rotate the join code');

-- (10) a non-admin member cannot remove another member (admin-only).
SELECT extensions.throws_ok(
  format($q$ SELECT public.remove_club_member(%s, 'c0400000-0000-4000-8000-000000000001') $q$,
         (SELECT id FROM public.clubs ORDER BY id LIMIT 1)),
  '42501', NULL, 'a non-admin cannot remove a member');

RESET ROLE;

-- (11) notifications.type CHECK accepts the new type and rejects a bogus one.
SELECT extensions.lives_ok(
  $q$ INSERT INTO public.notifications (recipient_id, type, title, body)
      VALUES ('c0400000-0000-4000-8000-000000000001', 'club_event_created', 'T', 'B') $q$,
  'notifications_type_check accepts club_event_created');

SELECT extensions.throws_ok(
  $q$ INSERT INTO public.notifications (recipient_id, type, title, body)
      VALUES ('c0400000-0000-4000-8000-000000000001', 'bogus_type_xyz', 'T', 'B') $q$,
  '23514', NULL, 'notifications_type_check rejects an unknown type');

SELECT extensions.finish();
ROLLBACK;
