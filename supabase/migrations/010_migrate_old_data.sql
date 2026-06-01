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
