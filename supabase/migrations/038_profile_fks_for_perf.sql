-- Add explicit foreign keys from user-id columns to public.profiles(id) so
-- PostgREST can resolve `profiles(...)` embeds in a single query, eliminating
-- the manual two-step "fetch ids then fetch profiles" pattern in services.
--
-- Each user-id column already FKs to auth.users(id); profiles.id also FKs
-- there, so the new FKs are redundant for integrity but required for embeds.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friendships_requester_profiles_fk'
  ) THEN
    ALTER TABLE public.friendships
      ADD CONSTRAINT friendships_requester_profiles_fk
      FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friendships_addressee_profiles_fk'
  ) THEN
    ALTER TABLE public.friendships
      ADD CONSTRAINT friendships_addressee_profiles_fk
      FOREIGN KEY (addressee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checkins_user_profiles_fk'
  ) THEN
    ALTER TABLE public.checkins
      ADD CONSTRAINT checkins_user_profiles_fk
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_participants_user_profiles_fk'
  ) THEN
    ALTER TABLE public.event_participants
      ADD CONSTRAINT event_participants_user_profiles_fk
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
