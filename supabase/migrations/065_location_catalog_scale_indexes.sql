-- Scale location catalog reads for many countries and cities.
--
-- Target shape:
-- - 100+ active countries
-- - 40+ cities per country
-- - venue deltas scoped by stable city_id

CREATE INDEX IF NOT EXISTS idx_countries_active_name
  ON public.countries(active, name);

CREATE INDEX IF NOT EXISTS idx_countries_updated_at
  ON public.countries(updated_at);

CREATE INDEX IF NOT EXISTS idx_cities_country_active_status_name
  ON public.cities(country_code, active, expansion_status, name);

CREATE INDEX IF NOT EXISTS idx_cities_country_active_status_venue_count
  ON public.cities(country_code, active, expansion_status, venue_count DESC, name);

CREATE INDEX IF NOT EXISTS idx_cities_country_updated_at
  ON public.cities(country_code, updated_at);

CREATE INDEX IF NOT EXISTS idx_venues_city_id_approved_updated_at
  ON public.venues(city_id, approved, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_venues_city_id_type_approved_updated_at
  ON public.venues(city_id, type, approved, updated_at DESC);

CREATE OR REPLACE FUNCTION public.get_countries_delta(p_since TIMESTAMPTZ DEFAULT NULL)
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
  SELECT COALESCE(jsonb_agg(to_jsonb(rec) ORDER BY rec.name), '[]'::jsonb)
  INTO v_upserts
  FROM (
    SELECT
      c.code,
      c.name,
      c.active,
      c.updated_at,
      COUNT(ci.id)::integer AS city_count
    FROM public.countries c
    LEFT JOIN public.cities ci
      ON ci.country_code = c.code
     AND ci.active = true
     AND ci.expansion_status <> 'hidden'
    WHERE c.active = true
      AND (
        p_since IS NULL
        OR c.updated_at > p_since
        OR EXISTS (
          SELECT 1
          FROM public.cities changed_city
          WHERE changed_city.country_code = c.code
            AND changed_city.updated_at > p_since
        )
      )
    GROUP BY c.code, c.name, c.active, c.updated_at
  ) rec;

  SELECT COALESCE(jsonb_agg(c.code ORDER BY c.code), '[]'::jsonb)
  INTO v_tombstones
  FROM public.countries c
  WHERE c.active = false
    AND (p_since IS NULL OR c.updated_at > p_since);

  RETURN jsonb_build_object(
    'upserts',       v_upserts,
    'tombstone_ids', v_tombstones,
    'synced_at',     v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_countries_delta(TIMESTAMPTZ)
  TO authenticated, anon;
