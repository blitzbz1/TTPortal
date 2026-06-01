-- Migration: 017_events_default_unlimited
-- Change max_participants default from 6 to NULL (unlimited by default).

ALTER TABLE public.events ALTER COLUMN max_participants SET DEFAULT NULL;
