-- Migration: 085_profiles_email_privacy
-- Stop exposing email (and pending_deletion_at) through profiles.
--
-- profiles SELECT is USING (true) for authenticated (002), and the table
-- contains email — one query scraped the entire user base's addresses.
-- Approach (b) from the improvement doc: keep the columns, switch the
-- authenticated role from a table-level SELECT grant to a column-list
-- grant that excludes email + pending_deletion_at.
--
-- Consequences encoded in the client alongside this migration:
-- - PostgREST now errors on profiles selects that name email or use
--   select=* — every service enumerates public columns explicitly
--   (they already did, except updateProfile's RETURNING and the admin
--   feedback inbox's email attach, both updated).
-- - Self email comes from auth.getUser() / the session.
-- - Admin surfaces that legitimately need emails use SECURITY DEFINER
--   RPCs (admin_search_users, 081) which run as the function owner and
--   are unaffected by the column grant.
-- - anon had no row access anyway (002's policy is TO authenticated);
--   it keeps no table grant.

REVOKE SELECT ON public.profiles FROM authenticated, anon;

GRANT SELECT (
  id,
  full_name,
  username,
  avatar_url,
  city,
  lang,
  auth_provider,
  created_at,
  is_admin,
  is_moderator,
  notify_friend_checkins
) ON public.profiles TO authenticated;

NOTIFY pgrst, 'reload schema';
