-- Fix Supabase database linter SECURITY ERRORs
-- (lint: 0010_security_definer_view).
--
-- Two views were running with SECURITY DEFINER semantics, which means
-- they execute with the privileges of the view OWNER and bypass RLS on
-- the underlying tables. Postgres 15+ exposes per-view security mode via
-- the `security_invoker` reloption; flipping both to invoker mode causes
-- RLS to be evaluated against the calling user instead, which is what
-- the linter requires.
--
--   * public.current_equipment
--     — SELECT DISTINCT ON (user_id) over equipment_history.
--     — Production access path is via current_equipment_for_user(uuid),
--       which is itself SECURITY DEFINER and performs friendship-based
--       authorization. That function still bypasses RLS as before;
--       only DIRECT selects on the view change behavior. Direct selects
--       will now be subject to RLS on equipment_history (which is
--       enabled per migration 024).
--
--   * public.challenge_catalog_export_template
--     — Hardcoded NULL row used as a JSON import template for the
--       challenge catalog. No data sensitivity. Safe to flip.

ALTER VIEW IF EXISTS public.current_equipment
  SET (security_invoker = true);

ALTER VIEW IF EXISTS public.challenge_catalog_export_template
  SET (security_invoker = true);

COMMENT ON VIEW public.current_equipment IS
  'Latest equipment row per user (DISTINCT ON user_id from '
  'equipment_history). security_invoker=true so RLS on equipment_history '
  'is enforced for direct SELECTs. Authorized cross-user reads go through '
  'current_equipment_for_user(uuid).';

COMMENT ON VIEW public.challenge_catalog_export_template IS
  'Hardcoded-NULL template row used to validate JSON imports of the '
  'challenge catalog. security_invoker=true (no underlying data).';
