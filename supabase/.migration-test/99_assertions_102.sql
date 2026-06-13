-- Assertions for 102_postgis_geo_foundation.
DO $$
DECLARE
  v_count int;
  v_near int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE EXCEPTION 'FAIL: postgis not installed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='venues' AND column_name='geom') THEN
    RAISE EXCEPTION 'FAIL: venues.geom missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='venues_geom_gist') THEN
    RAISE EXCEPTION 'FAIL: GIST index missing';
  END IF;

  SELECT count(*) INTO v_count FROM public.venues WHERE geom IS NULL AND lat IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAIL: % venues with lat but NULL geom', v_count;
  END IF;

  -- Behavioral: a venue is findable near its own coordinates.
  PERFORM 1 FROM public.venues LIMIT 1;
  IF FOUND THEN
    SELECT count(*) INTO v_near
    FROM public.venues v,
         LATERAL public.get_venues_near(v.lat, v.lng, 100, 5) g
    WHERE v.approved = true AND g.id = v.id
    LIMIT 1;
    IF EXISTS (SELECT 1 FROM public.venues WHERE approved = true) AND v_near = 0 THEN
      RAISE EXCEPTION 'FAIL: get_venues_near does not find a venue at its own location';
    END IF;
  END IF;

  RAISE NOTICE 'PASS: 102 assertions';
END $$;
