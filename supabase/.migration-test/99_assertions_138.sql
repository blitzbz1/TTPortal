-- Assertions for 138_venues_map_delta (Stage 3 map-load), prod-parity container.
-- Run after replay_prod_parity.sh:
--   docker exec -i tt_prodsim psql -U postgres < 99_assertions_138.sql
DO $$
DECLARE
  v_result  JSONB;
  v_upserts JSONB;
  v_elem    JSONB;
  v_keys    TEXT[];
  v_prev    BIGINT := 0;
  v_id      BIGINT;
  v_sig     CONSTANT TEXT := 'public.get_venues_map_delta(timestamp with time zone, text, text, integer)';
BEGIN
  -- (1) function exists with the 4-arg signature + grants to authenticated/anon
  IF to_regprocedure(v_sig) IS NULL THEN
    RAISE EXCEPTION 'FAIL: get_venues_map_delta(TIMESTAMPTZ,TEXT,TEXT,INTEGER) missing';
  END IF;
  IF NOT has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated lacks EXECUTE on get_venues_map_delta';
  END IF;
  IF NOT has_function_privilege('anon', v_sig, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon lacks EXECUTE on get_venues_map_delta';
  END IF;

  -- Seed an isolated test city (venues.city_id FKs to cities) with 3 approved
  -- venues inserted OUT of id order (to prove ORDER BY id) + 1 unapproved (must
  -- surface as a tombstone, not an upsert).
  DELETE FROM public.venues WHERE city = 'ZZMapDeltaTest';
  DELETE FROM public.cities WHERE id = 999001;
  INSERT INTO public.cities (id, name, lat, lng, zoom) VALUES (999001, 'ZZMapDeltaTest', 44.0, 26.0, 11);
  INSERT INTO public.venues
    (id, name, type, city, city_id, address, lat, lng, tables_count, condition, free_access, night_lighting, nets, verified, approved)
  VALUES
    (900003, 'Gamma', 'parc_exterior', 'ZZMapDeltaTest', 999001, 'Addr G', 44.1, 26.1, 2, 'buna',         true,  false, true,  false, true),
    (900001, 'Alpha', 'sala_indoor',   'ZZMapDeltaTest', 999001, 'Addr A', 44.2, 26.2, 4, 'profesionala', false, true,  true,  true,  true),
    (900002, 'Beta',  'parc_exterior', 'ZZMapDeltaTest', 999001, 'Addr B', 44.3, 26.3, 0, 'acceptabila',  true,  false, false, false, true),
    (900004, 'Delta', 'parc_exterior', 'ZZMapDeltaTest', 999001, 'Addr D', 44.4, 26.4, 1, 'buna',         true,  false, false, false, false);

  v_result := public.get_venues_map_delta(NULL, NULL, NULL, 999001);

  -- (2) envelope shape
  IF jsonb_typeof(v_result->'upserts') <> 'array' THEN
    RAISE EXCEPTION 'FAIL: upserts is not an array';
  END IF;
  IF jsonb_typeof(v_result->'tombstone_ids') <> 'array' THEN
    RAISE EXCEPTION 'FAIL: tombstone_ids is not an array';
  END IF;
  IF (v_result->>'synced_at') IS NULL THEN
    RAISE EXCEPTION 'FAIL: synced_at missing';
  END IF;

  v_upserts := v_result->'upserts';
  IF jsonb_array_length(v_upserts) <> 3 THEN
    RAISE EXCEPTION 'FAIL: expected 3 approved upserts, got %', jsonb_array_length(v_upserts);
  END IF;

  -- (3) each element is an object carrying EXACTLY the 12 kept keys, and NONE of
  --     the 5 dropped keys (locks DO-NOT #6/#7).
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_upserts) LOOP
    IF jsonb_typeof(v_elem) <> 'object' THEN
      RAISE EXCEPTION 'FAIL: upsert element is not an object';
    END IF;
    IF (v_elem ? 'city') OR (v_elem ? 'city_id') OR (v_elem ? 'approved')
       OR (v_elem ? 'updated_at') OR (v_elem ? 'created_at') THEN
      RAISE EXCEPTION 'FAIL: a dropped key is present in %', v_elem;
    END IF;
    SELECT array_agg(k ORDER BY k) INTO v_keys FROM jsonb_object_keys(v_elem) AS k;
    IF v_keys <> ARRAY['address','condition','free_access','id','lat','lng',
                       'name','nets','night_lighting','tables_count','type','verified'] THEN
      RAISE EXCEPTION 'FAIL: unexpected key set %', v_keys;
    END IF;
  END LOOP;

  -- (4) ids strictly ascending (deterministic ORDER BY id, locks DO-NOT #8)
  FOR v_id IN SELECT (e->>'id')::bigint FROM jsonb_array_elements(v_upserts) AS e LOOP
    IF v_id <= v_prev THEN
      RAISE EXCEPTION 'FAIL: upsert ids not strictly ascending (% after %)', v_id, v_prev;
    END IF;
    v_prev := v_id;
  END LOOP;

  -- unapproved venue surfaces as a tombstone, not an upsert
  IF NOT (v_result->'tombstone_ids' @> '900004'::jsonb) THEN
    RAISE EXCEPTION 'FAIL: unapproved venue 900004 not in tombstone_ids';
  END IF;

  -- (5) get_venues_delta is UNCHANGED — still present and still 17-key rows.
  IF to_regprocedure('public.get_venues_delta(timestamp with time zone, text, text, integer)') IS NULL THEN
    RAISE EXCEPTION 'FAIL: get_venues_delta regressed (missing)';
  END IF;
  v_result := public.get_venues_delta(NULL, NULL, NULL, 999001);
  v_elem := (v_result->'upserts')->0;
  IF NOT ((v_elem ? 'city') AND (v_elem ? 'city_id') AND (v_elem ? 'approved')
          AND (v_elem ? 'updated_at') AND (v_elem ? 'created_at')) THEN
    RAISE EXCEPTION 'FAIL: get_venues_delta no longer returns the full 17-key row';
  END IF;

  DELETE FROM public.venues WHERE city = 'ZZMapDeltaTest';
  DELETE FROM public.cities WHERE id = 999001;
  RAISE NOTICE 'PASS: 138 assertions';
END $$;

SELECT 'ALL 138 ASSERTIONS PASSED' AS result;
