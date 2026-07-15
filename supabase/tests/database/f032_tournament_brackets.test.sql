-- F032 — tournament brackets (migration 121).
-- Verifies: the organizer seeds a 4-player bracket (3 slots), a non-organizer
-- cannot, reporting tiles advances the winner to the final and crowns a
-- champion, and bracket games land in matches (feeding F030 ratings).

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(5);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'f032-a@example.com', '{"full_name":"Ana"}'::jsonb),
  ('b0000000-0000-4000-8000-000000000002', 'f032-b@example.com', '{"full_name":"Bob"}'::jsonb),
  ('b0000000-0000-4000-8000-000000000003', 'f032-c@example.com', '{"full_name":"Cara"}'::jsonb),
  ('b0000000-0000-4000-8000-000000000004', 'f032-d@example.com', '{"full_name":"Dan"}'::jsonb);

INSERT INTO public.events (title, organizer_id, starts_at, event_type)
VALUES ('Cup', 'b0000000-0000-4000-8000-000000000001', now() + interval '1 day', 'tournament');
INSERT INTO public.event_participants (event_id, user_id)
SELECT (SELECT id FROM public.events WHERE title = 'Cup'), u
FROM (VALUES ('b0000000-0000-4000-8000-000000000001'::uuid),
             ('b0000000-0000-4000-8000-000000000002'::uuid),
             ('b0000000-0000-4000-8000-000000000003'::uuid),
             ('b0000000-0000-4000-8000-000000000004'::uuid)) s(u);

-- ── non-organizer B cannot seed ─────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
  format($q$ SELECT public.create_tournament_bracket(%s) $q$, (SELECT id FROM public.events WHERE title='Cup')),
  NULL, NULL, 'a non-organizer cannot set up the bracket');
RESET ROLE;

-- ── organizer A seeds + reports ─────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT extensions.isnt(
  public.create_tournament_bracket((SELECT id FROM public.events WHERE title='Cup')),
  NULL, 'the organizer seeds a bracket');

-- 4 players → size 4 → 2 round-1 slots + 1 final = 3 slots.
SELECT extensions.is(
  (SELECT count(*)::int FROM public.tournament_slots ts
   JOIN public.tournament_brackets b ON b.id = ts.bracket_id
   WHERE b.event_id = (SELECT id FROM public.events WHERE title='Cup')),
  3, 'a 4-player bracket has 3 slots');

-- Report both semifinals (player_a wins each), then the final.
SELECT public.report_tournament_slot(
  (SELECT ts.id FROM public.tournament_slots ts JOIN public.tournament_brackets b ON b.id=ts.bracket_id
   WHERE b.event_id=(SELECT id FROM public.events WHERE title='Cup') AND ts.round=1 AND ts.slot_pos=0),
  (SELECT ts.player_a FROM public.tournament_slots ts JOIN public.tournament_brackets b ON b.id=ts.bracket_id
   WHERE b.event_id=(SELECT id FROM public.events WHERE title='Cup') AND ts.round=1 AND ts.slot_pos=0));
SELECT public.report_tournament_slot(
  (SELECT ts.id FROM public.tournament_slots ts JOIN public.tournament_brackets b ON b.id=ts.bracket_id
   WHERE b.event_id=(SELECT id FROM public.events WHERE title='Cup') AND ts.round=1 AND ts.slot_pos=1),
  (SELECT ts.player_a FROM public.tournament_slots ts JOIN public.tournament_brackets b ON b.id=ts.bracket_id
   WHERE b.event_id=(SELECT id FROM public.events WHERE title='Cup') AND ts.round=1 AND ts.slot_pos=1));
SELECT public.report_tournament_slot(
  (SELECT ts.id FROM public.tournament_slots ts JOIN public.tournament_brackets b ON b.id=ts.bracket_id
   WHERE b.event_id=(SELECT id FROM public.events WHERE title='Cup') AND ts.round=2 AND ts.slot_pos=0),
  (SELECT ts.player_a FROM public.tournament_slots ts JOIN public.tournament_brackets b ON b.id=ts.bracket_id
   WHERE b.event_id=(SELECT id FROM public.events WHERE title='Cup') AND ts.round=2 AND ts.slot_pos=0));

SELECT extensions.is(
  (SELECT status FROM public.tournament_brackets WHERE event_id=(SELECT id FROM public.events WHERE title='Cup')),
  'complete', 'reporting the final completes the bracket with a champion');

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.matches WHERE event_id=(SELECT id FROM public.events WHERE title='Cup') AND status='confirmed'),
  'bracket games are recorded as confirmed matches (feed ratings)');

RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
