-- Migration: 000_pre_migration_rename
-- Renames existing tables and their indexes to *_old so that subsequent
-- migrations can create fresh tables with the correct schema.
-- Data is preserved in the _old tables.
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

-- Rename indexes on old tables so new tables can reuse the names
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_venues_city') THEN
    ALTER INDEX idx_venues_city RENAME TO idx_venues_city_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_venues_type') THEN
    ALTER INDEX idx_venues_type RENAME TO idx_venues_type_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_venues_approved') THEN
    ALTER INDEX idx_venues_approved RENAME TO idx_venues_approved_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_venues_name_city') THEN
    ALTER INDEX idx_venues_name_city RENAME TO idx_venues_name_city_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reviews_venue') THEN
    ALTER INDEX idx_reviews_venue RENAME TO idx_reviews_venue_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_friendships_requester') THEN
    ALTER INDEX idx_friendships_requester RENAME TO idx_friendships_requester_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_friendships_addressee') THEN
    ALTER INDEX idx_friendships_addressee RENAME TO idx_friendships_addressee_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_favorites_user') THEN
    ALTER INDEX idx_favorites_user RENAME TO idx_favorites_user_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_checkins_user') THEN
    ALTER INDEX idx_checkins_user RENAME TO idx_checkins_user_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_checkins_venue') THEN
    ALTER INDEX idx_checkins_venue RENAME TO idx_checkins_venue_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_checkins_user_ended') THEN
    ALTER INDEX idx_checkins_user_ended RENAME TO idx_checkins_user_ended_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_checkins_venue_ended') THEN
    ALTER INDEX idx_checkins_venue_ended RENAME TO idx_checkins_venue_ended_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_starts') THEN
    ALTER INDEX idx_events_starts RENAME TO idx_events_starts_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_organizer') THEN
    ALTER INDEX idx_events_organizer RENAME TO idx_events_organizer_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_participants_event') THEN
    ALTER INDEX idx_event_participants_event RENAME TO idx_event_participants_event_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_participants_user') THEN
    ALTER INDEX idx_event_participants_user RENAME TO idx_event_participants_user_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_condition_votes_venue') THEN
    ALTER INDEX idx_condition_votes_venue RENAME TO idx_condition_votes_venue_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_friendships_addressee_status') THEN
    ALTER INDEX idx_friendships_addressee_status RENAME TO idx_friendships_addressee_status_old;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reviews_user') THEN
    ALTER INDEX idx_reviews_user RENAME TO idx_reviews_user_old;
  END IF;
END $$;
