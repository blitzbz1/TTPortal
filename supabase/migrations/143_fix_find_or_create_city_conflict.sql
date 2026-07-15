-- Fix new-city creation after migration 063 changed city uniqueness from
-- UNIQUE(name) to UNIQUE(country_code, name). Migration 088 retained the old
-- ON CONFLICT (name) target, causing every genuinely new city to fail with
-- SQLSTATE 42P10 before a venue could be submitted.

CREATE OR REPLACE FUNCTION public.find_or_create_city(
  p_name text,
  p_country_code text,
  p_country_name text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_zoom int DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_code text;
  v_country_name text := nullif(trim(coalesce(p_country_name, '')), '');
  v_existing public.cities;
  v_id int;
  v_has_center boolean :=
    p_lat IS NOT NULL AND p_lng IS NOT NULL
    AND p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid_city_name' USING ERRCODE = '22023';
  END IF;

  v_code := public.find_or_create_country(p_country_code, v_country_name);

  -- Serialize normalized creates for the same country/name. The catalog's
  -- physical unique index is case-sensitive, while app-level dedupe is not.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_code || ':' || lower(unaccent(v_name)), 0)
  );

  SELECT * INTO v_existing
  FROM public.cities c
  WHERE c.country_code = v_code
    AND lower(unaccent(c.name)) = lower(unaccent(v_name))
  ORDER BY (c.name = v_name) DESC, c.id
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.cities SET
      country_name = CASE
        WHEN v_country_name IS NOT NULL AND country_name IS DISTINCT FROM v_country_name
          THEN v_country_name ELSE country_name END,
      lat = CASE
        WHEN v_has_center AND (lat IS NULL OR abs(lat - p_lat) > 0.000001)
          THEN p_lat ELSE lat END,
      lng = CASE
        WHEN v_has_center AND (lng IS NULL OR abs(lng - p_lng) > 0.000001)
          THEN p_lng ELSE lng END,
      zoom = CASE WHEN v_has_center THEN coalesce(p_zoom, zoom, 12) ELSE zoom END,
      active = true,
      expansion_status = CASE
        WHEN expansion_status IS NULL OR expansion_status = 'hidden'
          THEN 'active' ELSE expansion_status END
    WHERE id = v_existing.id;
    RETURN v_existing.id;
  END IF;

  IF NOT v_has_center THEN
    RAISE EXCEPTION 'city_map_center_required' USING ERRCODE = '22023';
  END IF;

  PERFORM public.enforce_rate_limit('add_city');

  INSERT INTO public.cities
    (name, country_code, country_name, lat, lng, zoom, active, expansion_status)
  VALUES
    (v_name, v_code, coalesce(v_country_name, v_code), p_lat, p_lng,
     coalesce(p_zoom, 12), true, 'active')
  ON CONFLICT (country_code, name) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.cities
    WHERE country_code = v_code
      AND lower(unaccent(name)) = lower(unaccent(v_name))
    ORDER BY (name = v_name) DESC, id
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'city_upsert_failed' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_city(text, text, text, double precision, double precision, int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_city(text, text, text, double precision, double precision, int)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
