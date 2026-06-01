-- Migration: 013_backfill_profile_emails
-- Backfill email from auth.users for profiles that have NULL email.
-- This happens when profiles were created before the migration or
-- the handle_new_user trigger didn't capture the email.

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
