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
  submitted_by UUID REFERENCES auth.users(id),
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
  ended_at TIMESTAMPTZ,
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
