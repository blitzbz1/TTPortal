-- Migration: 135_lint_security_fixes
-- Clears two Supabase database-linter findings. Both are regressions/oversights
-- in already-applied (pushed) migrations, so they are fixed FORWARD here rather
-- than by editing those files (whose hashes are recorded on the remote).
--
--  1. lint 0010 security_definer_view — public.challenge_catalog_export_template
--     057 set security_invoker=true, but 094:702 recreated the view with
--     `create or replace view ... as` (no WITH clause), which resets reloptions
--     to the default (security_invoker=false → DEFINER semantics), silently
--     reverting 057. Re-apply invoker mode. The view is a hardcoded all-NULL
--     import-validation template that reads no tables, so this is hygiene, not
--     an exposure fix.
--
--  2. lint 0013 rls_disabled_in_public — public.explorer_quests
--     127 enabled RLS on the per-user explorer_quest_awards but left the public
--     definitions table explorer_quests with only a SELECT grant and no RLS.
--     Enable RLS + a read-all policy matching the existing grant (authenticated,
--     anon). All writes still go solely through the SECURITY DEFINER worker
--     sync_explorer_quests (owner-privileged); no client DML is granted, so
--     omitting write policies keeps the table read-only to clients.

-- 1. challenge_catalog_export_template → invoker mode --------------------------
ALTER VIEW IF EXISTS public.challenge_catalog_export_template
  SET (security_invoker = true);

COMMENT ON VIEW public.challenge_catalog_export_template IS
  'Hardcoded-NULL template row used to validate JSON imports of the '
  'challenge catalog. security_invoker=true (no underlying data).';

-- 2. explorer_quests → enable RLS + public read-all ---------------------------
ALTER TABLE public.explorer_quests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Explorer quests are public reference data" ON public.explorer_quests;
CREATE POLICY "Explorer quests are public reference data" ON public.explorer_quests
  FOR SELECT TO authenticated, anon
  USING (true);

NOTIFY pgrst, 'reload schema';
