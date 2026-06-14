-- F011 — one-tap free-table reports (migration 107).
-- Verifies: freshness decay (~90 min), reporter anonymity (no user_id in the
-- aggregate), the report RPC inserts, and per-user rate limiting.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(5);

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('30000000-0000-4000-8000-000000000001', 'f011-a@example.com', '{"full_name":"A"}'::jsonb);

INSERT INTO public.cities (name, country_code, country_name, lat, lng)
VALUES ('Tableton', 'RO', 'Romania', 44.0, 26.0);

INSERT INTO public.venues (name, type, city, city_id, address, lat, lng, approved)
VALUES ('Report Venue', 'sala_indoor', 'Tableton',
        (SELECT id FROM public.cities WHERE name = 'Tableton'),
        'St 1', 44.0, 26.0, true);

-- (1) Only a STALE report (>90 min) exists → aggregate is NULL.
INSERT INTO public.table_reports (venue_id, user_id, free_count, created_at)
VALUES ((SELECT id FROM public.venues WHERE name = 'Report Venue'),
        '30000000-0000-4000-8000-000000000001', 2, now() - interval '2 hours');

SELECT extensions.ok(
  public.get_venue_free_tables((SELECT id FROM public.venues WHERE name = 'Report Venue')) IS NULL,
  'a report older than 90 minutes has decayed (aggregate is NULL)'
);

-- (2) A FRESH report surfaces with the right count.
INSERT INTO public.table_reports (venue_id, user_id, free_count, created_at)
VALUES ((SELECT id FROM public.venues WHERE name = 'Report Venue'),
        '30000000-0000-4000-8000-000000000001', 1, now() - interval '5 minutes');

SELECT extensions.is(
  (public.get_venue_free_tables((SELECT id FROM public.venues WHERE name = 'Report Venue')) ->> 'free_count')::int,
  1,
  'the latest fresh report surfaces with its free_count'
);

-- (3) The aggregate is anonymous — no reporter identity leaks.
SELECT extensions.ok(
  NOT (public.get_venue_free_tables((SELECT id FROM public.venues WHERE name = 'Report Venue')) ? 'user_id'),
  'the free-table aggregate carries no user_id (anonymous)'
);

-- ── Authenticated reporter (rate limiting + insert) ─────────────────────────
SELECT set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- (4) report_free_tables inserts and returns an id (report #1 for this user).
SELECT extensions.isnt(
  public.report_free_tables((SELECT id FROM public.venues WHERE name = 'Report Venue'), 0, 3),
  NULL,
  'report_free_tables inserts and returns a row id'
);

-- Consume the rest of the 6/10-min quota (reports #2..#6).
SELECT public.report_free_tables((SELECT id FROM public.venues WHERE name = 'Report Venue'), 1)
FROM generate_series(1, 5);

-- (5) The 7th report within the window is rate-limited.
SELECT extensions.throws_ok(
  format($q$ SELECT public.report_free_tables(%s, 2) $q$,
         (SELECT id FROM public.venues WHERE name = 'Report Venue')),
  NULL, NULL,
  'the 7th free-table report in the window is rate-limited'
);

RESET ROLE;

SELECT extensions.finish();
ROLLBACK;
