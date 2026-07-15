-- F010 — live busyness + typical-hours histogram (migration 106).
-- Verifies: anonymous live counts (no identities), the sample-size threshold
-- that gates the histogram, and that a refresh of the materialized view feeds
-- the curve. Runs in one transaction and rolls back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(6);

-- ── Seed: two users, a city, a venue ────────────────────────────────────────
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('20000000-0000-4000-8000-000000000001', 'f010-a@example.com', '{"full_name":"A"}'::jsonb),
  ('20000000-0000-4000-8000-000000000002', 'f010-b@example.com', '{"full_name":"B"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Busyville', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Busy Venue', 'parc_exterior', 'Busyville',
        (SELECT id FROM public.cities WHERE name = 'Busyville'),
        'St 1', 44.0, 26.0, true);

-- Two ACTIVE check-ins right now.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at) VALUES
  ('20000000-0000-4000-8000-000000000001',
   (SELECT id FROM public.venues WHERE name = 'Busy Venue'), now(), now() + interval '2 hours'),
  ('20000000-0000-4000-8000-000000000002',
   (SELECT id FROM public.venues WHERE name = 'Busy Venue'), now(), now() + interval '2 hours');

-- (1) Live count reflects the two active check-ins.
SELECT extensions.is(
  (SELECT active_count FROM public.get_live_venue_counts(
     (SELECT id FROM public.cities WHERE name = 'Busyville'))
   WHERE venue_id = (SELECT id FROM public.venues WHERE name = 'Busy Venue')),
  2,
  'get_live_venue_counts reports 2 active check-ins'
);

-- (2) Below the sample threshold, the histogram is suppressed (the MV has no
--     rows for this brand-new venue yet).
SELECT extensions.ok(
  (public.get_venue_busyness((SELECT id FROM public.venues WHERE name = 'Busy Venue')) ->> 'histogram') IS NULL,
  'busyness histogram is NULL below the sample threshold'
);

-- (3) ...but the live count is still reported below threshold.
SELECT extensions.is(
  (public.get_venue_busyness((SELECT id FROM public.venues WHERE name = 'Busy Venue')) ->> 'live_count')::int,
  2,
  'busyness reports live_count even below the histogram threshold'
);

-- ── Backfill 10 historical (already-ended) check-ins inside the 12-week window.
INSERT INTO public.checkins (user_id, venue_id, started_at, ended_at)
SELECT '20000000-0000-4000-8000-000000000001',
       (SELECT id FROM public.venues WHERE name = 'Busy Venue'),
       now() - (g || ' days')::interval - interval '5 hours',
       now() - (g || ' days')::interval - interval '3 hours'
FROM generate_series(1, 10) g;

-- Plain (non-concurrent) refresh works inside this transaction.
REFRESH MATERIALIZED VIEW public.venue_busyness_hourly;

-- (4) Crossing the threshold surfaces the histogram.
SELECT extensions.ok(
  (public.get_venue_busyness((SELECT id FROM public.venues WHERE name = 'Busy Venue')) ->> 'histogram') IS NOT NULL,
  'histogram is present once the sample threshold is reached'
);

-- (5) The historical check-ins did NOT inflate the live count (they ended).
SELECT extensions.is(
  (public.get_venue_busyness((SELECT id FROM public.venues WHERE name = 'Busy Venue')) ->> 'live_count')::int,
  2,
  'ended historical check-ins do not count as live'
);

-- (6) Anonymous caller can read live counts (counts only, SECURITY DEFINER).
SET LOCAL ROLE anon;
SELECT extensions.is(
  (SELECT count(*)::int FROM public.get_live_venue_counts(
     (SELECT id FROM public.cities WHERE name = 'Busyville'))),
  1,
  'anon can read live venue counts (counts only, no identities)'
);
RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
