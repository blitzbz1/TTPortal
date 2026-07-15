-- Migration: 082_profiles_role_guard
-- Block self-escalation of privileged profile columns.
--
-- The only UPDATE policy on profiles is own-row (002) with no column
-- restriction, so any logged-in user could PATCH their own row with
-- {"is_admin": true} via PostgREST and unlock every admin RPC. This guard
-- trigger raises when a non-admin changes is_admin / is_moderator /
-- pending_deletion_at.
--
-- Design notes
-- ============
-- - pending_deletion_at is guarded too: the 30-day grace window must only
--   move through request_account_deletion()/cancel_account_deletion(), not
--   by direct PATCH. Those two RPCs were SECURITY INVOKER (071) and would
--   be blocked by this trigger, so they are recreated below as SECURITY
--   DEFINER — the trigger lets elevated owners through.
-- - Elevated paths stay functional: SECURITY DEFINER functions owned by
--   postgres (admin_set_user_moderator, the recreated 071 RPCs) and
--   service_role/dashboard operations run with current_user <> 'authenticated'
--   and are exempted. Direct PostgREST traffic always runs as
--   'authenticated'/'anon', which is exactly what we want to gate.
-- - Admins keep direct column access (the admin dashboard may edit roles).

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Unchanged privileged columns: nothing to guard.
  IF NEW.is_admin = OLD.is_admin
     AND NEW.is_moderator = OLD.is_moderator
     AND NEW.pending_deletion_at IS NOT DISTINCT FROM OLD.pending_deletion_at THEN
    RETURN NEW;
  END IF;

  -- SECURITY DEFINER functions (owned by postgres) and service/dashboard
  -- sessions do not run as the PostgREST request roles.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF public.is_current_user_admin() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'updating is_admin/is_moderator/pending_deletion_at is not allowed'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_guard ON public.profiles;
CREATE TRIGGER profiles_role_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- ----------------------------------------------------------------------
-- Recreate the 071 account-deletion RPCs as SECURITY DEFINER so the
-- pending_deletion_at guard above does not block the legitimate
-- self-service deletion flow. Bodies are unchanged from 071.
-- ----------------------------------------------------------------------

create or replace function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_deletion_at timestamptz := now() + interval '30 days';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.profiles
     set pending_deletion_at = v_deletion_at
   where id = v_uid;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return v_deletion_at;
end;
$$;

create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.profiles
     set pending_deletion_at = null
   where id = v_uid;
end;
$$;

NOTIFY pgrst, 'reload schema';
