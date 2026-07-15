-- Migration: 011_fix_fk_references
-- Fix foreign keys on tables that were NOT renamed in 000 but still reference
-- the old (now renamed) tables. These FKs need to point to the new tables.

-- Events → venues
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_venue_id_fkey;
ALTER TABLE public.events ADD CONSTRAINT events_venue_id_fkey
  FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE SET NULL;

-- Favorites → venues
ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS favorites_venue_id_fkey;
ALTER TABLE public.favorites ADD CONSTRAINT favorites_venue_id_fkey
  FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;

-- Checkins → venues
ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS checkins_venue_id_fkey;
ALTER TABLE public.checkins ADD CONSTRAINT checkins_venue_id_fkey
  FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;

-- Condition votes → venues
ALTER TABLE public.condition_votes DROP CONSTRAINT IF EXISTS condition_votes_venue_id_fkey;
ALTER TABLE public.condition_votes ADD CONSTRAINT condition_votes_venue_id_fkey
  FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;

-- Reviews → venues (new reviews table was created fresh, but just in case)
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_venue_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_venue_id_fkey
  FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;
