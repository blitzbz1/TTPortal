-- Migration: 089_definer_hardening
-- Two hardening items from the security review (§1.8):
--
-- 1. amatur_cache: 022's write policy is FOR ALL USING (true) with no TO
--    clause, so it applies to EVERYONE, not service_role as its name
--    claims — any authenticated (or anon) client could poison the cache /
--    inject HTML into the AmaTur feed. service_role bypasses RLS anyway,
--    so the policy only ever added risk. Drop it; keep anon SELECT.
--
-- 2. search_path on SECURITY DEFINER functions: the older definer
--    functions (handle_new_user, refresh_stats, the 009 notification
--    triggers, send_event_invites, enforce_rate_limit, …) run without
--    SET search_path — a search_path-injection foothold. Instead of
--    enumerating them (and going stale), pin search_path on EVERY public
--    definer function that doesn't configure one. All function bodies use
--    schema-qualified references (public.*, net.http_post), so the
--    restricted path is safe. Functions that deliberately set a wider
--    path (e.g. hard_delete_expired_accounts: public, auth, pg_temp) are
--    skipped by the proconfig check.

-- ----------------------------------------------------------------------
-- 1. amatur_cache
-- ----------------------------------------------------------------------

DROP POLICY IF EXISTS "Service role can upsert amatur cache" ON public.amatur_cache;
-- "Anyone can read amatur cache" (SELECT USING true) stays.

-- ----------------------------------------------------------------------
-- 2. Pin search_path on all unpinned SECURITY DEFINER functions
-- ----------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
    RAISE NOTICE 'search_path pinned on %', r.sig;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
