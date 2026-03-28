-- ============================================================
-- TTPortal — Full Migration Script for Supabase SQL Editor
-- Old tables are preserved as *_old.
-- ============================================================

-- FILE: 000_pre_migration_rename.sql

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
-- Seed cities and sample venues for development.

-- Cities
INSERT INTO public.cities (name, county, lat, lng, zoom, venue_count, active) VALUES
  ('București', 'București', 44.4268, 26.1025, 12, 54, true),
  ('Cluj-Napoca', 'Cluj', 46.7712, 23.6236, 13, 28, true),
  ('Timișoara', 'Timiș', 45.7489, 21.2087, 13, 19, true),
  ('Iași', 'Iași', 47.1585, 27.6014, 13, 15, true),
  ('Brașov', 'Brașov', 45.6427, 25.5887, 13, 12, true),
  ('Constanța', 'Constanța', 44.1598, 28.6348, 13, 10, true),
  ('Craiova', 'Dolj', 44.3302, 23.7949, 13, 8, true),
  ('Oradea', 'Bihor', 47.0465, 21.9189, 13, 6, true)
ON CONFLICT (name) DO NOTHING;

-- Sample venues in București
INSERT INTO public.venues (name, type, city, county, address, lat, lng, tables_count, condition, free_access, night_lighting, nets, verified, approved) VALUES
  ('Parcul Național', 'parc_exterior', 'București', 'București', 'Bd. Ferdinand nr. 1', 44.4350, 26.1120, 4, 'buna', true, false, true, true, true),
  ('Sala Sporturilor Titan', 'sala_indoor', 'București', 'București', 'Bd. Liviu Rebreanu nr. 2', 44.4180, 26.1510, 8, 'profesionala', false, true, true, true, true),
  ('Parcul IOR', 'parc_exterior', 'București', 'București', 'Bd. Camil Ressu', 44.4145, 26.1370, 2, 'acceptabila', true, false, false, false, true),
  ('Parcul Herăstrău', 'parc_exterior', 'București', 'București', 'Aleea Privighetorilor', 44.4740, 26.0780, 6, 'buna', true, true, true, true, true),
  ('Club Sportiv Dinamo', 'sala_indoor', 'București', 'București', 'Șos. Ștefan cel Mare nr. 7-9', 44.4530, 26.1160, 16, 'profesionala', false, true, true, true, true)
ON CONFLICT (name, city) DO NOTHING;

-- Update city venue count
UPDATE public.cities SET venue_count = (
  SELECT COUNT(*) FROM public.venues WHERE venues.city = cities.name AND venues.approved = true
);

-- FILE: 007_cloud_venues_sync.sql

-- Migration: 007_cloud_venues_sync
-- Synced 52 venues from cloud Supabase (deduplicated).
-- Original cloud had 119 total entries.

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Automatica', 'parc_exterior', 'București', 'Ilfov', 'Sector 2', 'Str. Fabrica de Glucoză, Sector 2, București', 44.4735, 26.1165, 2, 'acceptabila', 'Acces liber', 'Parc de cartier în zona Floreasca / Colentina.', ARRAY['gratuit', 'exterior', 'sport'], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Bazilescu', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', 'Str. Bazilescu, Sector 1, București', 44.4812, 25.9978, 2, 'acceptabila', 'Acces liber', 'Parc de cartier în zona nord-vest a Bucureștiului.', ARRAY['gratuit', 'exterior'], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Tei', 'parc_exterior', 'București', 'Ilfov', 'Sector 2', 'Șos. Ștefan cel Mare / Str. Dobrogeanu Gherea, Sector 2', 44.4612, 26.1338, 3, 'acceptabila', 'Acces liber', 'Parc cu lac în Sectorul 2, popular pentru activități sportive.', ARRAY['gratuit', 'exterior', 'lac'], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Ping Poc', 'sala_indoor', 'București', 'Ilfov', 'Sector 4', 'Șos. Berceni nr. 104, bl. turn, et. 3, Sector 4', 44.3942, 26.1025, 5, 'profesionala', 'Zilnic 09:00–23:00', 'Nou deschis 2024. Separeu privat + spațiu comun. Concursuri săptămânale.', ARRAY['plată', 'indoor', 'separeu', 'rezervare online', 'Donic Waldner'], false, true, NULL, true, '25 lei/oră (comun) / 35 lei/oră (separeu)', 'https://pingpoc.ro', true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('CS Otilia Badescu – Sala Polivalentă', 'sala_indoor', 'București', 'Ilfov', 'Sector 4', 'Calea Piscului nr. 10, incinta Sala Polivalentă, Sector 4', 44.3982, 26.1008, NULL, 'profesionala', 'L-V 17:30–22:00, weekend 09:00–15:00', 'Sala campioanei Otilia Badescu, multiplu medaliată european și mondial.', ARRAY['plată', 'indoor', 'antrenori', 'robot', 'Donic'], false, true, NULL, true, '35 lei/oră (robot: 50 lei/oră)', 'https://www.facebook.com/profile.php?id=61563913030853', true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Ioanid', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', 'Str. Orlando / Bd. Dacia, Sector 1, București', 44.4513, 26.0849, 2, 'acceptabila', 'Acces liber', 'Parc mic, elegant, în zona rezidențială Sector 1.', ARRAY['gratuit', 'exterior'], true, false, false, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Drumul Taberei (Moghioroș)', 'parc_exterior', 'București', 'Ilfov', 'Sector 6', 'Bd. Timișoara / Str. Brașov, Sector 6, București', 44.420917, 26.029722, 6, 'buna', 'Acces liber', 'Parc mare din Sectorul 6, facilități sportive multiple.', ARRAY['gratuit', 'exterior'], true, false, true, true, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Sfânta Cristina', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', 'Strada Siret 95, 012244 București', 44.463694, 26.062222, 1, 'buna', 'Acces liber', NULL, ARRAY['gratuit', 'exterior'], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Râul Colentina', 'parc_exterior', 'București', 'Ilfov', 'Sector 2', 'Zona râului Colentina, Sector 2, București', 44.454278, 26.1495, 4, 'buna', 'Acces liber', '4 mese cu fileuri', ARRAY['gratuit', 'exterior', 'mal râu'], true, false, true, true, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Regina Maria', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', 'Str. Turda 117, 011322 București', 44.457833, 26.0665, 2, 'acceptabila', 'Acces liber', 'Spațiu verde urban cu loc de joacă, fântâni și bănci, plus teren de baschet și două parcuri pentru câini.', ARRAY['gratuit', 'exterior', 'loc joacă'], true, false, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Florilor', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', '26.1697544.4440280', 44.444028, 26.16975, 3, 'acceptabila', 'Acces liber', 'Pantelimon / Delfinului', ARRAY['gratuit', 'exterior'], true, true, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Ferentari', 'parc_exterior', 'București', 'Ilfov', 'Sector 5', 'Calea Ferentari, Sector 5, București', 44.41127, 26.07502, 2, 'deteriorata', 'Acces liber', 'Parc de cartier Sector 5. Starea dotărilor variabilă.', ARRAY['gratuit', 'exterior', 'deteriorat'], true, false, false, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Ping Pong Academy', 'sala_indoor', 'București', 'Ilfov', 'Sector 5', 'Strada Haţegana 17, 052034 București', 44.407917, 26.093917, 12, 'profesionala', 'Luni–Duminică (verificați pagina)', 'Club complet cu antrenori, echipă Divizia A, concursuri interne.', ARRAY['plată', 'indoor', 'antrenori', 'Divizia A', 'concursuri'], false, true, true, true, '33–43 lei/oră', 'https://www.facebook.com/clubsportivpingpongacademy', true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Liniei', 'parc_exterior', 'București', 'Ilfov', 'Sector 6', 'Str. Lujerului, București', 44.431417, 26.0375, 4, 'buna', 'Acces liber', 'Parc liniar pe fosta linie de tramvai.', ARRAY['gratuit', 'exterior', 'liniar'], true, false, true, true, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Miniparcul Dumitru Teodoru – Viilor', 'parc_exterior', 'București', 'Ilfov', 'Sector 5', 'Calea Viilor / Str. Dumitru Teodoru, Sector 5', 44.41682, 26.08435, 1, 'necunoscuta', 'Acces liber', 'Minispaciu verde de cartier. Dotări minime – necesită verificare.', ARRAY['gratuit', 'exterior', 'mic'], true, false, false, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('PingPro', 'sala_indoor', 'București', 'Ilfov', 'Sector 1', 'Str. Copilului nr. 20A, Domenii, Sector 1, București', 44.46497, 26.0604, NULL, 'profesionala', 'D-J 08:30–22:30, V-S 08:30–23:30', 'Deschis 2025. Rezervare online cu alegere masă. Sistem reluări instant.', ARRAY['plată', 'indoor', 'rezervare online', 'sistem reluări', 'Joola'], false, true, false, true, 'variabil (promoții disponibile)', 'https://www.pingpro.ro', true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Kiseleff', 'parc_exterior', 'București', 'Ilfov', 'Sector 1', 'Șos. Kiseleff, Sector 1, București', 44.455833, 26.084417, 3, 'acceptabila', 'Acces liber', 'Parc central-nord, parte din axa verde a capitalei.', ARRAY['gratuit', 'exterior'], true, true, true, false, NULL, NULL, true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Pridvorului', 'parc_exterior', 'București', 'Ilfov', 'Sector 2', 'Strada Pridvorului, Sector 2, București', 44.462, 26.105, 5, 'buna', 'Acces liber', 'Unele mese la umbra copacilor — plăcut vara. Confirmat pe pingpongmap.net.', ARRAY['gratuit', 'exterior', 'umbră', 'vară'], true, false, true, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('CS Stirom – Tenis de Masă', 'sala_indoor', 'București', 'Ilfov', 'Sector 3', 'Bulevardul Theodor Pallady nr. 45, Sector 3, București', 44.419, 26.168, 5, 'profesionala', 'Zilnic de la ora 09:00 (verificați)', 'Sală dedicată exclusiv tenisului de masă, incinta fabricii Stirom. Club cu tradiție, antrenori cu experiență, foști campioni naționali. Cursuri inițiere, perfecționare și performanță. Tel: 0723.306.531', ARRAY['plată', 'indoor', 'antrenori', 'Sector 3', 'tradiție'], false, false, NULL, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Baza Sportivă Str. Vișagului – S3', 'parc_exterior', 'București', 'Ilfov', 'Sector 3', 'Strada Vișagului, Sector 3, București', 44.428, 26.152, 2, 'buna', 'Acces liber – rezervare gratuită pe sport3.primarie3.ro', 'Bază sportivă multifuncțională Primăria Sector 3. Mese TM, fotbal, baschet. Rezervare online gratuită.', ARRAY['gratuit', 'exterior', 'Sector 3', 'rezervare online', 'multifuncțional'], true, false, true, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Baza Sportivă Bd. Unirii Esplanada – S3', 'parc_exterior', 'București', 'Ilfov', 'Sector 3', 'Bulevardul Unirii, Zona Esplanada, Sector 3, București', 44.426, 26.11, 2, 'buna', 'Acces liber – rezervare gratuită pe sport3.primarie3.ro', 'Bază sportivă Primăria Sector 3. Central, lângă Bd. Unirii. Rezervare online gratuită.', ARRAY['gratuit', 'exterior', 'Sector 3', 'rezervare online', 'central'], true, false, true, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Baza Sportivă Str. Drumeagului – S3', 'parc_exterior', 'București', 'Ilfov', 'Sector 3', 'Strada Drumeagului, Sector 3, București', 44.415, 26.16, 2, 'buna', 'Acces liber – rezervare gratuită pe sport3.primarie3.ro', 'Bază sportivă multifuncțională Primăria Sector 3. Rezervare online gratuită.', ARRAY['gratuit', 'exterior', 'Sector 3', 'rezervare online'], true, false, true, true, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Tenis Mac Gym', 'sala_indoor', 'București', 'Ilfov', 'Sector 4', 'Calea Văcărești nr. 391, incinta sala Elite Performance, Sun Plaza, Sector 4, București', 44.384, 26.087, 6, 'profesionala', 'L-V 09:00–22:00, S 08:00–22:00, D 08:00–14:00', '6 mese de închiriat + 8 pentru competiții. Echipa CS TTT București Divizia A.', ARRAY['plată', 'indoor', 'antrenori', 'concursuri', 'Andro', 'Divizia A'], false, true, NULL, true, '30 lei/oră (zi) / 35 lei/oră (weekend seara)', 'https://www.tenis-masa.ro', true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Viva Sport Club – Tenis de Masă', 'sala_indoor', 'București', 'Ilfov', 'Sector 4', 'Șos. Oltenitei nr. 103, Sector 4, București', 44.3805, 26.1045, NULL, 'profesionala', 'Verificați site-ul oficial', 'Card de membru obligatoriu (10 lei). ~30 min înregistrare la prima vizită.', ARRAY['plată', 'indoor', 'card membru', 'Piața Sudului'], false, true, NULL, true, '40 lei/oră', 'https://www.vivasportclub.ro', true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Izvor', 'parc_exterior', 'București', 'Ilfov', 'Sector 5', 'Splaiul Independenței, Parcul Izvor, Sector 5, București', 44.432833, 26.088472, 4, 'deteriorata', 'Acces liber', 'Parc central, lângă Palatul Parlamentului.', ARRAY['gratuit', 'exterior', 'central', 'Izvor'], true, false, false, false, NULL, NULL, true, '2026-03-19T09:01:08.396875+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('PingPro Domenii Park', 'sala_indoor', 'București', 'Ilfov', '—', 'Str. Copilului nr. 20A, Sector 1', 44.4647599, 26.061214, NULL, 'profesionala', 'Verificați', 'Adăugat de comunitate.', ARRAY['nou adăugat'], false, true, false, true, 'Dinamic', NULL, true, '2026-03-19T08:52:51.669195+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Ping Pong Miramar', 'sala_indoor', 'București', 'Ilfov', 'Sector 2', 'Bulevardul Chișinău 6, 022152 București', 44.441139, 26.156472, 5, 'profesionala', 'Verificați pagina Facebook', '5 mese omologate ITTF, blat 25mm. Atmosferă relaxată cu muzică și bar.', ARRAY['plată', 'indoor', 'ITTF', 'muzică', 'bar'], false, true, false, true, 'verificați pagina Facebook', 'https://www.facebook.com/PingPongSector2/', true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('TSP Vibe', 'sala_indoor', 'București', 'Ilfov', 'Sector 3', 'Șos. Dudești-Pantelimon nr. 44, incinta Antilopa, Sector 3', 44.4386302876457, 26.1943227239488, 9, 'profesionala', 'Verificați pagina Facebook', '540 mp, PVC. Concursuri luni/marți/miercuri de la 18:30. Robot disponibil.', ARRAY['plată', 'indoor', 'robot', 'concursuri', '540mp'], false, true, true, true, '25 lei/oră (L-V 10–16) / 35 lei/oră (vârf)', 'https://www.facebook.com/groups/3146582045558341/', true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('IDM Club – Tenis de Masă', 'sala_indoor', 'București', 'Ilfov', 'Sector 6', 'Splaiul Independenței nr. 319B, Sector 6, București', 44.443972, 26.048833, 10, 'profesionala', 'L-J 09:00–01:00, V-S 09:00–03:00, D 09:00–01:00', NULL, ARRAY['plată', 'indoor', 'bowling', 'biliard', 'piscină', 'fitness', 'Butterfly'], false, true, true, true, 'verificați site-ul (card 150 lei/an)', 'https://www.idmclub.ro', true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('eWe Ping Pong', 'sala_indoor', 'București', 'Ilfov', 'Ilfov', 'Str. Fortului nr. 81, Domnești, Ilfov (incinta eWe Market)', 44.361, 25.992, 7, 'profesionala', 'Zilnic 09:00–22:00', 'Deschis ianuarie 2024. Recomandat pentru Militari/Ghencea/Rahova. Cafenea inclusă.', ARRAY['plată', 'indoor', 'Ilfov', 'cafenea', 'Joola 25', 'ITTF'], false, true, NULL, true, '35 lei/oră (fix)', 'https://ewepingpong.ro', true, '2026-03-19T08:31:09.257296+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Kiris Hall', 'sala_indoor', 'București', 'Ilfov', 'Sector 2', 'Șos. Pantelimon 1-3, 021591 București', 44.4481742, 26.1333387, 8, 'profesionala', '09:00-00:00', 'Adăugat de comunitate.', ARRAY['nou adăugat'], false, true, false, true, '20 lei pe ora de luni pana vineri, 09:00-14:00, 40 lei ora in weekend si de luni pana vineri dupa ora 14', NULL, true, '2026-03-19T10:43:11.601905+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Cosmos', 'parc_exterior', 'București', 'Ilfov', 'Sector 3', 'Parcul Cosmos, Șos. Pantelimon 367, București', 44.441111, 26.184972, 2, 'buna', '7-22', 'Adăugat de comunitate.', ARRAY['nou adăugat'], true, false, true, false, NULL, NULL, true, '2026-03-20T06:48:15.854584+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Drumul Taberei 2 (Moghioroș)', 'parc_exterior', 'București', 'Ilfov', '6', '44.421667	26.030750', 44.4216990634355, 26.030747294426, 3, 'buna', '7-22', 'Adăugat de comunitate.', ARRAY['nou adăugat'], true, false, false, false, NULL, NULL, true, '2026-03-20T06:58:05.077063+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Cetatea Histria', 'parc_exterior', 'București', 'Ilfov', NULL, 'Strada Cetatea Histria,nr. 16-20, București', 44.4200457, 26.0227148, 2, 'necunoscuta', 'Verificați', 'Adăugat de comunitate.', ARRAY['nou adăugat'], true, false, true, false, NULL, NULL, true, '2026-03-21T07:04:29.585658+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul Timisoara', 'parc_exterior', 'București', 'Ilfov', '6', 'Bulevardul Timișoara 10, 061344 București', 44.4286713, 26.0441141, 4, 'necunoscuta', 'Verificați', 'Adăugat de comunitate.', ARRAY['nou adăugat'], true, false, NULL, false, NULL, NULL, true, '2026-03-21T07:13:41.640781+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Parcul “C5”', 'parc_exterior', 'București', 'Ilfov', NULL, 'Aleea Bistra 1, 061344 București', 44.42624, 26.0488, 1, 'necunoscuta', 'Verificați', 'Adăugat de comunitate.', ARRAY['nou adăugat'], true, false, false, false, NULL, NULL, true, '2026-03-21T07:16:20.691683+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Sală de tenis de masă Set 11', 'sala_indoor', 'Sibiu', 'Sibiu', NULL, 'Strada August Treboniu Laurian, 2-4', 45.8016044, 24.1668087, NULL, 'profesionala', NULL, NULL, ARRAY['osm', 'way/95993443'], false, false, NULL, false, '35 RON', 'https://www.b-52.ro/', true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

-- Removed 4 venues with NULL city/address (Sală tenis de masă, CS Top Team Tulcea, Table tennis Ioanid park, Ping Pong Table)

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Masă tenis de masă', 'parc_exterior', 'Agăș', 'Bacău', NULL, 'Strada Principală, 116', 46.4846352, 26.2203157, NULL, 'necunoscuta', NULL, NULL, ARRAY['osm', 'acoperit', 'way/1308638798'], true, false, NULL, false, NULL, NULL, true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('CS Otilia Bădescu', 'sala_indoor', 'București', 'Ilfov', NULL, 'Calea Piscului, 10', 44.4053795, 26.1109869, NULL, 'profesionala', 'Mo-Fr 17:30-22:00; Sa-Su 09:00-15:00', 'Sala jucătoarei campioane Otilia Bădescu, mese Donic albastre profesionale. Incinta Sălii Polivalente lângă Parcul Tineretului.', ARRAY['osm', 'custom/5'], false, false, NULL, false, '35 RON/oră', NULL, true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('PingPoc', 'sala_indoor', 'București', 'Ilfov', NULL, 'Șoseaua Berceni, 104', 44.3679305, 26.1428287, 5, 'profesionala', 'Mo-Su 09:00-23:00', '5 mese Donic Waldner profesionale (2 în separeu privat), deschis 2024. Față de metrou Dimitrie Leonida. Bloc Turn, Et. 3.', ARRAY['osm', 'custom/8'], false, false, NULL, false, '25-35 RON/oră', 'https://www.facebook.com/pingpoc.ro', true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Kiris Hall – Tenis de Masă', 'sala_indoor', 'București', 'Ilfov', NULL, 'Șos. Pantelimon, 1-3', 44.4487461, 26.1346999, NULL, 'profesionala', 'Mo-Fr 09:00-23:00; Sa-Su 09:00-23:30', 'Academie gimnastică și tenis de masă (Academia Larisa Iordache). Mese profesionale, antrenori certificați. Rezervare online disponibilă.', ARRAY['osm', 'custom/9'], false, false, NULL, false, NULL, 'https://kiris-hall.ro/', true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Rocket Spin', 'sala_indoor', 'Timișoara', 'Timiș', NULL, 'Calea Aradului, 48A', 45.777013, 21.2213122, NULL, 'profesionala', 'Mo-Su 10:00-22:00', 'Cea mai profesională sală din Timișoara. Mese Butterfly Octet 25 (ITTF), 3 camere VIP, robot Butterfly, antrenori. Rezervare prealabilă.', ARRAY['osm', 'custom/10'], false, false, NULL, false, NULL, 'https://www.rocketspintenisdemasa.com/', true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Baza Sportivă Gheorgheni – Tenis de Masă', 'sala_indoor', 'Cluj-Napoca', 'Cluj', NULL, 'Strada Marechal Constantin Prezan', 46.7700626, 23.6360361, 8, 'profesionala', 'Mo-Fr 09:00-22:00; Sa-Su 10:00-22:00', '8 mese tenis de masă gratuite, rezervare prealabilă online necesară, echipament propriu. Complex sportiv public al Primăriei Cluj-Napoca.', ARRAY['osm', 'custom/11'], true, false, NULL, false, NULL, 'https://sportinclujnapoca.ro/', true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Baza Sportivă «La Terenuri» – Tenis de Masă', 'sala_indoor', 'Cluj-Napoca', 'Cluj', NULL, 'Strada Pârâng, FN', 46.7489241, 23.55459, 8, 'profesionala', 'Mo-Fr 09:00-22:00; Sa-Su 10:00-22:00', '8 mese tenis de masă, rezervare online, echipament propriu (palete + mingi). Bază publică, acces gratuit. Cartier Mănăștur.', ARRAY['osm', 'custom/12'], true, false, NULL, false, NULL, 'https://manastur.sportinclujnapoca.ro/', true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('ARENA Brasov – Tenis de Masă', 'sala_indoor', 'Săcele', 'Brașov', NULL, 'Strada Gospodarilor, 2', 45.616955, 25.6675707, 8, 'profesionala', 'Mo-Th 13:00-22:00; Fr 13:00-17:00', '8 mese Joola 2000-S (ITTF), podea Taraflex, iluminat LED profesional, vestiare cu dușuri, parcare privată. Centura ocolitoare Săcele.', ARRAY['osm', 'custom/13'], false, false, NULL, false, NULL, 'https://arena-brasov.ro/', true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('ACS TT Energy Brașov', 'sala_indoor', 'Brașov', 'Brașov', NULL, 'Strada Zizinului, 106', 45.6473296, 25.6417153, NULL, 'profesionala', 'Mo-Fr 15:00-21:00', 'Club de tenis de masă, cursuri inițiere și perfecționare copii, Liceul Energetic Brașov.', ARRAY['osm', 'custom/14'], false, false, NULL, false, NULL, NULL, true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Top Spin – Tenis de Masă Craiova', 'sala_indoor', 'Craiova', 'Dolj', NULL, 'Strada Grigore Gabrielescu, 1A', 44.3334005, 23.7788649, 3, 'profesionala', 'Mo-Su 10:00-21:00', '3 mese Andro Competition profesionale, podea Taraflex sportivă. Antrenamente și inchiriere.', ARRAY['osm', 'custom/15'], false, false, NULL, false, NULL, 'https://topspincraiova.com/', true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

INSERT INTO public.venues (name, type, city, county, sector, address, lat, lng, tables_count, condition, hours, description, tags, free_access, night_lighting, nets, verified, tariff, website, approved, created_at)
VALUES ('Complexul Sportiv Flux Arena – Tenis de Masă', 'sala_indoor', 'Cârcă', 'Dolj', NULL, 'Strada Complexului, 6A', 44.2986365, 23.8999204, NULL, 'profesionala', 'Mo-Su 08:00-03:00', 'Complex sportiv cu mese de tenis de masă, terenuri tenis, fotbal. Rezervare telefonică. Sat Cârcă, lângă Craiova.', ARRAY['osm', 'custom/16'], false, false, NULL, false, NULL, 'https://www.fluxarena.net/', true, '2026-03-21T09:10:23.997809+00:00')
ON CONFLICT (name, city) DO NOTHING;

-- Update city venue counts
UPDATE public.cities SET venue_count = (
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
-- Copies data from renamed *_old tables into the new tables.
-- Uses ON CONFLICT to avoid duplicates. Old tables are preserved.

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
-- Map column name differences: verificat → verified
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venues_old') THEN
    -- Check if old table has 'verificat' or 'verified'
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
    -- Map old venue IDs to new venue IDs via name+city match
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
