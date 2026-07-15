-- Admin one-click import for reviewed OSM seed venues.
--
-- This lets the separate venue dashboard turn a local OSM seed draft into a
-- real Supabase venue row, then continue normal review/edit/show-in-app work.

CREATE OR REPLACE FUNCTION public.admin_import_osm_seed_venue(
  p_country_code TEXT,
  p_country_name TEXT,
  p_city_name TEXT,
  p_city_lat DOUBLE PRECISION DEFAULT NULL,
  p_city_lng DOUBLE PRECISION DEFAULT NULL,
  p_city_zoom INTEGER DEFAULT 12,
  p_venue JSONB DEFAULT '{}'::jsonb,
  p_show_in_app BOOLEAN DEFAULT false
)
RETURNS public.venues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city public.cities;
  v_venue public.venues;
  v_name TEXT;
  v_address TEXT;
  v_type TEXT;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_tables_count INTEGER;
  v_condition TEXT;
  v_review_status TEXT;
  v_duplicate_of_venue_id INTEGER;
  v_notes TEXT;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NULLIF(trim(COALESCE(p_country_code, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Country code is required';
  END IF;

  IF NULLIF(trim(COALESCE(p_city_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'City name is required';
  END IF;

  v_name := NULLIF(trim(COALESCE(p_venue->>'name', '')), '');
  v_address := NULLIF(trim(COALESCE(p_venue->>'address', '')), '');
  v_type := COALESCE(NULLIF(trim(COALESCE(p_venue->>'type', '')), ''), 'parc_exterior');
  v_lat := NULLIF(p_venue->>'lat', '')::DOUBLE PRECISION;
  v_lng := NULLIF(p_venue->>'lng', '')::DOUBLE PRECISION;
  v_tables_count := COALESCE(NULLIF(p_venue->>'tables_count', '')::INTEGER, 1);
  v_condition := COALESCE(NULLIF(trim(COALESCE(p_venue->>'condition', '')), ''), 'necunoscuta');
  v_review_status := COALESCE(
    NULLIF(trim(COALESCE(p_venue->>'review_status', '')), ''),
    CASE WHEN p_show_in_app THEN 'approved' ELSE 'pending' END
  );
  v_duplicate_of_venue_id := NULLIF(p_venue->>'duplicate_of_venue_id', '')::INTEGER;
  v_notes := NULLIF(trim(COALESCE(p_venue->>'admin_review_notes', '')), '');

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Venue name is required';
  END IF;

  IF v_address IS NULL THEN
    RAISE EXCEPTION 'Venue address is required';
  END IF;

  IF v_lat IS NULL OR v_lng IS NULL OR v_lat < -90 OR v_lat > 90 OR v_lng < -180 OR v_lng > 180 THEN
    RAISE EXCEPTION 'Valid venue coordinates are required';
  END IF;

  IF v_type NOT IN ('parc_exterior', 'sala_indoor') THEN
    RAISE EXCEPTION 'Invalid venue type: %', v_type;
  END IF;

  IF v_condition NOT IN ('buna', 'acceptabila', 'deteriorata', 'necunoscuta', 'profesionala') THEN
    RAISE EXCEPTION 'Invalid venue condition: %', v_condition;
  END IF;

  IF v_review_status NOT IN (
    'pending',
    'approved',
    'hidden',
    'needs_manual_pin',
    'duplicate_candidate',
    'rejected'
  ) THEN
    RAISE EXCEPTION 'Invalid review status: %', v_review_status;
  END IF;

  INSERT INTO public.countries (code, name, active)
  VALUES (upper(trim(p_country_code)), trim(COALESCE(NULLIF(p_country_name, ''), p_country_code)), true)
  ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      active = true,
      updated_at = now();

  INSERT INTO public.cities (
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
    expansion_status
  )
  VALUES (
    trim(p_city_name),
    NULLIF(trim(COALESCE(p_venue->>'county', '')), ''),
    upper(trim(p_country_code)),
    trim(COALESCE(NULLIF(p_country_name, ''), p_country_code)),
    NULLIF(trim(COALESCE(p_venue->>'county', '')), ''),
    NULL,
    COALESCE(p_city_lat, v_lat),
    COALESCE(p_city_lng, v_lng),
    COALESCE(p_city_zoom, 12),
    0,
    p_show_in_app,
    CASE WHEN p_show_in_app THEN 'active' ELSE 'community_review' END
  )
  ON CONFLICT (country_code, name) DO UPDATE
  SET country_name = EXCLUDED.country_name,
      county = COALESCE(public.cities.county, EXCLUDED.county),
      admin_area = COALESCE(public.cities.admin_area, EXCLUDED.admin_area),
      lat = COALESCE(public.cities.lat, EXCLUDED.lat),
      lng = COALESCE(public.cities.lng, EXCLUDED.lng),
      zoom = COALESCE(public.cities.zoom, EXCLUDED.zoom),
      active = CASE WHEN p_show_in_app THEN true ELSE public.cities.active END,
      expansion_status = CASE
        WHEN p_show_in_app THEN 'active'
        WHEN public.cities.expansion_status = 'hidden' THEN 'community_review'
        ELSE public.cities.expansion_status
      END,
      updated_at = now()
  RETURNING *
  INTO v_city;

  INSERT INTO public.venues (
    name,
    type,
    city,
    city_id,
    county,
    sector,
    address,
    lat,
    lng,
    tables_count,
    condition,
    hours,
    description,
    tags,
    photos,
    free_access,
    night_lighting,
    nets,
    verified,
    tariff,
    website,
    approved,
    submitted_by,
    review_status,
    duplicate_of_venue_id,
    needs_manual_pin,
    admin_review_notes,
    reviewed_at,
    reviewed_by
  )
  VALUES (
    v_name,
    v_type,
    COALESCE(NULLIF(trim(p_venue->>'city'), ''), v_city.name),
    v_city.id,
    NULLIF(trim(COALESCE(p_venue->>'county', '')), ''),
    NULLIF(trim(COALESCE(p_venue->>'sector', '')), ''),
    v_address,
    v_lat,
    v_lng,
    v_tables_count,
    v_condition,
    NULLIF(trim(COALESCE(p_venue->>'hours', '')), ''),
    NULLIF(trim(COALESCE(p_venue->>'description', '')), ''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_venue->'tags', '[]'::jsonb))), ARRAY[]::TEXT[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_venue->'photos', '[]'::jsonb))), ARRAY[]::TEXT[]),
    COALESCE(NULLIF(p_venue->>'free_access', '')::BOOLEAN, true),
    COALESCE(NULLIF(p_venue->>'night_lighting', '')::BOOLEAN, false),
    COALESCE(NULLIF(p_venue->>'nets', '')::BOOLEAN, true),
    COALESCE(NULLIF(p_venue->>'verified', '')::BOOLEAN, false),
    NULLIF(trim(COALESCE(p_venue->>'tariff', '')), ''),
    NULLIF(trim(COALESCE(p_venue->>'website', '')), ''),
    COALESCE(NULLIF(p_venue->>'approved', '')::BOOLEAN, p_show_in_app),
    auth.uid(),
    CASE WHEN p_show_in_app THEN 'approved' ELSE v_review_status END,
    CASE WHEN v_review_status = 'duplicate_candidate' THEN v_duplicate_of_venue_id ELSE NULL END,
    COALESCE(NULLIF(p_venue->>'needs_manual_pin', '')::BOOLEAN, false),
    v_notes,
    now(),
    auth.uid()
  )
  ON CONFLICT (name, city_id) DO UPDATE
  SET type = EXCLUDED.type,
      city = EXCLUDED.city,
      county = EXCLUDED.county,
      sector = EXCLUDED.sector,
      address = EXCLUDED.address,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      tables_count = EXCLUDED.tables_count,
      condition = EXCLUDED.condition,
      hours = EXCLUDED.hours,
      description = EXCLUDED.description,
      tags = EXCLUDED.tags,
      photos = EXCLUDED.photos,
      free_access = EXCLUDED.free_access,
      night_lighting = EXCLUDED.night_lighting,
      nets = EXCLUDED.nets,
      verified = EXCLUDED.verified,
      tariff = EXCLUDED.tariff,
      website = EXCLUDED.website,
      approved = EXCLUDED.approved,
      review_status = EXCLUDED.review_status,
      duplicate_of_venue_id = EXCLUDED.duplicate_of_venue_id,
      needs_manual_pin = EXCLUDED.needs_manual_pin,
      admin_review_notes = EXCLUDED.admin_review_notes,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  RETURNING *
  INTO v_venue;

  UPDATE public.cities c
  SET venue_count = (
        SELECT COUNT(*)::INTEGER
        FROM public.venues v
        WHERE v.city_id = v_city.id
          AND v.approved = true
      ),
      active = CASE WHEN p_show_in_app THEN true ELSE c.active END,
      expansion_status = CASE WHEN p_show_in_app THEN 'active' ELSE c.expansion_status END,
      updated_at = now()
  WHERE c.id = v_city.id;

  INSERT INTO public.venue_admin_audit(
    venue_id,
    admin_id,
    action,
    before_state,
    after_state,
    note
  )
  VALUES (
    v_venue.id,
    auth.uid(),
    'import_osm_seed_venue',
    NULL,
    to_jsonb(v_venue),
    v_notes
  );

  RETURN v_venue;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_import_osm_seed_venue(
  TEXT,
  TEXT,
  TEXT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  INTEGER,
  JSONB,
  BOOLEAN
) TO authenticated;

NOTIFY pgrst, 'reload schema';
