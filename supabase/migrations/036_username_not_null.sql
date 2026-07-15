-- Migration: 036_username_not_null
-- Every profile is now guaranteed a username via the handle_new_user trigger
-- (migration 035), so we can tighten the column.

ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
