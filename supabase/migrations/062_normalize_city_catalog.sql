-- Normalize city catalog entries that were split by spelling variants.
-- The active city list should contain Piatra Neamț once and exclude Cârcea.

DO $$
DECLARE
  v_piatra_id INTEGER;
  v_county TEXT;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_zoom INTEGER;
BEGIN
  SELECT c.county, c.lat, c.lng, c.zoom
  INTO v_county, v_lat, v_lng, v_zoom
  FROM public.cities c
  WHERE c.name IN ('Piatra Neamt', 'Piatra-Neamt', 'Piatra Neamț', 'Piatra-Neamț')
  ORDER BY CASE c.name
    WHEN 'Piatra Neamț' THEN 0
    WHEN 'Piatra Neamt' THEN 1
    WHEN 'Piatra-Neamț' THEN 2
    ELSE 3
  END
  LIMIT 1;

  -- Originally written when cities.name was UNIQUE on its own. Migration
  -- 066 changed that to UNIQUE (country_code, name), so this INSERT now
  -- needs country_code set + the conflict target widened.
  INSERT INTO public.cities (name, county, lat, lng, zoom, venue_count, active, country_code)
  VALUES (
    'Piatra Neamț',
    COALESCE(v_county, 'Neamț'),
    COALESCE(v_lat, 46.9296),
    COALESCE(v_lng, 26.3770),
    COALESCE(v_zoom, 13),
    0,
    true,
    'RO'
  )
  ON CONFLICT (country_code, name) DO UPDATE
  SET county = COALESCE(public.cities.county, EXCLUDED.county),
      lat = COALESCE(public.cities.lat, EXCLUDED.lat),
      lng = COALESCE(public.cities.lng, EXCLUDED.lng),
      zoom = COALESCE(public.cities.zoom, EXCLUDED.zoom),
      active = true,
      updated_at = now()
  RETURNING id INTO v_piatra_id;

  UPDATE public.venues v
  SET city = 'Piatra Neamț',
      city_id = v_piatra_id
  WHERE v.city IN ('Piatra Neamt', 'Piatra-Neamt', 'Piatra Neamț', 'Piatra-Neamț')
     OR v.id = 240
     OR v.city_id IN (
       SELECT c.id
       FROM public.cities c
       WHERE c.name IN ('Piatra Neamt', 'Piatra-Neamt', 'Piatra Neamț', 'Piatra-Neamț')
     );

  UPDATE public.cities c
  SET active = false,
      updated_at = now()
  WHERE c.id <> v_piatra_id
    AND c.name IN ('Piatra Neamt', 'Piatra-Neamt', 'Piatra-Neamț');

  UPDATE public.cities c
  SET active = false,
      updated_at = now()
  WHERE c.name IN ('Carcea', 'Cârcea', 'Cîrcea');

  UPDATE public.cities c
  SET venue_count = (
        SELECT COUNT(*)
        FROM public.venues v
        WHERE v.city_id = c.id
          AND v.approved = true
      ),
      updated_at = now()
  WHERE c.id = v_piatra_id
     OR c.name IN (
       'Piatra Neamt',
       'Piatra-Neamt',
       'Piatra-Neamț',
       'Carcea',
       'Cârcea',
       'Cîrcea'
     );
END $$;
