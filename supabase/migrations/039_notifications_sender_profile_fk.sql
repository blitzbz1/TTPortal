-- Add explicit FK from notifications.sender_id to profiles(id) so PostgREST can
-- embed `sender:profiles(...)` in a single query. The column already FKs to
-- auth.users(id); profiles.id also FKs there, so this constraint is redundant
-- for integrity but required for the embed.
--
-- ON DELETE SET NULL mirrors the existing auth.users FK behavior.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_sender_profiles_fk'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_sender_profiles_fk
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
