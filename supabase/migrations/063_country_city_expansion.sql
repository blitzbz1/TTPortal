-- Prepare the location catalog for country + city expansion.
--
-- The app still keeps legacy Romania fields (`county`, `venues.city`,
-- `venues.county`, `venues.sector`) working, but city identity can now move
-- toward country-scoped rows and venue queries can use stable city ids.

CREATE TABLE IF NOT EXISTS public.countries (
  code       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

INSERT INTO public.countries (code, name, active)
VALUES ('RO', 'Romania', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    active = EXCLUDED.active,
    updated_at = now();

DROP TRIGGER IF EXISTS countries_set_updated_at ON public.countries;
CREATE TRIGGER countries_set_updated_at
  BEFORE UPDATE ON public.countries
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS countries_select ON public.countries;
CREATE POLICY countries_select ON public.countries
  FOR SELECT USING (true);

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS country_name TEXT,
  ADD COLUMN IF NOT EXISTS admin_area TEXT,
  ADD COLUMN IF NOT EXISTS local_area TEXT,
  ADD COLUMN IF NOT EXISTS expansion_status TEXT NOT NULL DEFAULT 'active';

UPDATE public.cities
SET
  country_code = COALESCE(country_code, 'RO'),
  country_name = COALESCE(country_name, 'Romania'),
  admin_area = COALESCE(admin_area, county),
  expansion_status = COALESCE(expansion_status, CASE WHEN active = false THEN 'hidden' ELSE 'active' END)
WHERE country_code IS NULL
   OR country_name IS NULL
   OR admin_area IS NULL
   OR expansion_status IS NULL;

ALTER TABLE public.cities
  ALTER COLUMN country_code SET DEFAULT 'RO',
  ALTER COLUMN country_code SET NOT NULL,
  ALTER COLUMN country_name SET DEFAULT 'Romania',
  ALTER COLUMN country_name SET NOT NULL;

ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_country_code_fkey;

ALTER TABLE public.cities
  ADD CONSTRAINT cities_country_code_fkey
  FOREIGN KEY (country_code) REFERENCES public.countries(code) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_expansion_status_check;

ALTER TABLE public.cities
  ADD CONSTRAINT cities_expansion_status_check CHECK (
    expansion_status IN (
      'active',
      'launch_ready',
      'community_review',
      'researching',
      'coming_soon',
      'hidden'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS cities_country_code_name_key
  ON public.cities(country_code, name);

ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_name_key;

ALTER TABLE public.cities
  DROP CONSTRAINT IF EXISTS cities_name_key1;

DROP INDEX IF EXISTS cities_name_key;
DROP INDEX IF EXISTS cities_name_key1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_name_city_id
  ON public.venues(name, city_id);

DROP INDEX IF EXISTS idx_venues_name_city;

CREATE OR REPLACE FUNCTION public.get_cities_delta(p_since TIMESTAMPTZ DEFAULT NULL)
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
  SELECT COALESCE(jsonb_agg(to_jsonb(rec)), '[]'::jsonb)
  INTO v_upserts
  FROM (
    SELECT
      id,
      name,
      county,
      country_code,
      country_name,
      admin_area,
      local_area,
      lat,
      lng,
      zoom,
      venue_count,
      active,
      expansion_status,
      updated_at
    FROM public.cities
    WHERE active = true
      AND expansion_status <> 'hidden'
      AND (p_since IS NULL OR updated_at > p_since)
  ) rec;

  SELECT COALESCE(jsonb_agg(DISTINCT t.city_id), '[]'::jsonb)
  INTO v_tombstones
  FROM (
    SELECT city_id FROM public.city_tombstones
    WHERE p_since IS NULL OR deleted_at > p_since
    UNION ALL
    SELECT id AS city_id FROM public.cities
    WHERE (active = false OR expansion_status = 'hidden')
      AND (p_since IS NULL OR updated_at > p_since)
  ) t;

  RETURN jsonb_build_object(
    'upserts',       v_upserts,
    'tombstone_ids', v_tombstones,
    'synced_at',     v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cities_delta(TIMESTAMPTZ) TO authenticated, anon;

DROP FUNCTION IF EXISTS public.get_venues_delta(TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_venues_delta(TIMESTAMPTZ, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_venues_delta(
  p_since   TIMESTAMPTZ DEFAULT NULL,
  p_city    TEXT        DEFAULT NULL,
  p_type    TEXT        DEFAULT NULL,
  p_city_id INTEGER     DEFAULT NULL
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
      SELECT
        id,
        name,
        type,
        city,
        city_id,
        address,
        lat,
        lng,
        tables_count,
        condition,
        free_access,
        night_lighting,
        nets,
        verified,
        approved,
        updated_at,
        created_at
      FROM public.venues
      WHERE approved = true
        AND (p_since IS NULL OR updated_at > p_since)
        AND (p_city_id IS NULL OR city_id = p_city_id)
        AND (p_city IS NULL OR city = p_city)
        AND (p_type IS NULL OR type = p_type)
    ) rec
  ) src;

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
      AND (p_city_id IS NULL OR city_id = p_city_id)
      AND (p_city IS NULL OR city = p_city)
      AND (p_type IS NULL OR type = p_type)
  ) t;

  RETURN jsonb_build_object(
    'upserts',        v_upserts,
    'tombstone_ids',  v_tombstones,
    'synced_at',      v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_venues_delta(TIMESTAMPTZ, TEXT, TEXT, INTEGER)
  TO authenticated, anon;
