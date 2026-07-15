-- Migration: 137_no_blocking_staff
-- Users cannot block admins/moderators — by definition staff are maintainers,
-- and (with the 136 staff-mediated DM channel) a user must not be able to dodge
-- a moderator by blocking them. Enforced with a BEFORE INSERT trigger on
-- user_blocks so EVERY path is covered: the block_user() RPC (072, SECURITY
-- INVOKER) AND any direct PostgREST insert allowed by the "users insert own
-- blocks" RLS policy. Because no user->staff block row can exist afterward,
-- every block consumer (the 136 DM gates, get_dm_threads/feed filters, etc.)
-- automatically treats staff as unblockable with no per-consumer change.

-- 1. Reject blocks targeting a staff member ----------------------------------
CREATE OR REPLACE FUNCTION public.trg_forbid_blocking_staff()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p
             WHERE p.id = NEW.blocked_id AND (p.is_admin OR p.is_moderator)) THEN
    RAISE EXCEPTION 'cannot_block_staff' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forbid_blocking_staff ON public.user_blocks;
CREATE TRIGGER forbid_blocking_staff
  BEFORE INSERT ON public.user_blocks
  FOR EACH ROW EXECUTE FUNCTION public.trg_forbid_blocking_staff();

-- 2. One-time cleanup: drop any legacy blocks that target current staff -------
-- (e.g. created before this rule, or against a user later promoted to staff).
DELETE FROM public.user_blocks b
USING public.profiles p
WHERE b.blocked_id = p.id
  AND (p.is_admin OR p.is_moderator);

NOTIFY pgrst, 'reload schema';
