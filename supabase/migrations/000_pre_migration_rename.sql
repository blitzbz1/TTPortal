-- Migration: 000_pre_migration_rename
-- Renames existing tables to *_old so that subsequent migrations can create
-- fresh tables with the correct schema. Data is preserved in the _old tables.
-- This migration is idempotent — it skips tables that don't exist.

DO $$ BEGIN
  -- Rename venues → venues_old
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venues')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venues_old') THEN
    ALTER TABLE public.venues RENAME TO venues_old;
    RAISE NOTICE 'Renamed venues → venues_old';
  END IF;

  -- Rename cities → cities_old
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cities')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cities_old') THEN
    ALTER TABLE public.cities RENAME TO cities_old;
    RAISE NOTICE 'Renamed cities → cities_old';
  END IF;

  -- Rename reviews → reviews_old
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews_old') THEN
    ALTER TABLE public.reviews RENAME TO reviews_old;
    RAISE NOTICE 'Renamed reviews → reviews_old';
  END IF;

  -- Rename friendships → friendships_old
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'friendships')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'friendships_old') THEN
    ALTER TABLE public.friendships RENAME TO friendships_old;
    RAISE NOTICE 'Renamed friendships → friendships_old';
  END IF;
END $$;
