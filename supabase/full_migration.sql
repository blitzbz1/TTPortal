-- FILE: 000_pre_migration_rename.sql

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

-- FILE: 001_create_profiles.sql

-- Migration: 001_create_profiles
-- Creates the public.profiles table and auto-creation trigger for new auth users.

-- Profiles table stores app-specific user data alongside Supabase Auth.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  avatar_url TEXT,
  city TEXT,
  lang TEXT NOT NULL DEFAULT 'ro',
  auth_provider TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (policies added in a future migration).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger function: auto-create a profile row when a new auth user signs up.
-- Extracts full_name and auth_provider from user metadata set during registration.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, auth_provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'auth_provider', 'email')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users table.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- FILE: 002_profiles_rls.sql

-- Migration: 002_profiles_rls
-- Add RLS policies to profiles table and username column.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- RLS policies (drop + create for idempotency)
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- FILE: 003_core_tables.sql

-- Migration: 003_core_tables
-- Creates all application tables.

-- Cities
CREATE TABLE IF NOT EXISTS public.cities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  county TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  zoom INT DEFAULT 12,
  venue_count INT DEFAULT 0,
  active BOOLEAN DEFAULT true
);

-- Venues
CREATE TABLE IF NOT EXISTS public.venues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('parc_exterior', 'sala_indoor')),
  city TEXT NOT NULL,
  county TEXT,
  sector TEXT,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  tables_count INT DEFAULT 0,
  condition TEXT DEFAULT 'necunoscuta' CHECK (condition IN ('buna', 'acceptabila', 'deteriorata', 'necunoscuta', 'profesionala')),
  hours TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  photos TEXT[] DEFAULT '{}',
  free_access BOOLEAN DEFAULT true,
  night_lighting BOOLEAN DEFAULT false,
  nets BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT false,
  tariff TEXT,
  website TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id SERIAL PRIMARY KEY,
  venue_id INT NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name TEXT DEFAULT 'Anonim',
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT NOT NULL,
  flagged BOOLEAN DEFAULT false,
  flag_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id INT NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, venue_id)
);

-- Check-ins
CREATE TABLE IF NOT EXISTS public.checkins (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id INT NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  table_number INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  friends UUID[] DEFAULT '{}'
);

-- Condition votes
CREATE TABLE IF NOT EXISTS public.condition_votes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id INT NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  condition TEXT NOT NULL CHECK (condition IN ('buna', 'acceptabila', 'deteriorata')),
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Friendships
CREATE TABLE IF NOT EXISTS public.friendships (
  id SERIAL PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- Events
CREATE TABLE IF NOT EXISTS public.events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  venue_id INT REFERENCES public.venues(id) ON DELETE SET NULL,
  table_number INT,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  max_participants INT DEFAULT 6,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'cancelled', 'completed')),
  event_type TEXT DEFAULT 'casual' CHECK (event_type IN ('casual', 'tournament')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event participants
CREATE TABLE IF NOT EXISTS public.event_participants (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_venues_city ON public.venues(city);
CREATE INDEX IF NOT EXISTS idx_venues_type ON public.venues(type);
CREATE INDEX IF NOT EXISTS idx_venues_approved ON public.venues(approved);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_name_city ON public.venues(name, city);
CREATE INDEX IF NOT EXISTS idx_reviews_venue ON public.reviews(venue_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user ON public.checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_venue ON public.checkins(venue_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_events_starts ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON public.events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON public.event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_condition_votes_venue ON public.condition_votes(venue_id);

-- FILE: 004_rls_policies.sql

-- Migration: 004_rls_policies
-- Enable RLS and add policies for all tables.

-- Cities: public read
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cities are publicly readable" ON public.cities;
CREATE POLICY "Cities are publicly readable" ON public.cities FOR SELECT USING (true);

-- Venues: public read (approved), authenticated insert, owner update
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Approved venues are publicly readable" ON public.venues;
CREATE POLICY "Approved venues are publicly readable" ON public.venues FOR SELECT USING (approved = true);
DROP POLICY IF EXISTS "Admins can view all venues" ON public.venues;
CREATE POLICY "Admins can view all venues" ON public.venues FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
DROP POLICY IF EXISTS "Authenticated users can insert venues" ON public.venues;
CREATE POLICY "Authenticated users can insert venues" ON public.venues FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitted_by);
DROP POLICY IF EXISTS "Owners can update own venues" ON public.venues;
CREATE POLICY "Owners can update own venues" ON public.venues FOR UPDATE TO authenticated
  USING (auth.uid() = submitted_by) WITH CHECK (auth.uid() = submitted_by);
DROP POLICY IF EXISTS "Admins can update any venue" ON public.venues;
CREATE POLICY "Admins can update any venue" ON public.venues FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
DROP POLICY IF EXISTS "Admins can delete venues" ON public.venues;
CREATE POLICY "Admins can delete venues" ON public.venues FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Reviews: public read, authenticated insert, owner manage
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reviews are publicly readable" ON public.reviews;
CREATE POLICY "Reviews are publicly readable" ON public.reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
CREATE POLICY "Authenticated users can insert reviews" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
CREATE POLICY "Users can update own reviews" ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own reviews" ON public.reviews;
CREATE POLICY "Users can delete own reviews" ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can delete any review" ON public.reviews;
CREATE POLICY "Admins can delete any review" ON public.reviews FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Favorites: own only
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own favorites" ON public.favorites;
CREATE POLICY "Users can read own favorites" ON public.favorites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
CREATE POLICY "Users can insert own favorites" ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
CREATE POLICY "Users can delete own favorites" ON public.favorites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Check-ins: own read/insert, public read for active (friends feature)
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own checkins" ON public.checkins;
CREATE POLICY "Users can read own checkins" ON public.checkins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Active checkins are readable" ON public.checkins;
CREATE POLICY "Active checkins are readable" ON public.checkins FOR SELECT TO authenticated
  USING (ended_at > now());
DROP POLICY IF EXISTS "Users can insert own checkins" ON public.checkins;
CREATE POLICY "Users can insert own checkins" ON public.checkins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own checkins" ON public.checkins;
CREATE POLICY "Users can update own checkins" ON public.checkins FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Condition votes: public read, authenticated insert
ALTER TABLE public.condition_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Condition votes are publicly readable" ON public.condition_votes;
CREATE POLICY "Condition votes are publicly readable" ON public.condition_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can vote" ON public.condition_votes;
CREATE POLICY "Authenticated users can vote" ON public.condition_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Friendships: participants only
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own friendships" ON public.friendships;
CREATE POLICY "Users can read own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
DROP POLICY IF EXISTS "Addressees can update friendship status" ON public.friendships;
CREATE POLICY "Addressees can update friendship status" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id);
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Events: public read, authenticated insert, organizer manage
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events are publicly readable" ON public.events;
CREATE POLICY "Events are publicly readable" ON public.events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
CREATE POLICY "Authenticated users can create events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = organizer_id);
DROP POLICY IF EXISTS "Organizers can update own events" ON public.events;
CREATE POLICY "Organizers can update own events" ON public.events FOR UPDATE TO authenticated
  USING (auth.uid() = organizer_id);
DROP POLICY IF EXISTS "Organizers can delete own events" ON public.events;
CREATE POLICY "Organizers can delete own events" ON public.events FOR DELETE TO authenticated
  USING (auth.uid() = organizer_id);

-- Event participants: public read, authenticated join/leave
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Event participants are publicly readable" ON public.event_participants;
CREATE POLICY "Event participants are publicly readable" ON public.event_participants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can join events" ON public.event_participants;
CREATE POLICY "Users can join events" ON public.event_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can leave events" ON public.event_participants;
CREATE POLICY "Users can leave events" ON public.event_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- FILE: 005_functions_views.sql

-- Migration: 005_functions_views
-- Materialized views for aggregated data (venue stats, leaderboards).
-- These are refreshed via triggers or periodic cron, not recomputed on every query.

-- ============================================================
-- Venue stats (materialized)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.venue_stats AS
SELECT
  v.id AS venue_id,
  COALESCE(AVG(r.rating), 0)::NUMERIC(2,1) AS avg_rating,
  COUNT(DISTINCT r.id)::INT AS review_count,
  COUNT(DISTINCT c.id)::INT AS checkin_count,
  COUNT(DISTINCT f.id)::INT AS favorite_count
FROM public.venues v
LEFT JOIN public.reviews r ON r.venue_id = v.id
LEFT JOIN public.checkins c ON c.venue_id = v.id
LEFT JOIN public.favorites f ON f.venue_id = v.id
GROUP BY v.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_stats_venue ON public.venue_stats(venue_id);

-- ============================================================
-- Leaderboard: check-ins (materialized)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.leaderboard_checkins AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.city,
  COUNT(c.id)::INT AS total_checkins,
  COUNT(DISTINCT c.venue_id)::INT AS unique_venues,
  RANK() OVER (ORDER BY COUNT(c.id) DESC)::INT AS rank
FROM public.profiles p
LEFT JOIN public.checkins c ON c.user_id = p.id
GROUP BY p.id, p.full_name, p.avatar_url, p.city
HAVING COUNT(c.id) > 0
ORDER BY total_checkins DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lb_checkins_user ON public.leaderboard_checkins(user_id);

-- ============================================================
-- Leaderboard: reviews (materialized)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.leaderboard_reviews AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.city,
  COUNT(r.id)::INT AS total_reviews,
  COALESCE(AVG(r.rating), 0)::NUMERIC(2,1) AS avg_given_rating,
  RANK() OVER (ORDER BY COUNT(r.id) DESC)::INT AS rank
FROM public.profiles p
LEFT JOIN public.reviews r ON r.user_id = p.id
GROUP BY p.id, p.full_name, p.avatar_url, p.city
HAVING COUNT(r.id) > 0
ORDER BY total_reviews DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lb_reviews_user ON public.leaderboard_reviews(user_id);

-- ============================================================
-- Leaderboard: venues added (materialized)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.leaderboard_venues AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.avatar_url,
  p.city,
  COUNT(v.id)::INT AS venues_added,
  RANK() OVER (ORDER BY COUNT(v.id) DESC)::INT AS rank
FROM public.profiles p
LEFT JOIN public.venues v ON v.submitted_by = p.id AND v.approved = true
GROUP BY p.id, p.full_name, p.avatar_url, p.city
HAVING COUNT(v.id) > 0
ORDER BY venues_added DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lb_venues_user ON public.leaderboard_venues(user_id);

-- ============================================================
-- Helper function to refresh all materialized views
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_stats() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.venue_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_checkins;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_reviews;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_venues;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Performance indexes for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_checkins_user_ended ON public.checkins(user_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_checkins_venue_ended ON public.checkins(venue_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status ON public.friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON public.event_participants(user_id);

-- FILE: 006_seed_data.sql

-- Migration: 006_seed_data
-- Seed cities and core sample venues for development.

-- Cities
INSERT INTO public.cities (name, county, lat, lng, zoom, venue_count, active) VALUES
  ('București', 'București', 44.4268, 26.1025, 12, 0, true),
  ('Cluj-Napoca', 'Cluj', 46.7712, 23.6236, 13, 0, true),
  ('Timișoara', 'Timiș', 45.7489, 21.2087, 13, 0, true),
  ('Iași', 'Iași', 47.1585, 27.6014, 13, 0, true),
  ('Brașov', 'Brașov', 45.6427, 25.5887, 13, 0, true),
  ('Constanța', 'Constanța', 44.1598, 28.6348, 13, 0, true),
  ('Craiova', 'Dolj', 44.3302, 23.7949, 13, 0, true),
  ('Oradea', 'Bihor', 47.0465, 21.9189, 13, 0, true),
  ('Galați', 'Galați', 45.4353, 28.0080, 13, 0, true),
  ('Ploiești', 'Prahova', 44.9362, 26.0138, 13, 0, true),
  ('Târgu Mureș', 'Mureș', 46.5386, 24.5578, 13, 0, true),
  ('Bacău', 'Bacău', 46.5670, 26.9146, 13, 0, true),
  ('Pitești', 'Argeș', 44.8565, 24.8694, 13, 0, true),
  ('Arad', 'Arad', 46.1866, 21.3123, 13, 0, true),
  ('Sibiu', 'Sibiu', 45.7983, 24.1256, 13, 0, true)
ON CONFLICT (name) DO NOTHING;

-- Core sample venues in București
INSERT INTO public.venues (name, type, city, county, address, lat, lng, tables_count, condition, free_access, night_lighting, nets, verified, approved, created_at) VALUES
  ('Parcul Național', 'parc_exterior', 'București', 'București', 'Bd. Ferdinand nr. 1', 44.4350, 26.1120, 4, 'buna', true, false, true, true, true, '2026-03-28T10:52:58.175738+00:00'),
  ('Sala Sporturilor Titan', 'sala_indoor', 'București', 'București', 'Bd. Liviu Rebreanu nr. 2', 44.4180, 26.1510, 8, 'profesionala', false, true, true, true, true, '2026-03-28T10:52:58.175738+00:00'),
  ('Parcul IOR', 'parc_exterior', 'București', 'București', 'Bd. Camil Ressu', 44.4145, 26.1370, 2, 'acceptabila', true, false, false, false, true, '2026-03-28T10:52:58.175738+00:00'),
  ('Parcul Herăstrău', 'parc_exterior', 'București', 'București', 'Aleea Privighetorilor', 44.4740, 26.0780, 6, 'buna', true, true, true, true, true, '2026-03-28T10:52:58.175738+00:00'),
  ('Club Sportiv Dinamo', 'sala_indoor', 'București', 'București', 'Șos. Ștefan cel Mare nr. 7-9', 44.4530, 26.1160, 16, 'profesionala', false, true, true, true, true, '2026-03-28T10:52:58.175738+00:00')
ON CONFLICT (name, city) DO NOTHING;

-- Update city venue count
UPDATE public.cities
SET venue_count = (
  SELECT COUNT(*) FROM public.venues WHERE venues.city = cities.name AND venues.approved = true
);

-- FILE: 007_cloud_venues_sync.sql

-- Migration: 007_cloud_venues_sync
-- Synced with the normalized live Supabase venue dataset.

INSERT INTO public.venues (
  name, type, city, county, sector, address, lat, lng, tables_count, condition,
  hours, description, tags, photos, free_access, night_lighting, nets, verified,
  tariff, website, approved, created_at
) VALUES
  ('Parcul Automatica', 'parc_exterior', 'București', 'București', 'Sector 2', 'Str. Fabrica de Glucoză, Sector 2, București', 44.4735, 26.1165, 2, 'acceptabila', 'Acces liber', 'Parc de cartier în zona Floreasca / Colentina.', ARRAY['gratuit', 'exterior', 'sport'], ARRAY[]::text[], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Bazilescu', 'parc_exterior', 'București', 'București', 'Sector 1', 'Str. Bazilescu, Sector 1, București', 44.4812, 25.9978, 2, 'acceptabila', 'Acces liber', 'Parc de cartier în zona nord-vest a Bucureștiului.', ARRAY['gratuit', 'exterior'], ARRAY[]::text[], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Tei', 'parc_exterior', 'București', 'București', 'Sector 2', 'Șos. Ștefan cel Mare / Str. Dobrogeanu Gherea, Sector 2', 44.4612, 26.1338, 3, 'acceptabila', 'Acces liber', 'Parc cu lac în Sectorul 2, popular pentru activități sportive.', ARRAY['gratuit', 'exterior', 'lac'], ARRAY[]::text[], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Ping Poc', 'sala_indoor', 'București', 'București', 'Sector 4', 'Șos. Berceni nr. 104, bl. turn, et. 3, Sector 4', 44.3942, 26.1025, 5, 'profesionala', 'Zilnic 09:00–23:00', 'Nou deschis 2024. Separeu privat + spațiu comun. Concursuri săptămânale.', ARRAY['plată', 'indoor', 'separeu', 'rezervare online', 'Donic Waldner'], ARRAY[]::text[], false, true, true, true, '25 lei/oră (comun) / 35 lei/oră (separeu)', 'https://pingpoc.ro', true, '2026-03-19T08:31:09.257296+00:00'),
  ('CS Otilia Badescu – Sala Polivalentă', 'sala_indoor', 'București', 'București', 'Sector 4', 'Calea Piscului nr. 10, incinta Sala Polivalentă, Sector 4', 44.3982, 26.1008, NULL, 'profesionala', 'L-V 17:30–22:00, weekend 09:00–15:00', 'Sala campioanei Otilia Badescu, multiplu medaliată european și mondial.', ARRAY['plată', 'indoor', 'antrenori', 'robot', 'Donic'], ARRAY[]::text[], false, true, NULL, true, '35 lei/oră (robot: 50 lei/oră)', 'https://www.facebook.com/profile.php?id=61563913030853', true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Ioanid', 'parc_exterior', 'București', 'București', 'Sector 1', 'Str. Orlando / Bd. Dacia, Sector 1, București', 44.4513, 26.0849, 2, 'acceptabila', 'Acces liber', 'Parc mic, elegant, în zona rezidențială Sector 1.', ARRAY['gratuit', 'exterior'], ARRAY[]::text[], true, false, false, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Drumul Taberei (Moghioroș)', 'parc_exterior', 'București', 'București', 'Sector 6', 'Bd. Timișoara / Str. Brașov, Sector 6, București', 44.420917, 26.029722, 6, 'buna', 'Acces liber', 'Parc mare din Sectorul 6, facilități sportive multiple.', ARRAY['gratuit', 'exterior'], ARRAY[]::text[], true, false, true, true, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Sfânta Cristina', 'parc_exterior', 'București', 'București', 'Sector 1', 'Strada Siret 95, 012244 București', 44.463694, 26.062222, 1, 'buna', 'Acces liber', NULL, ARRAY['gratuit', 'exterior'], ARRAY[]::text[], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Râul Colentina', 'parc_exterior', 'București', 'București', 'Sector 2', 'Zona râului Colentina, Sector 2, București', 44.454278, 26.1495, 4, 'buna', 'Acces liber', '4 mese cu fileuri', ARRAY['gratuit', 'exterior', 'mal râu'], ARRAY[]::text[], true, false, true, true, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Regina Maria', 'parc_exterior', 'București', 'București', 'Sector 1', 'Str. Turda 117, 011322 București', 44.457833, 26.0665, 2, 'acceptabila', 'Acces liber', 'Spațiu verde urban cu loc de joacă, fântâni și bănci, plus teren de baschet și două parcuri pentru câini.', ARRAY['gratuit', 'exterior', 'loc joacă'], ARRAY[]::text[], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Florilor', 'parc_exterior', 'București', 'București', 'Sector 1', 'Șos. Pantelimon / Bd. Chișinău, București', 44.444028, 26.16975, 3, 'acceptabila', 'Acces liber', 'Pantelimon / Delfinului', ARRAY['gratuit', 'exterior'], ARRAY[]::text[], true, true, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Ferentari', 'parc_exterior', 'București', 'București', 'Sector 5', 'Calea Ferentari, Sector 5, București', 44.41127, 26.07502, 2, 'deteriorata', 'Acces liber', 'Parc de cartier Sector 5. Starea dotărilor variabilă.', ARRAY['gratuit', 'exterior', 'deteriorat'], ARRAY[]::text[], true, false, false, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Ping Pong Academy', 'sala_indoor', 'București', 'București', 'Sector 5', 'Strada Haţegana 17, 052034 București', 44.407917, 26.093917, 12, 'profesionala', 'Luni–Duminică (verificați pagina)', 'Club complet cu antrenori, echipă Divizia A, concursuri interne.', ARRAY['plată', 'indoor', 'antrenori', 'Divizia A', 'concursuri'], ARRAY[]::text[], false, true, true, true, '33–43 lei/oră', 'https://www.facebook.com/clubsportivpingpongacademy', true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Liniei', 'parc_exterior', 'București', 'București', 'Sector 6', 'Str. Lujerului, București', 44.431417, 26.0375, 4, 'buna', 'Acces liber', 'Parc liniar pe fosta linie de tramvai.', ARRAY['gratuit', 'exterior', 'liniar'], ARRAY[]::text[], true, false, true, true, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Miniparcul Dumitru Teodoru – Viilor', 'parc_exterior', 'București', 'București', 'Sector 5', 'Calea Viilor / Str. Dumitru Teodoru, Sector 5', 44.41682, 26.08435, 1, 'necunoscuta', 'Acces liber', 'Minispaciu verde de cartier. Dotări minime – necesită verificare.', ARRAY['gratuit', 'exterior', 'mic'], ARRAY[]::text[], true, false, false, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('PingPro', 'sala_indoor', 'București', 'București', 'Sector 1', 'Str. Copilului nr. 20A, Domenii, Sector 1, București', 44.46497, 26.0604, NULL, 'profesionala', 'D-J 08:30–22:30, V-S 08:30–23:30', 'Deschis 2025. Rezervare online cu alegere masă. Sistem reluări instant.', ARRAY['plată', 'indoor', 'rezervare online', 'sistem reluări', 'Joola'], ARRAY[]::text[], false, true, false, true, 'variabil (promoții disponibile)', 'https://www.pingpro.ro', true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Kiseleff', 'parc_exterior', 'București', 'București', 'Sector 1', 'Șos. Kiseleff, Sector 1, București', 44.455833, 26.084417, 3, 'acceptabila', 'Acces liber', 'Parc central-nord, parte din axa verde a capitalei.', ARRAY['gratuit', 'exterior'], ARRAY[]::text[], true, true, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Pridvorului', 'parc_exterior', 'București', 'București', 'Sector 2', 'Strada Pridvorului, Sector 2, București', 44.462, 26.105, 5, 'buna', 'Acces liber', 'Unele mese la umbra copacilor - plăcut vara. Confirmat pe pingpongmap.net.', ARRAY['gratuit', 'exterior', 'umbră', 'vară'], ARRAY[]::text[], true, false, true, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00'),
  ('CS Stirom – Tenis de Masă', 'sala_indoor', 'București', 'București', 'Sector 3', 'Bulevardul Theodor Pallady nr. 45, Sector 3, București', 44.419, 26.168, 5, 'profesionala', 'Zilnic de la ora 09:00 (verificați)', 'Sală dedicată exclusiv tenisului de masă, incinta fabricii Stirom. Club cu tradiție, antrenori cu experiență, foști campioni naționali. Cursuri inițiere, perfecționare și performanță. Tel: 0723.306.531', ARRAY['plată', 'indoor', 'antrenori', 'Sector 3', 'tradiție'], ARRAY[]::text[], false, false, NULL, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00'),
  ('Tenis Mac Gym', 'sala_indoor', 'București', 'București', 'Sector 4', 'Calea Văcărești nr. 391, incinta sala Elite Performance, Sun Plaza, Sector 4, București', 44.384, 26.087, 6, 'profesionala', 'L-V 09:00–22:00, S 08:00–22:00, D 08:00–14:00', '6 mese de închiriat + 8 pentru competiții. Echipa CS TTT București Divizia A.', ARRAY['plată', 'indoor', 'antrenori', 'concursuri', 'Andro', 'Divizia A'], ARRAY[]::text[], false, true, NULL, true, '30 lei/oră (zi) / 35 lei/oră (weekend seara)', 'https://www.tenis-masa.ro', true, '2026-03-19T08:31:09.257296+00:00'),
  ('Viva Sport Club – Tenis de Masă', 'sala_indoor', 'București', 'București', 'Sector 4', 'Șos. Oltenitei nr. 103, Sector 4, București', 44.3805, 26.1045, NULL, 'profesionala', 'Verificați site-ul oficial', 'Card de membru obligatoriu (10 lei). ~30 min înregistrare la prima vizită.', ARRAY['plată', 'indoor', 'card membru', 'Piața Sudului'], ARRAY[]::text[], false, true, NULL, true, '40 lei/oră', 'https://www.vivasportclub.ro', true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Izvor', 'parc_exterior', 'București', 'București', 'Sector 5', 'Splaiul Independenței, Parcul Izvor, Sector 5, București', 44.432833, 26.088472, 4, 'deteriorata', 'Acces liber', 'Parc central, lângă Palatul Parlamentului.', ARRAY['gratuit', 'exterior', 'central', 'Izvor'], ARRAY[]::text[], true, false, false, false, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00'),
  ('Ping Pong Miramar', 'sala_indoor', 'București', 'București', 'Sector 2', 'Bulevardul Chișinău 6, 022152 București', 44.441139, 26.156472, 5, 'profesionala', 'Verificați pagina Facebook', '5 mese omologate ITTF, blat 25mm. Atmosferă relaxată cu muzică și bar.', ARRAY['plată', 'indoor', 'ITTF', 'muzică', 'bar'], ARRAY[]::text[], false, true, false, true, 'verificați pagina Facebook', 'https://www.facebook.com/PingPongSector2/', true, '2026-03-19T08:31:09.257296+00:00'),
  ('TSP Vibe', 'sala_indoor', 'București', 'București', 'Sector 3', 'Șos. Dudești-Pantelimon nr. 44, incinta Antilopa, Sector 3', 44.4386302876457, 26.1943227239488, 9, 'profesionala', 'Verificați pagina Facebook', '540 mp, PVC. Concursuri luni/marți/miercuri de la 18:30. Robot disponibil.', ARRAY['plată', 'indoor', 'robot', 'concursuri', '540mp'], ARRAY[]::text[], false, true, true, true, '25 lei/oră (L-V 10–16) / 35 lei/oră (vârf)', 'https://www.facebook.com/groups/3146582045558341/', true, '2026-03-19T08:31:09.257296+00:00'),
  ('IDM Club – Tenis de Masă', 'sala_indoor', 'București', 'București', 'Sector 6', 'Splaiul Independenței nr. 319B, Sector 6, București', 44.443972, 26.048833, 10, 'profesionala', 'L-J 09:00–01:00, V-S 09:00–03:00, D 09:00–01:00', NULL, ARRAY['plată', 'indoor', 'bowling', 'biliard', 'piscină', 'fitness', 'Butterfly'], ARRAY[]::text[], false, true, true, true, 'verificați site-ul (card 150 lei/an)', 'https://www.idmclub.ro', true, '2026-03-19T08:31:09.257296+00:00'),
  ('eWe Ping Pong', 'sala_indoor', 'București', 'București', 'Ilfov', 'Str. Fortului nr. 81, Domnești, Ilfov (incinta eWe Market)', 44.361, 25.992, 7, 'profesionala', 'Zilnic 09:00–22:00', 'Deschis ianuarie 2024. Recomandat pentru Militari/Ghencea/Rahova. Cafenea inclusă.', ARRAY['plată', 'indoor', 'Ilfov', 'cafenea', 'Joola 25', 'ITTF'], ARRAY['https://vzewwlaqqgukjkqjyfoq.supabase.co/storage/v1/object/public/venue-photos/venues/35/1775008622081.jpg'], false, true, NULL, true, '35 lei/oră (fix)', 'https://ewepingpong.ro', true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Cosmos', 'parc_exterior', 'București', 'București', 'Sector 3', 'Parcul Cosmos, Șos. Pantelimon 367, București', 44.441111, 26.184972, 2, 'buna', '7-22', 'Adăugat de comunitate.', ARRAY['nou adăugat'], ARRAY[]::text[], true, false, true, false, NULL, NULL, true, '2026-03-20T06:48:15.854584+00:00'),
  ('Parcul Drumul Taberei 2 (Moghioroș)', 'parc_exterior', 'București', 'București', 'Sector 6', 'Bd. Timișoara / Str. Brașov, Sector 6, București', 44.4216990634355, 26.030747294426, 3, 'buna', '7-22', 'Adăugat de comunitate.', ARRAY['nou adăugat'], ARRAY[]::text[], true, false, false, false, NULL, NULL, true, '2026-03-20T06:58:05.077063+00:00'),
  ('Parcul Cetatea Histria', 'parc_exterior', 'București', 'București', NULL, 'Strada Cetatea Histria,nr. 16-20, București', 44.4200457, 26.0227148, 2, 'necunoscuta', 'Verificați', 'Adăugat de comunitate.', ARRAY['nou adăugat'], ARRAY[]::text[], true, false, true, false, NULL, NULL, true, '2026-03-21T07:04:29.585658+00:00'),
  ('Parcul Timișoara', 'parc_exterior', 'București', 'București', 'Sector 6', 'Bulevardul Timișoara 10, 061344 București', 44.4286713, 26.0441141, 4, 'necunoscuta', 'Verificați', 'Adăugat de comunitate.', ARRAY['nou adăugat'], ARRAY[]::text[], true, false, NULL, false, NULL, NULL, true, '2026-03-21T07:13:41.640781+00:00'),
  ('Parcul “C5”', 'parc_exterior', 'București', 'București', NULL, 'Aleea Bistra 1, 061344 București', 44.42624, 26.0488, 1, 'necunoscuta', 'Verificați', 'Adăugat de comunitate.', ARRAY['nou adăugat'], ARRAY[]::text[], true, false, false, false, NULL, NULL, true, '2026-03-21T07:16:20.691683+00:00'),
  ('Sală de tenis de masă Set 11', 'sala_indoor', 'Sibiu', 'Sibiu', NULL, 'Strada August Treboniu Laurian, 2-4', 45.8016044, 24.1668087, NULL, 'profesionala', NULL, NULL, ARRAY['osm', 'way/95993443'], ARRAY[]::text[], false, false, NULL, false, '35 RON', 'https://www.b-52.ro/', true, '2026-03-21T09:10:23.997809+00:00'),
  ('Masă tenis de masă', 'parc_exterior', 'Agăș', 'Bacău', NULL, 'Strada Principală, 116', 46.4846352, 26.2203157, NULL, 'necunoscuta', NULL, NULL, ARRAY['osm', 'acoperit', 'way/1308638798'], ARRAY[]::text[], true, false, NULL, false, NULL, NULL, true, '2026-03-21T09:10:23.997809+00:00'),
  ('Kiris Hall – Tenis de Masă', 'sala_indoor', 'București', 'București', NULL, 'Șos. Pantelimon, 1-3', 44.4487461, 26.1346999, NULL, 'profesionala', 'Mo-Fr 09:00-23:00; Sa-Su 09:00-23:30', 'Academie gimnastică și tenis de masă (Academia Larisa Iordache). Mese profesionale, antrenori certificați. Rezervare online disponibilă.', ARRAY['osm', 'custom/9'], ARRAY[]::text[], false, false, NULL, false, NULL, 'https://kiris-hall.ro/', true, '2026-03-21T09:10:23.997809+00:00'),
  ('Rocket Spin', 'sala_indoor', 'Timișoara', 'Timiș', NULL, 'Calea Aradului, 48A', 45.777013, 21.2213122, NULL, 'profesionala', 'Mo-Su 10:00-22:00', 'Cea mai profesională sală din Timișoara. Mese Butterfly Octet 25 (ITTF), 3 camere VIP, robot Butterfly, antrenori. Rezervare prealabilă.', ARRAY['osm', 'custom/10'], ARRAY[]::text[], false, false, NULL, false, NULL, 'https://www.rocketspintenisdemasa.com/', true, '2026-03-21T09:10:23.997809+00:00'),
  ('ARENA Brasov – Tenis de Masă', 'sala_indoor', 'Săcele', 'Brașov', NULL, 'Strada Gospodarilor, 2', 45.616955, 25.6675707, 8, 'profesionala', 'Mo-Th 13:00-22:00; Fr 13:00-17:00', '8 mese Joola 2000-S (ITTF), podea Taraflex, iluminat LED profesional, vestiare cu dușuri, parcare privată. Centura ocolitoare Săcele.', ARRAY['osm', 'custom/13'], ARRAY[]::text[], false, false, NULL, false, NULL, 'https://arena-brasov.ro/', true, '2026-03-21T09:10:23.997809+00:00'),
  ('ACS TT Energy Brașov', 'sala_indoor', 'Brașov', 'Brașov', NULL, 'Strada Zizinului, 106', 45.6473296, 25.6417153, NULL, 'profesionala', 'Mo-Fr 15:00-21:00', 'Club de tenis de masă, cursuri inițiere și perfecționare copii, Liceul Energetic Brașov.', ARRAY['osm', 'custom/14'], ARRAY[]::text[], false, false, NULL, false, NULL, NULL, true, '2026-03-21T09:10:23.997809+00:00'),
  ('Top Spin – Tenis de Masă Craiova', 'sala_indoor', 'Craiova', 'Dolj', NULL, 'Strada Grigore Gabrielescu, 1A', 44.3334005, 23.7788649, 3, 'profesionala', 'Mo-Su 10:00-21:00', '3 mese Andro Competition profesionale, podea Taraflex sportivă. Antrenamente și inchiriere.', ARRAY['osm', 'custom/15'], ARRAY[]::text[], false, false, NULL, false, NULL, 'https://topspincraiova.com/', true, '2026-03-21T09:10:23.997809+00:00'),
  ('Complexul Sportiv Flux Arena – Tenis de Masă', 'sala_indoor', 'Cârcă', 'Dolj', NULL, 'Strada Complexului, 6A', 44.2986365, 23.8999204, NULL, 'profesionala', 'Mo-Su 08:00-03:00', 'Complex sportiv cu mese de tenis de masă, terenuri tenis, fotbal. Rezervare telefonică. Sat Cârcă, lângă Craiova.', ARRAY['osm', 'custom/16'], ARRAY[]::text[], false, false, NULL, false, NULL, 'https://www.fluxarena.net/', true, '2026-03-21T09:10:23.997809+00:00'),
  ('Parcul Tineretului', 'parc_exterior', 'București', 'București', 'Sector 4', 'Bd. Tineretului, Sector 4, București', 44.4005, 26.1089, 4, 'buna', 'Acces liber', 'Unul dintre cele mai mari parcuri din Sectorul 4.', ARRAY['gratuit', 'exterior', 'fitness', 'lac', 'patinoar'], ARRAY[]::text[], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Carol I', 'parc_exterior', 'București', 'București', 'Sector 4', 'Bd. Mărășești, Sector 4, București', 44.4139, 26.0965, 3, 'buna', 'Acces liber', 'Confirmat cu mese disponibile public. Parc istoric renovat.', ARRAY['gratuit', 'exterior', 'istoric'], ARRAY[]::text[], true, false, true, true, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul IOR (Alexandru Ioan Cuza)', 'parc_exterior', 'București', 'București', 'Sector 3', 'Str. Liviu Rebreanu, Sector 3, București', 44.418833, 26.155417, 6, 'buna', 'Acces liber', 'Parc renovat cu mese în mai multe zone. Confirmat de surse oficiale.', ARRAY['gratuit', 'exterior', 'baschet', 'fotbal', 'lac'], ARRAY[]::text[], true, false, true, true, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Național – Aleea Belvedere', 'parc_exterior', 'București', 'București', 'Sector 2', 'aleea pan halipa', 44.434534, 26.146548, 3, 'buna', 'Acces liber', 'Zona Belvedere din Parcul Național – mese pe aleea principală.', ARRAY['gratuit', 'exterior', 'alei'], ARRAY['https://vzewwlaqqgukjkqjyfoq.supabase.co/storage/v1/object/public/venue-photos/venues/73/1774898727478.jpg', 'https://vzewwlaqqgukjkqjyfoq.supabase.co/storage/v1/object/public/venue-photos/venues/73/1774898770078.jpg', 'https://vzewwlaqqgukjkqjyfoq.supabase.co/storage/v1/object/public/venue-photos/venues/73/1774899083311.jpg'], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul Național – Amfiteatrul Eminescu', 'parc_exterior', 'București', 'București', 'Sector 1', 'Lângă Amfiteatrul Mihai Eminescu, Parcul Național, Sector 1', 44.433556, 26.142917, 2, 'buna', 'Acces liber', 'Mese lângă amfiteatrul Mihai Eminescu din Parcul Național.', ARRAY['gratuit', 'exterior', 'amfiteatru'], ARRAY[]::text[], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00'),
  ('Parcul IOR 2 (Alexandru Ioan Cuza)', 'parc_exterior', 'București', 'București', 'Sector 3', 'Str. Liviu Rebreanu, Sector 3, București', 44.4178657137137, 26.1544051766396, 3, 'necunoscuta', '7-22', 'Fileuri de metal, mese in stare buna', ARRAY['nou adăugat'], ARRAY[]::text[], true, false, false, false, NULL, NULL, true, '2026-03-20T06:29:28.926468+00:00'),
  ('Club Transilvania', 'sala_indoor', 'Cluj-Napoca', 'Cluj', NULL, 'Bulevardul 1 Decembrie 1918 nr. 41, Cluj-Napoca', 46.7642, 23.5525, NULL, 'buna', 'Luni-Vineri 08:00-24:00; Sambata-Duminica 09:00-23:00', 'Baza sportiva multisport cu sala indoor care include facilitati pentru tenis de masa.', ARRAY['indoor', 'cluj', 'multisport', 'tenis de masa'], ARRAY[]::text[], false, true, true, true, NULL, 'https://www.clubtransilvania.ro/', true, '2026-04-02T07:11:28.927999+00:00'),
  ('ADR Tenis de Masă', 'sala_indoor', 'Galați', 'Galați', NULL, 'Bd. George Coșbuc nr. 122-124, Galați', 45.4231, 28.0343, 10, 'profesionala', 'Verificati telefonic programul', 'Sala indoor din Galati cu 10 mese aprobate de federatie, listata in directoare sportive romanesti.', ARRAY['indoor', 'galati', 'club', '10 mese'], ARRAY[]::text[], false, false, true, false, '10 lei / ora', NULL, true, '2026-04-02T07:11:28.927999+00:00'),
  ('Club King Pong', 'sala_indoor', 'Oradea', 'Bihor', NULL, 'Str. Vasile Alecsandri, Oradea', 47.056, 21.9286, 12, 'profesionala', 'Lu-Jo 17:00-22:00; Vi 17:00-22:00; Du 10:00-14:00', 'Club indoor din Oradea cu 12 mese profesionale, program public afisat pe site-ul clubului.', ARRAY['indoor', 'club', 'oradea', 'joola', 'donic'], ARRAY[]::text[], false, true, true, true, NULL, 'https://www.kingpong.ro/', true, '2026-04-02T07:11:28.927999+00:00'),
  ('Mr. Pong', 'sala_indoor', 'Iași', 'Iași', NULL, 'Bd. Primăverii nr. 2, Bloc Iasitex, et. 7, Iași', 47.1416, 27.6141, 4, 'profesionala', 'Luni-Vineri 16:30-23:00; Sambata-Duminica 10:00-18:00', 'Sala de tenis de masa pentru agrement si antrenament, cu tarife si program public afisate online.', ARRAY['indoor', 'iasi', 'agrement', 'donic'], ARRAY[]::text[], false, false, true, true, '10 lei / ora / masa', 'https://www.tenisdemasa-iasi.ro/', true, '2026-04-02T07:11:28.927999+00:00'),
  ('AMA Sport Center', 'sala_indoor', 'Ploiești', 'Prahova', NULL, 'Str. Bobâlna nr. 129, Ploiești', 44.9508, 26.0407, 3, 'buna', 'Luni-Vineri 11:00-23:00; Sambata-Duminica 11:00-23:00', 'Sala indoor din Ploiesti cu 3 mese Sponeta, listata in directoare sportive romanesti.', ARRAY['indoor', 'ploiesti', 'club', 'sponeta'], ARRAY[]::text[], false, false, true, false, '10-13 lei / ora', 'http://facebook.com/ama.sport', true, '2026-04-02T07:11:28.927999+00:00'),
  ('CS Crișul Oradea - Tenis de Masă', 'sala_indoor', 'Oradea', 'Bihor', NULL, 'Str. Simion Bărnuțiu nr. 15, Oradea', 47.0682, 21.9347, NULL, 'profesionala', 'Verificati programul clubului', 'Sectia de tenis de masa a Clubului Sportiv Crisul Oradea.', ARRAY['indoor', 'club', 'oradea', 'performanta'], ARRAY[]::text[], false, false, true, true, NULL, 'https://www.cscrisul.ro/sectii/tenis-de-masa/', true, '2026-04-02T07:11:28.927999+00:00'),
  ('Club Eden', 'sala_indoor', 'Constanța', 'Constanța', NULL, 'B-dul Aurel Vlaicu nr. 70, Constanța', 44.1914, 28.613, NULL, 'buna', NULL, 'Club indoor din Constanța, validat prin mai multe listări de turnee și directoare locale.', ARRAY['indoor', 'club', 'constanta', 'turnee'], ARRAY[]::text[], false, false, true, false, NULL, NULL, true, '2026-04-02T07:30:08.036897+00:00'),
  ('Tenis Club 60', 'sala_indoor', 'Bacău', 'Bacău', NULL, 'Str. Ștefan cel Mare nr. 27, Bacău', 46.5714, 26.9139, NULL, 'buna', NULL, 'Club de tenis de masă din Bacău, confirmat prin discuții comunitare și anunțuri dedicate.', ARRAY['indoor', 'club', 'bacau'], ARRAY[]::text[], false, false, true, false, NULL, NULL, true, '2026-04-02T07:30:08.036897+00:00'),
  ('Sports Mania', 'sala_indoor', 'Pitești', 'Argeș', NULL, 'Str. Prelungirea Craiovei nr. 13, Pitești', 44.8405, 24.8562, 12, 'profesionala', NULL, 'Sală indoor din Pitești cu mese Donic și istoric de turnee pentru amatori.', ARRAY['indoor', 'pitesti', 'donic', 'turnee'], ARRAY[]::text[], false, false, true, false, NULL, NULL, true, '2026-04-02T07:30:08.036897+00:00')
ON CONFLICT (name, city) DO NOTHING;

-- Update city venue counts
UPDATE public.cities
SET venue_count = (
  SELECT COUNT(*) FROM public.venues WHERE venues.city = cities.name AND venues.approved = true
);

-- FILE: 008_notifications.sql

-- Migration: 008_notifications
-- Push notification tokens and in-app notification history.

-- Push tokens: stores Expo push tokens per user/device
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);

-- Notifications: in-app notification history
CREATE TABLE IF NOT EXISTS public.notifications (
  id              SERIAL PRIMARY KEY,
  recipient_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN (
    'friend_request', 'friend_accepted',
    'event_reminder', 'event_joined', 'event_cancelled',
    'checkin_nearby',
    'review_on_venue'
  )),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  data            JSONB DEFAULT '{}',
  read            BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(recipient_id, read) WHERE read = false;

-- RLS: push_tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own push tokens" ON public.push_tokens;
CREATE POLICY "Users can view own push tokens" ON public.push_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.push_tokens;
CREATE POLICY "Users can insert own push tokens" ON public.push_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.push_tokens;
CREATE POLICY "Users can delete own push tokens" ON public.push_tokens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own push tokens" ON public.push_tokens;
CREATE POLICY "Users can update own push tokens" ON public.push_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- RLS: notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications" ON public.notifications FOR INSERT TO service_role
  WITH CHECK (true);

-- FILE: 009_notification_triggers.sql

-- Migration: 009_notification_triggers
-- Database triggers that create in-app notifications AND send push notifications
-- via pg_net → Expo Push API when relevant events occur.

-- Enable pg_net for HTTP requests (pre-installed on Supabase hosted)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;

-- ============================================================
-- Helper: send push notification via Expo Push API
-- Looks up all push tokens for a user and sends via pg_net.
-- Errors are caught so push failures never roll back the parent transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_push_notification(
  p_recipient_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'
) RETURNS void AS $$
DECLARE
  token_record RECORD;
  payload JSONB;
BEGIN
  FOR token_record IN
    SELECT token FROM public.push_tokens WHERE user_id = p_recipient_id
  LOOP
    BEGIN
      payload := jsonb_build_object(
        'to', token_record.token,
        'title', p_title,
        'body', p_body,
        'data', p_data,
        'sound', 'default',
        'badge', (SELECT COUNT(*)::int FROM public.notifications WHERE recipient_id = p_recipient_id AND read = false)
      );

      PERFORM net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Accept', 'application/json'
        ),
        body := payload
      );
    EXCEPTION WHEN OTHERS THEN
      -- Push failure must never block the parent transaction
      NULL;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Helper: create notification + send push
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_and_send_notification(
  p_recipient_id UUID,
  p_sender_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'
) RETURNS void AS $$
BEGIN
  -- Don't notify yourself
  IF p_recipient_id = p_sender_id THEN
    RETURN;
  END IF;

  -- Insert in-app notification
  INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, data)
  VALUES (p_recipient_id, p_sender_id, p_type, p_title, p_body, p_data);

  -- Send push notification
  PERFORM public.send_push_notification(p_recipient_id, p_title, p_body, p_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 1. FRIENDSHIPS: friend_request (INSERT pending) & friend_accepted (UPDATE)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_friendship_notification()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  recipient_id UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Only send if there is no existing unread friend_request from this sender
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE recipient_id = NEW.addressee_id
        AND sender_id = NEW.requester_id
        AND type = 'friend_request'
        AND read = false
    ) THEN
      SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.requester_id;
      sender_name := COALESCE(sender_name, 'Cineva');

      PERFORM public.create_and_send_notification(
        NEW.addressee_id,
        NEW.requester_id,
        'friend_request',
        'Cerere de prietenie',
        sender_name || ' vrea să fie prietenul tău.',
        jsonb_build_object('screen', '/(protected)/friends', 'friendshipId', NEW.id)
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.addressee_id;
    sender_name := COALESCE(sender_name, 'Cineva');

    PERFORM public.create_and_send_notification(
      NEW.requester_id,
      NEW.addressee_id,
      'friend_accepted',
      'Cerere acceptată',
      sender_name || ' a acceptat cererea ta de prietenie.',
      jsonb_build_object('screen', '/(protected)/friends', 'friendshipId', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_friendship_change ON public.friendships;
CREATE TRIGGER on_friendship_change
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_friendship_notification();

-- ============================================================
-- 2. EVENT_PARTICIPANTS: event_joined (INSERT)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_event_participant_notification()
RETURNS TRIGGER AS $$
DECLARE
  participant_name TEXT;
  event_record RECORD;
BEGIN
  SELECT full_name INTO participant_name FROM public.profiles WHERE id = NEW.user_id;
  participant_name := COALESCE(participant_name, 'Cineva');

  SELECT e.id, e.title, e.organizer_id, v.name AS venue_name
  INTO event_record
  FROM public.events e
  LEFT JOIN public.venues v ON v.id = e.venue_id
  WHERE e.id = NEW.event_id;

  IF event_record IS NOT NULL AND event_record.organizer_id IS NOT NULL THEN
    PERFORM public.create_and_send_notification(
      event_record.organizer_id,
      NEW.user_id,
      'event_joined',
      'Participant nou',
      participant_name || ' s-a înscris la "' || COALESCE(event_record.title, event_record.venue_name, 'eveniment') || '".',
      jsonb_build_object('screen', '/(tabs)/events', 'eventId', NEW.event_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_event_participant_join ON public.event_participants;
CREATE TRIGGER on_event_participant_join
  AFTER INSERT ON public.event_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_event_participant_notification();

-- ============================================================
-- 3. EVENTS: event_cancelled (UPDATE status to 'cancelled')
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_event_cancelled_notification()
RETURNS TRIGGER AS $$
DECLARE
  organizer_name TEXT;
  event_title TEXT;
  participant RECORD;
BEGIN
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    SELECT full_name INTO organizer_name FROM public.profiles WHERE id = NEW.organizer_id;
    organizer_name := COALESCE(organizer_name, 'Organizatorul');
    event_title := COALESCE(NEW.title, 'Eveniment');

    FOR participant IN
      SELECT user_id FROM public.event_participants WHERE event_id = NEW.id
    LOOP
      PERFORM public.create_and_send_notification(
        participant.user_id,
        NEW.organizer_id,
        'event_cancelled',
        'Eveniment anulat',
        '"' || event_title || '" a fost anulat de ' || organizer_name || '.',
        jsonb_build_object('screen', '/(tabs)/events', 'eventId', NEW.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_event_cancelled ON public.events;
CREATE TRIGGER on_event_cancelled
  AFTER UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_event_cancelled_notification();

-- ============================================================
-- 4. REVIEWS: review_on_venue (INSERT) — notify venue submitter
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_review_notification()
RETURNS TRIGGER AS $$
DECLARE
  reviewer_name TEXT;
  venue_record RECORD;
BEGIN
  SELECT name, submitted_by INTO venue_record FROM public.venues WHERE id = NEW.venue_id;

  IF venue_record IS NOT NULL AND venue_record.submitted_by IS NOT NULL THEN
    reviewer_name := COALESCE(NEW.reviewer_name, 'Cineva');

    PERFORM public.create_and_send_notification(
      venue_record.submitted_by,
      NEW.user_id,
      'review_on_venue',
      'Recenzie nouă',
      reviewer_name || ' a scris o recenzie la "' || COALESCE(venue_record.name, 'locație') || '" (' || NEW.rating || '★).',
      jsonb_build_object('screen', '/venue/' || NEW.venue_id, 'venueId', NEW.venue_id, 'reviewId', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_created ON public.reviews;
CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_review_notification();

-- ============================================================
-- 5. CHECKINS: checkin_nearby — notify friends checked in at same venue
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_checkin_notification()
RETURNS TRIGGER AS $$
DECLARE
  checkin_user_name TEXT;
  venue_name TEXT;
  friend RECORD;
BEGIN
  SELECT full_name INTO checkin_user_name FROM public.profiles WHERE id = NEW.user_id;
  checkin_user_name := COALESCE(checkin_user_name, 'Cineva');

  SELECT name INTO venue_name FROM public.venues WHERE id = NEW.venue_id;
  venue_name := COALESCE(venue_name, 'o locație');

  -- Notify accepted friends of this user
  FOR friend IN
    SELECT CASE
      WHEN requester_id = NEW.user_id THEN addressee_id
      ELSE requester_id
    END AS friend_id
    FROM public.friendships
    WHERE status = 'accepted'
      AND (requester_id = NEW.user_id OR addressee_id = NEW.user_id)
  LOOP
    PERFORM public.create_and_send_notification(
      friend.friend_id,
      NEW.user_id,
      'checkin_nearby',
      'Check-in prieten',
      checkin_user_name || ' a făcut check-in la "' || venue_name || '".',
      jsonb_build_object('screen', '/venue/' || NEW.venue_id, 'venueId', NEW.venue_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_checkin_created ON public.checkins;
CREATE TRIGGER on_checkin_created
  AFTER INSERT ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_checkin_notification();

-- ============================================================
-- 6. Enable Supabase Realtime on notifications table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- FILE: 010_migrate_old_data.sql

-- Migration: 010_migrate_old_data
-- Creates missing indexes, then copies data from *_old tables into new tables.
-- Old tables are preserved.

-- ============================================================
-- 0. FIX INDEXES (old indexes block new ones with same name)
-- ============================================================
DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename LIKE '%_old'
      AND indexname NOT LIKE '%_old'
  LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I', idx.indexname, idx.indexname || '_old');
    RAISE NOTICE 'Renamed index % → %_old', idx.indexname, idx.indexname;
  END LOOP;
END $$;

-- Recreate indexes on new tables
CREATE INDEX IF NOT EXISTS idx_venues_city ON public.venues(city);
CREATE INDEX IF NOT EXISTS idx_venues_type ON public.venues(type);
CREATE INDEX IF NOT EXISTS idx_venues_approved ON public.venues(approved);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_name_city ON public.venues(name, city);
CREATE INDEX IF NOT EXISTS idx_reviews_venue ON public.reviews(venue_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id);

-- ============================================================
-- 1. CITIES (cities_old → cities)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cities_old') THEN
    INSERT INTO public.cities (name, county, lat, lng, zoom, active, venue_count)
    SELECT name, county, lat, lng, zoom,
           COALESCE(active, true),
           COALESCE(venue_count, 0)
    FROM public.cities_old
    ON CONFLICT (name) DO NOTHING;
    RAISE NOTICE 'Migrated cities data';
  END IF;
END $$;

-- ============================================================
-- 2. VENUES (venues_old → venues)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venues_old') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues_old' AND column_name = 'verificat') THEN
      INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, submitted_by, photos, created_at)
      SELECT name, type, city, county, sector, address, lat, lng,
             tables_count, condition, hours, description, tags,
             COALESCE(free_access, true),
             COALESCE(night_lighting, false),
             COALESCE(nets, false),
             COALESCE(verificat, false),
             tariff, website,
             COALESCE(approved, true),
             submitted_by, photos, created_at
      FROM public.venues_old
      WHERE city IS NOT NULL AND address IS NOT NULL
      ON CONFLICT (name, city) DO NOTHING;
    ELSE
      INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, submitted_by, photos, created_at)
      SELECT name, type, city, county, sector, address, lat, lng,
             tables_count, condition, hours, description, tags,
             COALESCE(free_access, true),
             COALESCE(night_lighting, false),
             COALESCE(nets, false),
             COALESCE(verified, false),
             tariff, website,
             COALESCE(approved, true),
             submitted_by, photos, created_at
      FROM public.venues_old
      WHERE city IS NOT NULL AND address IS NOT NULL
      ON CONFLICT (name, city) DO NOTHING;
    END IF;
    RAISE NOTICE 'Migrated venues data';
  END IF;
END $$;

-- ============================================================
-- 3. REVIEWS (reviews_old → reviews)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews_old') THEN
    INSERT INTO public.reviews (venue_id, user_id, reviewer_name, rating, body, created_at)
    SELECT v_new.id, r_old.user_id, r_old.reviewer_name, r_old.rating, r_old.body, r_old.created_at
    FROM public.reviews_old r_old
    JOIN public.venues_old v_old ON v_old.id = r_old.venue_id
    JOIN public.venues v_new ON v_new.name = v_old.name AND v_new.city = v_old.city;
    RAISE NOTICE 'Migrated reviews data';
  END IF;
END $$;

-- ============================================================
-- 4. FRIENDSHIPS (friendships_old → friendships)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'friendships_old') THEN
    INSERT INTO public.friendships (requester_id, addressee_id, status, created_at)
    SELECT requester_id, addressee_id, status, created_at
    FROM public.friendships_old
    ON CONFLICT (requester_id, addressee_id) DO NOTHING;
    RAISE NOTICE 'Migrated friendships data';
  END IF;
END $$;

-- ============================================================
-- 5. UPDATE CITY VENUE COUNTS
-- ============================================================
UPDATE public.cities SET venue_count = (
  SELECT COUNT(*) FROM public.venues WHERE venues.city = cities.name AND venues.approved = true
);

-- ============================================================
-- 6. REFRESH MATERIALIZED VIEWS
-- ============================================================
REFRESH MATERIALIZED VIEW public.venue_stats;
REFRESH MATERIALIZED VIEW public.leaderboard_checkins;
REFRESH MATERIALIZED VIEW public.leaderboard_reviews;
REFRESH MATERIALIZED VIEW public.leaderboard_venues;

-- FILE: 011_fix_fk_references.sql

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

-- FILE: 012_event_reminders_and_checkin_toggle.sql

-- Migration: 012_event_reminders_and_checkin_toggle
-- 1. Scheduled function to send event reminders 24h before start
-- 2. Profile toggle for checkin notifications

-- ============================================================
-- 1. EVENT REMINDERS
-- Creates a function that finds events starting in the next 24h
-- and sends reminders to participants who haven't been reminded.
-- Should be called via pg_cron or Supabase Edge Function on a schedule.
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_event_reminders()
RETURNS void AS $$
DECLARE
  event_record RECORD;
  participant RECORD;
  event_title TEXT;
  time_str TEXT;
BEGIN
  FOR event_record IN
    SELECT e.id, e.title, e.starts_at, v.name AS venue_name
    FROM public.events e
    LEFT JOIN public.venues v ON v.id = e.venue_id
    WHERE e.status IN ('open', 'confirmed')
      AND e.starts_at > NOW()
      AND e.starts_at <= NOW() + INTERVAL '24 hours'
  LOOP
    event_title := COALESCE(event_record.title, event_record.venue_name, 'Eveniment');
    time_str := to_char(event_record.starts_at AT TIME ZONE 'Europe/Bucharest', 'HH24:MI');

    FOR participant IN
      SELECT ep.user_id
      FROM public.event_participants ep
      WHERE ep.event_id = event_record.id
        -- Skip if already reminded for this event
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.recipient_id = ep.user_id
            AND n.type = 'event_reminder'
            AND n.data->>'event_id' = event_record.id::text
        )
    LOOP
      BEGIN
        INSERT INTO public.notifications (recipient_id, sender_id, type, title, body, data)
        VALUES (
          participant.user_id,
          NULL,
          'event_reminder',
          'Eveniment mâine',
          '"' || event_title || '" începe mâine la ' || time_str || '.',
          jsonb_build_object('screen', '/(tabs)/events', 'event_id', event_record.id)
        );

        PERFORM public.send_push_notification(
          participant.user_id,
          'Eveniment mâine',
          '"' || event_title || '" începe mâine la ' || time_str || '.',
          jsonb_build_object('screen', '/(tabs)/events', 'event_id', event_record.id)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL; -- Don't fail the whole batch
      END;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable pg_cron if available (Supabase hosted has it pre-installed)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available — event reminders must be triggered externally';
END $$;

-- Schedule: run every hour to catch events starting in the next 24h
-- (only works on Supabase hosted where pg_cron is available)
DO $$
BEGIN
  PERFORM cron.schedule(
    'send-event-reminders',
    '0 * * * *',  -- every hour
    'SELECT public.send_event_reminders()'
  );
  RAISE NOTICE 'Scheduled event reminders cron job';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule cron — pg_cron not available';
END $$;

-- ============================================================
-- 2. CHECKIN NOTIFICATION TOGGLE
-- Add a profile preference to opt out of friend checkin notifications
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_friend_checkins BOOLEAN NOT NULL DEFAULT true;

-- Update the checkin trigger to respect this preference
CREATE OR REPLACE FUNCTION public.trigger_checkin_notification()
RETURNS TRIGGER AS $$
DECLARE
  checkin_user_name TEXT;
  venue_name TEXT;
  friend RECORD;
  friend_prefs BOOLEAN;
BEGIN
  SELECT full_name INTO checkin_user_name FROM public.profiles WHERE id = NEW.user_id;
  checkin_user_name := COALESCE(checkin_user_name, 'Cineva');

  SELECT name INTO venue_name FROM public.venues WHERE id = NEW.venue_id;
  venue_name := COALESCE(venue_name, 'o locație');

  -- Notify accepted friends who have checkin notifications enabled
  FOR friend IN
    SELECT CASE
      WHEN requester_id = NEW.user_id THEN addressee_id
      ELSE requester_id
    END AS friend_id
    FROM public.friendships
    WHERE status = 'accepted'
      AND (requester_id = NEW.user_id OR addressee_id = NEW.user_id)
  LOOP
    -- Check friend's notification preference
    SELECT notify_friend_checkins INTO friend_prefs
    FROM public.profiles WHERE id = friend.friend_id;

    IF COALESCE(friend_prefs, true) THEN
      PERFORM public.create_and_send_notification(
        friend.friend_id,
        NEW.user_id,
        'checkin_nearby',
        'Check-in prieten',
        checkin_user_name || ' a făcut check-in la "' || venue_name || '".',
        jsonb_build_object('screen', '/venue/' || NEW.venue_id, 'venueId', NEW.venue_id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FILE: 014_event_invites.sql

-- Migration: 014_event_invites
-- Add 'event_invite' notification type and RPC function for sending event invitations.

-- 1. Add 'event_invite' to the notifications type CHECK constraint
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request', 'friend_accepted',
    'event_reminder', 'event_joined', 'event_cancelled',
    'event_invite',
    'checkin_nearby',
    'review_on_venue'
  ));

-- 2. RPC function: send event invitations to a list of friends
CREATE OR REPLACE FUNCTION public.send_event_invites(
  p_event_id INT,
  p_friend_ids UUID[]
) RETURNS void AS $$
DECLARE
  caller_id UUID := auth.uid();
  event_record RECORD;
  caller_name TEXT;
  friend_id UUID;
BEGIN
  -- Verify caller is the event organizer
  SELECT id, title, organizer_id
  INTO event_record
  FROM public.events
  WHERE id = p_event_id;

  IF event_record IS NULL OR event_record.organizer_id != caller_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT full_name INTO caller_name FROM public.profiles WHERE id = caller_id;
  caller_name := COALESCE(caller_name, 'Cineva');

  FOREACH friend_id IN ARRAY p_friend_ids
  LOOP
    -- Only invite accepted friends
    IF EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND ((requester_id = caller_id AND addressee_id = friend_id)
          OR (requester_id = friend_id AND addressee_id = caller_id))
    ) THEN
      -- Skip if already invited (unread notification for same event)
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE recipient_id = friend_id
          AND type = 'event_invite'
          AND (data->>'eventId')::int = p_event_id
          AND read = false
      ) THEN
        PERFORM public.create_and_send_notification(
          friend_id,
          caller_id,
          'event_invite',
          'Invitație la eveniment',
          caller_name || ' te-a invitat la "' || COALESCE(event_record.title, 'eveniment') || '".',
          jsonb_build_object('screen', '/(tabs)/events', 'eventId', p_event_id)
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FILE: 015_event_updates.sql

-- Migration: 015_event_updates
-- Add 'event_update' notification type and RPC function for organizer announcements.

-- 1. Add 'event_update' to the notifications type CHECK constraint
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request', 'friend_accepted',
    'event_reminder', 'event_joined', 'event_cancelled',
    'event_invite', 'event_update',
    'checkin_nearby',
    'review_on_venue'
  ));

-- 2. RPC function: send an update to all event participants
CREATE OR REPLACE FUNCTION public.send_event_update(
  p_event_id INT,
  p_message TEXT
) RETURNS void AS $$
DECLARE
  caller_id UUID := auth.uid();
  event_record RECORD;
  caller_name TEXT;
  participant RECORD;
BEGIN
  -- Verify caller is the event organizer
  SELECT id, title, organizer_id
  INTO event_record
  FROM public.events
  WHERE id = p_event_id;

  IF event_record IS NULL OR event_record.organizer_id != caller_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT full_name INTO caller_name FROM public.profiles WHERE id = caller_id;
  caller_name := COALESCE(caller_name, 'Cineva');

  -- Notify every participant (except the organizer)
  FOR participant IN
    SELECT user_id FROM public.event_participants WHERE event_id = p_event_id
  LOOP
    PERFORM public.create_and_send_notification(
      participant.user_id,
      caller_id,
      'event_update',
      'Actualizare eveniment',
      caller_name || ' · "' || COALESCE(event_record.title, 'eveniment') || '": ' || p_message,
      jsonb_build_object('screen', '/(tabs)/events', 'eventId', p_event_id)
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FILE: 016_recurring_events.sql

-- Migration: 016_recurring_events
-- Add recurrence support to events: columns, cron function for auto-generation.

-- 1. New columns on events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT
    CHECK (recurrence_rule IN ('daily', 'weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS recurrence_day INT,
  ADD COLUMN IF NOT EXISTS parent_event_id INT REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_recurrence ON public.events(recurrence_rule)
  WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_parent ON public.events(parent_event_id)
  WHERE parent_event_id IS NOT NULL;

-- 2. Cron function: generate next instance for each recurring series
CREATE OR REPLACE FUNCTION public.generate_recurring_events()
RETURNS void AS $$
DECLARE
  rec RECORD;
  next_start TIMESTAMPTZ;
  next_end TIMESTAMPTZ;
  duration INTERVAL;
  root_id INT;
  new_event_id INT;
BEGIN
  FOR rec IN
    WITH latest_per_series AS (
      SELECT DISTINCT ON (COALESCE(parent_event_id, id))
        *
      FROM public.events
      WHERE recurrence_rule IS NOT NULL
        AND status NOT IN ('cancelled')
      ORDER BY COALESCE(parent_event_id, id), starts_at DESC
    )
    SELECT * FROM latest_per_series
    WHERE starts_at < NOW()
      AND NOT EXISTS (
        SELECT 1 FROM public.events e2
        WHERE e2.starts_at > NOW()
          AND e2.status != 'cancelled'
          AND (
            e2.parent_event_id = COALESCE(latest_per_series.parent_event_id, latest_per_series.id)
            OR (e2.id = COALESCE(latest_per_series.parent_event_id, latest_per_series.id)
                AND e2.recurrence_rule IS NOT NULL)
          )
      )
  LOOP
    duration := COALESCE(rec.ends_at - rec.starts_at, INTERVAL '0');
    root_id := COALESCE(rec.parent_event_id, rec.id);

    -- Advance starts_at until it is in the future
    next_start := rec.starts_at;
    LOOP
      CASE rec.recurrence_rule
        WHEN 'daily'   THEN next_start := next_start + INTERVAL '1 day';
        WHEN 'weekly'  THEN next_start := next_start + INTERVAL '7 days';
        WHEN 'monthly' THEN next_start := next_start + INTERVAL '1 month';
      END CASE;
      EXIT WHEN next_start > NOW();
    END LOOP;

    next_end := CASE
      WHEN rec.ends_at IS NOT NULL THEN next_start + duration
      ELSE NULL
    END;

    INSERT INTO public.events (
      title, description, venue_id, table_number, organizer_id,
      starts_at, ends_at, max_participants, status, event_type,
      recurrence_rule, recurrence_day, parent_event_id
    ) VALUES (
      rec.title, rec.description, rec.venue_id, rec.table_number, rec.organizer_id,
      next_start, next_end, rec.max_participants, 'open', rec.event_type,
      rec.recurrence_rule, rec.recurrence_day, root_id
    )
    RETURNING id INTO new_event_id;

    -- Auto-join the organizer
    INSERT INTO public.event_participants (event_id, user_id)
    VALUES (new_event_id, rec.organizer_id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule with pg_cron (hourly at :15, offset from reminders at :00)
DO $$
BEGIN
  PERFORM cron.schedule(
    'generate-recurring-events',
    '15 * * * *',
    'SELECT public.generate_recurring_events()'
  );
  RAISE NOTICE 'Scheduled recurring events cron job';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule cron -- pg_cron not available';
END $$;

-- FILE: 017_events_default_unlimited.sql

-- Migration: 017_events_default_unlimited
-- Change max_participants default from 6 to NULL (unlimited by default).

ALTER TABLE public.events ALTER COLUMN max_participants SET DEFAULT NULL;
