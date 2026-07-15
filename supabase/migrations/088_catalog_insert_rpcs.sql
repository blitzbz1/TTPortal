-- Migration: 088_catalog_insert_rpcs
-- Validated find_or_create RPCs for the shared location catalog.
--
-- 034/069 let any authenticated user INSERT arbitrary rows into cities/
-- countries — the catalog that delta-syncs to every client. Replace the
-- open policies with SECURITY DEFINER RPCs that normalize, validate, and
-- dedupe ("Wien"/"wien" → one row). Direct INSERT becomes admin-only.
--
-- Bonus fix: the client's existing "repair" UPDATE on matched cities
-- (country_name/coords/active backfill) has been a silent no-op for
-- non-admins all along — cities never had an UPDATE policy, and PostgREST
-- updates that match 0 rows under RLS do not error. The repair now runs
-- inside the DEFINER RPC, where it actually works.
--
-- Client lands alongside: src/services/cities.ts#upsertCity becomes a
-- single find_or_create_city call.

CREATE EXTENSION IF NOT EXISTS unaccent;  -- already created by 073; idempotent

-- ----------------------------------------------------------------------
-- Countries
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.find_or_create_country(
  p_code text,
  p_name text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text := upper(trim(coalesce(p_code, '')));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_code !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'invalid_country_code:%', v_code;
  END IF;

  INSERT INTO public.countries (code, name, active)
  VALUES (v_code, coalesce(v_name, v_code), true)
  ON CONFLICT (code) DO NOTHING;

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_country(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_country(text, text) TO authenticated;

-- ----------------------------------------------------------------------
-- Cities
-- ----------------------------------------------------------------------

-- Rate-limit the creation path so the catalog can't be flooded.
INSERT INTO public.rate_limit_config (action, scope, window_secs, max_attempts, description) VALUES
  ('add_city', 'user',   600,  5, '5 new catalog cities per 10 minutes'),
  ('add_city', 'user', 86400, 20, '20 new catalog cities per 24 hours')
ON CONFLICT DO NOTHING;

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
    RAISE EXCEPTION 'invalid_city_name';
  END IF;

  v_code := public.find_or_create_country(p_country_code, v_country_name);

  -- Diacritic/case-insensitive dedupe: "Wien" / "wien" / "Wíen" → one row.
  SELECT * INTO v_existing
  FROM public.cities c
  WHERE c.country_code = v_code
    AND lower(unaccent(c.name)) = lower(unaccent(v_name))
  ORDER BY (c.name = v_name) DESC, c.id
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    -- Repair pass (mirrors the legacy client logic, but actually effective).
    UPDATE public.cities SET
      country_name = CASE WHEN v_country_name IS NOT NULL AND country_name IS DISTINCT FROM v_country_name
                          THEN v_country_name ELSE country_name END,
      lat  = CASE WHEN v_has_center AND (lat  IS NULL OR abs(lat  - p_lat) > 0.000001) THEN p_lat  ELSE lat  END,
      lng  = CASE WHEN v_has_center AND (lng  IS NULL OR abs(lng  - p_lng) > 0.000001) THEN p_lng  ELSE lng  END,
      zoom = CASE WHEN v_has_center THEN coalesce(p_zoom, zoom, 12) ELSE zoom END,
      active = true,
      expansion_status = CASE WHEN expansion_status IS NULL OR expansion_status = 'hidden'
                              THEN 'active' ELSE expansion_status END
    WHERE id = v_existing.id;
    RETURN v_existing.id;
  END IF;

  IF NOT v_has_center THEN
    RAISE EXCEPTION 'city_map_center_required';
  END IF;

  PERFORM public.enforce_rate_limit('add_city');

  INSERT INTO public.cities (name, country_code, country_name, lat, lng, zoom, active, expansion_status)
  VALUES (v_name, v_code, coalesce(v_country_name, v_code), p_lat, p_lng, coalesce(p_zoom, 12), true, 'active')
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- Raced or the legacy UNIQUE(name) matched a same-named city in another
    -- country — return the existing row rather than erroring.
    SELECT id INTO v_id FROM public.cities
    WHERE lower(unaccent(name)) = lower(unaccent(v_name))
    ORDER BY (country_code = v_code) DESC, id
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_city(text, text, text, double precision, double precision, int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_city(text, text, text, double precision, double precision, int)
  TO authenticated;

-- ----------------------------------------------------------------------
-- Close the open INSERT policies; direct writes become admin-only
-- ----------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can insert cities" ON public.cities;
DROP POLICY IF EXISTS "Authenticated users can insert countries" ON public.countries;
DROP POLICY IF EXISTS "Admins can insert cities" ON public.cities;
DROP POLICY IF EXISTS "Admins can insert countries" ON public.countries;

CREATE POLICY "Admins can insert cities" ON public.cities
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can insert countries" ON public.countries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());

NOTIFY pgrst, 'reload schema';
