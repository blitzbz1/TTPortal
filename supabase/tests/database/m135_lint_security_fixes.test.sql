-- Migration 135 — Supabase database-linter fixes.
-- Verifies the post-migration STATE (the migration runs as part of the chain;
-- this just asserts the result):
--   * public.explorer_quests has RLS enabled + a SELECT policy, and anon can
--     still read every definition under the new read-all policy (proves the
--     policy, not just RLS-on which alone would return 0 rows to clients).
--   * public.challenge_catalog_export_template carries security_invoker=true
--     (invoker mode), so the SECURITY DEFINER-view linting no longer fires.
-- All rolled back at the end.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO anon, authenticated;

SELECT extensions.plan(4);

-- 1. RLS is enabled on the public definitions table.
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class
     WHERE oid = 'public.explorer_quests'::regclass),
  'explorer_quests has row level security enabled'
);

-- 2. A SELECT policy exists (RLS-on without a policy would hide all rows).
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'explorer_quests'
              AND cmd = 'SELECT'),
  'explorer_quests has a SELECT policy'
);

-- 3. The view is in invoker mode (security_invoker=true in reloptions).
SELECT extensions.ok(
  (SELECT reloptions @> ARRAY['security_invoker=true']
     FROM pg_class
     WHERE oid = 'public.challenge_catalog_export_template'::regclass),
  'challenge_catalog_export_template runs with security_invoker=true'
);

-- 4. Functional: an anonymous client still reads all quest definitions through
--    the read-all policy (the three launch quests seeded in 127).
SET LOCAL ROLE anon;
SELECT extensions.is(
  (SELECT count(*)::int FROM public.explorer_quests),
  3,
  'anon reads all explorer_quests definitions under the read-all policy'
);
RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
