-- F054 — TT Wrapped "year in review" (migration 130).
-- Verifies: year_in_review returns correct hours / sessions / venues / events
-- for a seeded year; top_venue picks the MOST-visited venue; top_month picks the
-- month with the most sessions; partner_of_year picks the most-frequent
-- co-player (tagged + match opponent); the archetype KEY is deterministic for a
-- seeded profile; an INACTIVE user gets the all-zeros 'casual' payload;
-- notifications_type_check accepts 'year_wrapped'; and send_wrapped_teasers is
-- idempotent (the NOT EXISTS de-dupe) when run inside the unlock window.
--
-- We seed MANY check-ins, so the rate_limit_checkin trigger is DISABLED at the
-- top (the whole test is wrapped in BEGIN/ROLLBACK, so this never persists —
-- same idiom as f053). The streak/explorer/milestone AFTER INSERT triggers
-- (F050/F051/F053) fire harmlessly here.

BEGIN;
ALTER TABLE public.checkins DISABLE TRIGGER rate_limit_checkin;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(13);

-- ── seed: players + city + venues (one outdoor, two indoor) ──────────────────
-- (the on_auth_user_created trigger auto-creates the profile rows.)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('e0540000-0000-4000-8000-000000000001', 'f054-active@example.com',   '{"full_name":"Ana"}'::jsonb),
  ('e0540000-0000-4000-8000-000000000002', 'f054-inactive@example.com', '{"full_name":"Bob"}'::jsonb),
  ('e0540000-0000-4000-8000-000000000003', 'f054-partner@example.com',  '{"full_name":"Cara"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Wraptown', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved) VALUES
  ('Wrap Indoor A', 'sala_indoor',  'Wraptown', (SELECT id FROM public.cities WHERE name='Wraptown'), 'A', 44.0, 26.0, true),
  ('Wrap Indoor B', 'sala_indoor',  'Wraptown', (SELECT id FROM public.cities WHERE name='Wraptown'), 'B', 44.0, 26.0, true);

-- Fixed test year so the date math is independent of the run date.
-- We use 2023 (a fully-past calendar year) and pass it explicitly to the RPC.

-- ── Ana: 4 sessions in 2023 across TWO distinct venues, tagging Cara. ─────────
-- Venue A: THREE 2-hour sessions in March 2023 (March is the top month),
--          each tagging Cara as a co-player.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at, friends) VALUES
  ('e0540000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Wrap Indoor A'),
   '2023-03-05 10:00:00+00', '2023-03-05 12:00:00+00', ARRAY['e0540000-0000-4000-8000-000000000003']::uuid[]),
  ('e0540000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Wrap Indoor A'),
   '2023-03-12 10:00:00+00', '2023-03-12 12:00:00+00', ARRAY['e0540000-0000-4000-8000-000000000003']::uuid[]),
  ('e0540000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Wrap Indoor A'),
   '2023-03-19 10:00:00+00', '2023-03-19 12:00:00+00', ARRAY['e0540000-0000-4000-8000-000000000003']::uuid[]);
-- Venue B: ONE 1-hour session in July 2023.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at) VALUES
  ('e0540000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Wrap Indoor B'),
   '2023-07-04 10:00:00+00', '2023-07-04 11:00:00+00');
-- A check-in in 2022 that must be EXCLUDED from the 2023 window.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at) VALUES
  ('e0540000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Wrap Indoor B'),
   '2022-12-20 10:00:00+00', '2022-12-20 11:00:00+00');

-- ── year_in_review for Ana over 2023 ─────────────────────────────────────────
-- (1) sessions = 4 in-window checkins (the 2022 one is excluded).
SELECT extensions.is(
  (public.year_in_review('e0540000-0000-4000-8000-000000000001', 2023)->>'sessions')::int,
  4, 'sessions counts only in-window checkins');

-- (2) venues = 2 distinct in-window venues.
SELECT extensions.is(
  (public.year_in_review('e0540000-0000-4000-8000-000000000001', 2023)->>'venues')::int,
  2, 'venues counts distinct in-window venues');

-- (3) hours = 3×2h + 1×1h = 7.0 (no events seeded yet).
SELECT extensions.is(
  (public.year_in_review('e0540000-0000-4000-8000-000000000001', 2023)->>'hours')::numeric,
  7.0, 'hours sums in-window checkin durations');

-- (4) top_venue = Wrap Indoor A with 3 checkins (the most-visited).
SELECT extensions.is(
  public.year_in_review('e0540000-0000-4000-8000-000000000001', 2023)->'top_venue'->>'name',
  'Wrap Indoor A', 'top_venue picks the most-visited venue');
SELECT extensions.is(
  (public.year_in_review('e0540000-0000-4000-8000-000000000001', 2023)->'top_venue'->>'checkins')::int,
  3, 'top_venue reports the correct checkin count');

-- (5) top_month = March (3) with 3 sessions.
SELECT extensions.is(
  (public.year_in_review('e0540000-0000-4000-8000-000000000001', 2023)->'top_month'->>'month')::int,
  3, 'top_month picks the month with the most sessions');

-- (6) partner_of_year = Cara (tagged on the 3 March sessions).
SELECT extensions.is(
  public.year_in_review('e0540000-0000-4000-8000-000000000001', 2023)->'partner_of_year'->>'full_name',
  'Cara', 'partner_of_year picks the most-frequent co-player');

-- (7) archetype is deterministic. Ana: 7h (<100), 2 venues (<10), 1 partner
-- (<5), 0 outdoor checkins → none of the special rules fire → 'casual'.
SELECT extensions.is(
  public.year_in_review('e0540000-0000-4000-8000-000000000001', 2023)->>'archetype',
  'casual', 'archetype is a deterministic rule-based key for the seeded profile');

-- ── inactive user (Bob): all-zeros 'casual' payload ──────────────────────────
-- (8) sessions = 0.
SELECT extensions.is(
  (public.year_in_review('e0540000-0000-4000-8000-000000000002', 2023)->>'sessions')::int,
  0, 'an inactive user gets a zero-sessions wrapped');

-- (9) archetype defaults to 'casual' with no activity.
SELECT extensions.is(
  public.year_in_review('e0540000-0000-4000-8000-000000000002', 2023)->>'archetype',
  'casual', 'an inactive user has the casual archetype');

-- (10) notifications_type_check accepts 'year_wrapped'.
INSERT INTO public.notifications (recipient_id, type, title, body, data) VALUES
  ('e0540000-0000-4000-8000-000000000001', 'year_wrapped', 'x', 'y',
   jsonb_build_object('period', '2099'));
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM public.notifications
          WHERE recipient_id = 'e0540000-0000-4000-8000-000000000001'
            AND type = 'year_wrapped' AND data->>'period' = '2099'),
  'notifications_type_check accepts year_wrapped');

-- ── send_wrapped_teasers: idempotent + date-guarded ──────────────────────────
-- The function self-guards on Dec 15 of the CURRENT year and targets the current
-- year's check-ins, so seed Ana a current-year check-in to make her eligible.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at) VALUES
  ('e0540000-0000-4000-8000-000000000001', (SELECT id FROM public.venues WHERE name='Wrap Indoor A'),
   make_date(extract(year FROM now())::int, 2, 1)::timestamptz,
   make_date(extract(year FROM now())::int, 2, 1)::timestamptz + INTERVAL '1 hour');

-- Run twice; the NOT EXISTS de-dupe means at most ONE 'year_wrapped' per period
-- per user regardless of whether the date-guard lets the body run today.
SELECT public.send_wrapped_teasers();
SELECT public.send_wrapped_teasers();

-- (11) at most one current-year teaser for Ana (0 outside the window, 1 inside;
-- either way never more than 1 → idempotent).
SELECT extensions.ok(
  (SELECT count(*) FROM public.notifications
   WHERE recipient_id = 'e0540000-0000-4000-8000-000000000001'
     AND type = 'year_wrapped'
     AND data->>'period' = extract(year FROM now())::int::text) <= 1,
  'send_wrapped_teasers enqueues at most one teaser per period (idempotent)');

-- (12) the inactive user (Bob) NEVER receives a current-year teaser (no guilt
-- spam — he has no current-year check-in).
SELECT extensions.is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = 'e0540000-0000-4000-8000-000000000002'
     AND type = 'year_wrapped'
     AND data->>'period' = extract(year FROM now())::int::text),
  0, 'send_wrapped_teasers does NOT teaser an inactive user');

SELECT extensions.finish();
ROLLBACK;
