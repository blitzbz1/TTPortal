-- Delta-sync support for venues.
--
-- Goal: device keeps a persistent local copy of the venue list and only
-- fetches what changed since its last sync. Backend ships at most a
-- handful of rows per check, regardless of total catalogue size.
--
-- Three pieces:
--   1. updated_at column + trigger so we know when each row last changed.
--   2. venue_tombstones table populated by an ON DELETE trigger so the
--      client can purge rows the server no longer has.
--   3. get_venues_delta(p_since, p_city, p_type) RPC returning a single
--      JSONB blob:
--         { upserts:[...], tombstone_ids:[...], synced_at:'...' }
--      Cold sync (p_since IS NULL) returns the full set; subsequent calls
--      pass the previously returned synced_at and get just the diff.

-- 1. updated_at on venues
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS venues_set_updated_at ON public.venues;
CREATE TRIGGER venues_set_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_venues_updated_at
  ON public.venues(updated_at);

-- 2. Tombstones for hard deletes. (Soft-deletes — approved=false — are
--    surfaced as tombstones in the RPC without needing a separate row.)
CREATE TABLE IF NOT EXISTS public.venue_tombstones (
  venue_id   INTEGER     PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_tombstones_deleted_at
  ON public.venue_tombstones(deleted_at);

CREATE OR REPLACE FUNCTION public.tg_record_venue_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.venue_tombstones(venue_id, deleted_at)
  VALUES (OLD.id, now())
  ON CONFLICT (venue_id) DO UPDATE SET deleted_at = EXCLUDED.deleted_at;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS venues_record_deletion ON public.venues;
CREATE TRIGGER venues_record_deletion
  BEFORE DELETE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.tg_record_venue_deletion();

-- Allow anon/authenticated to read tombstones (needed by the RPC's
-- SELECT, but the function is SECURITY DEFINER anyway).
ALTER TABLE public.venue_tombstones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS venue_tombstones_select ON public.venue_tombstones;
CREATE POLICY venue_tombstones_select ON public.venue_tombstones
  FOR SELECT USING (true);

-- 3. Delta RPC
CREATE OR REPLACE FUNCTION public.get_venues_delta(
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_city  TEXT        DEFAULT NULL,
  p_type  TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now        TIMESTAMPTZ := now();
  v_upserts    JSONB;
  v_tombstones JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY (v->>'updated_at') DESC), '[]'::jsonb)
  INTO v_upserts
  FROM (
    SELECT to_jsonb(rec) AS v
    FROM (
      SELECT id, name, type, city, address, lat, lng, tables_count, condition,
             free_access, night_lighting, nets, verified, approved,
             updated_at, created_at
      FROM public.venues
      WHERE approved = true
        AND (p_since IS NULL OR updated_at > p_since)
        AND (p_city  IS NULL OR city = p_city)
        AND (p_type  IS NULL OR type = p_type)
    ) rec
  ) src;

  -- Tombstones: hard-deleted rows (venue_tombstones) plus rows that
  -- became approved=false since p_since (treated as soft-delete).
  SELECT COALESCE(jsonb_agg(DISTINCT t.venue_id), '[]'::jsonb)
  INTO v_tombstones
  FROM (
    SELECT venue_id
    FROM public.venue_tombstones
    WHERE p_since IS NULL OR deleted_at > p_since
    UNION ALL
    SELECT id AS venue_id
    FROM public.venues
    WHERE approved = false
      AND (p_since IS NULL OR updated_at > p_since)
      AND (p_city  IS NULL OR city = p_city)
      AND (p_type  IS NULL OR type = p_type)
  ) t;

  RETURN jsonb_build_object(
    'upserts',        v_upserts,
    'tombstone_ids',  v_tombstones,
    'synced_at',      v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_venues_delta(TIMESTAMPTZ, TEXT, TEXT)
  TO authenticated, anon;
