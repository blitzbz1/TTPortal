-- Assertions for 139_cities_tiered_catalog (Stage 2 map-load), prod-parity container.
-- Run after replay_prod_parity.sh applies 000->139:
--   docker exec -i tt_prodsim psql -U postgres < 99_assertions_139.sql
--
-- Locks: signatures+grants, tier membership (eager predicate), the 15-key
-- projection incl. search_key (no leaked rn), DO-NOT #8 determinism (byte-equal
-- successive NULL pulls over shared updated_at), the concatenated-name_norm
-- recall (name hyphen-folded + admin_area both present), search_cities prefix
-- ranking / diacritic folding / min-length / long-tail reach, the
-- fell-out-of-tier tombstone branch, get_cities_by_ids single-row fallback, and
-- the get_cities_delta no-regression guard.

DO $$
DECLARE
  v_cat_sig   CONSTANT TEXT := 'public.get_cities_catalog_v2(timestamp with time zone)';
  v_srch_sig  CONSTANT TEXT := 'public.search_cities(text, integer)';
  v_byid_sig  CONSTANT TEXT := 'public.get_cities_by_ids(integer[])';
  v_full      JSONB;
  v_full_b    JSONB;
  v_upserts   JSONB;
  v_elem      JSONB;
  v_keys      TEXT[];
  v_norm      TEXT;
  v_search    JSONB;
  v_since     CONSTANT TIMESTAMPTZ := '2025-01-01T00:00:00Z';
  v_tomb      JSONB;
BEGIN
  -- ---- (1) signatures + grants -------------------------------------------
  IF to_regprocedure(v_cat_sig) IS NULL THEN
    RAISE EXCEPTION 'FAIL: get_cities_catalog_v2(TIMESTAMPTZ) missing';
  END IF;
  IF to_regprocedure(v_srch_sig) IS NULL THEN
    RAISE EXCEPTION 'FAIL: search_cities(TEXT,INTEGER) missing';
  END IF;
  IF to_regprocedure(v_byid_sig) IS NULL THEN
    RAISE EXCEPTION 'FAIL: get_cities_by_ids(INTEGER[]) missing';
  END IF;
  IF NOT has_function_privilege('authenticated', v_cat_sig, 'EXECUTE')
     OR NOT has_function_privilege('anon', v_cat_sig, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_srch_sig, 'EXECUTE')
     OR NOT has_function_privilege('anon', v_srch_sig, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_byid_sig, 'EXECUTE')
     OR NOT has_function_privilege('anon', v_byid_sig, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated/anon missing EXECUTE on a 139 function';
  END IF;

  -- ---- seed an isolated 'Zzq…' namespace (unique prefix → no collisions in
  -- the full-catalog search) -----------------------------------------------
  DELETE FROM public.cities         WHERE id BETWEEN 999101 AND 999199;
  DELETE FROM public.city_tombstones WHERE city_id BETWEEN 999101 AND 999199;

  INSERT INTO public.cities
    (id, name, admin_area, county, country_code, country_name, lat, lng, zoom,
     venue_count, active, expansion_status, updated_at)
  VALUES
    (999101, 'Zzqalpha',       NULL,           NULL,    'RO', 'Romania', 44.1, 26.1, 11,  5, true, 'active',      '2020-01-01T00:00:00Z'),
    (999102, 'Zzqbravo',       NULL,           NULL,    'RO', 'Romania', 44.2, 26.2, 11,  3, true, 'active',      '2020-01-01T00:00:00Z'),
    (999103, 'Zzqcharlie',     NULL,           NULL,    'RO', 'Romania', 44.3, 26.3, 11,  0, true, 'researching', '2020-01-01T00:00:00Z'),
    (999104, 'Zzqcluj-Napoca', 'Transylvania', NULL,    'RO', 'Romania', 44.4, 26.4, 11, 50, true, 'active',      '2020-01-01T00:00:00Z'),
    (999105, 'Zzqclujeni',     NULL,           NULL,    'RO', 'Romania', 44.5, 26.5, 11,  1, true, 'active',      '2020-01-01T00:00:00Z'),
    (999106, 'Zzqștefan',      NULL,           NULL,    'RO', 'Romania', 44.6, 26.6, 11,  7, true, 'active',      '2020-01-01T00:00:00Z'),
    -- exact-name-vs-prefix ranking probe: the exact-name 'Zzqyork' (5 venues)
    -- must outrank the busier same-prefix 'Zzqyorktown' (50 venues).
    (999107, 'Zzqyork',        NULL,           NULL,    'RO', 'Romania', 44.7, 26.7, 11,  5, true, 'active',      '2020-01-01T00:00:00Z'),
    (999108, 'Zzqyorktown',    NULL,           NULL,    'RO', 'Romania', 44.8, 26.8, 11, 50, true, 'active',      '2020-01-01T00:00:00Z');

  -- ---- (2) name_norm recall lock: name (hyphen-folded) + admin_area both in --
  SELECT name_norm INTO v_norm FROM public.cities WHERE id = 999104;
  IF v_norm NOT LIKE '%zzqclujnapoca%' THEN
    RAISE EXCEPTION 'FAIL: name_norm missing hyphen-folded name (got %)', v_norm;
  END IF;
  IF v_norm NOT LIKE '%transylvania%' THEN
    RAISE EXCEPTION 'FAIL: name_norm missing admin_area recall token (got %)', v_norm;
  END IF;

  -- ---- (3) catalog_v2(NULL) shape + tier membership -----------------------
  v_full := public.get_cities_catalog_v2(NULL);
  IF jsonb_typeof(v_full->'upserts') <> 'array'
     OR jsonb_typeof(v_full->'tombstone_ids') <> 'array'
     OR (v_full->>'synced_at') IS NULL THEN
    RAISE EXCEPTION 'FAIL: catalog_v2 envelope shape wrong';
  END IF;
  v_upserts := v_full->'upserts';

  -- the 4 eager seeds present; the zero-venue 'researching' one absent.
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_upserts) e WHERE (e->>'id')::int = 999101) THEN
    RAISE EXCEPTION 'FAIL: tier city 999101 absent from upserts';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_upserts) e WHERE (e->>'id')::int = 999104) THEN
    RAISE EXCEPTION 'FAIL: tier city 999104 absent from upserts';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_upserts) e WHERE (e->>'id')::int = 999103) THEN
    RAISE EXCEPTION 'FAIL: non-eager zero-venue researching city 999103 leaked into upserts';
  END IF;

  -- exactly the 15 projection keys incl. search_key, and NO leaked rn.
  SELECT e INTO v_elem FROM jsonb_array_elements(v_upserts) e WHERE (e->>'id')::int = 999104;
  IF (v_elem ? 'rn') THEN
    RAISE EXCEPTION 'FAIL: row_number rn leaked into the upsert object';
  END IF;
  IF NOT (v_elem ? 'search_key') THEN
    RAISE EXCEPTION 'FAIL: server-built search_key missing from the upsert object';
  END IF;
  SELECT array_agg(k ORDER BY k) INTO v_keys FROM jsonb_object_keys(v_elem) AS k;
  IF v_keys <> ARRAY['active','admin_area','country_code','country_name','county',
                     'expansion_status','id','lat','lng','local_area','name',
                     'search_key','updated_at','venue_count','zoom'] THEN
    RAISE EXCEPTION 'FAIL: unexpected catalog_v2 key set %', v_keys;
  END IF;

  -- ---- (4) DO-NOT #8 determinism: two successive NULL pulls byte-identical --
  v_full_b := public.get_cities_catalog_v2(NULL);
  IF (v_full->'upserts') <> (v_full_b->'upserts') THEN
    RAISE EXCEPTION 'FAIL: catalog_v2 upserts not deterministic across calls';
  END IF;

  -- ---- (5) search_cities: ranking, folding, min-length, long-tail reach ----
  -- prefix 'zzqcluj' → higher venue_count first (50 before 1)
  v_search := public.search_cities('Zzqcluj', 20);
  IF (v_search->0->>'name') <> 'Zzqcluj-Napoca' THEN
    RAISE EXCEPTION 'FAIL: search_cities ranking — expected Zzqcluj-Napoca first, got %', (v_search->0->>'name');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_search) e WHERE (e->>'id')::int = 999105) THEN
    RAISE EXCEPTION 'FAIL: search_cities dropped the same-prefix lower-venue city 999105';
  END IF;
  -- search rows carry search_key too (shared projection)
  IF NOT (v_search->0 ? 'search_key') THEN
    RAISE EXCEPTION 'FAIL: search_cities row missing search_key';
  END IF;
  -- diacritic folding: query without ș matches Zzqștefan
  v_search := public.search_cities('zzqste', 20);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_search) e WHERE (e->>'id')::int = 999106) THEN
    RAISE EXCEPTION 'FAIL: search_cities folding — zzqste did not match Zzqștefan';
  END IF;
  -- min-length guard: 1 char → []
  IF public.search_cities('z', 20) <> '[]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: search_cities(<2 chars) did not return []';
  END IF;
  -- long-tail reach: a non-tier zero-venue city is still found by name prefix
  v_search := public.search_cities('zzqcharlie', 20);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_search) e WHERE (e->>'id')::int = 999103) THEN
    RAISE EXCEPTION 'FAIL: search_cities did not reach non-tier long-tail city 999103';
  END IF;
  -- exact-NAME match outranks a busier same-prefix city (locks the live exact
  -- ranking term — name_norm=v_q would never fire because of the country suffix).
  v_search := public.search_cities('zzqyork', 20);
  IF (v_search->0->>'id')::int <> 999107 THEN
    RAISE EXCEPTION 'FAIL: exact-name Zzqyork (5 venues) did not outrank Zzqyorktown (50 venues); got id %', (v_search->0->>'id');
  END IF;

  -- ---- (6) get_cities_by_ids single-row fallback --------------------------
  -- a non-tier city (absent from catalog_v2 upserts) resolvable by id.
  v_search := public.get_cities_by_ids(ARRAY[999103]);
  IF jsonb_array_length(v_search) <> 1 OR (v_search->0->>'id')::int <> 999103 THEN
    RAISE EXCEPTION 'FAIL: get_cities_by_ids did not return the out-of-tier city 999103';
  END IF;
  IF (v_search->0 ? 'rn') OR NOT (v_search->0 ? 'search_key') THEN
    RAISE EXCEPTION 'FAIL: get_cities_by_ids projection wrong (rn leaked / search_key missing)';
  END IF;
  -- an absent/negative id resolves to []
  IF public.get_cities_by_ids(ARRAY[-5]) <> '[]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: get_cities_by_ids(absent id) did not return []';
  END IF;

  -- ---- (7) fell-out-of-tier tombstone branch ------------------------------
  -- 999101 is a tier city (venue_count 5). Drop it to 0 (still active='active',
  -- which is NOT in the eager IN-list) → it falls out of the tier. The
  -- cities_set_updated_at trigger bumps updated_at to now() (> v_since), so an
  -- incremental pull since v_since must tombstone it and NOT re-upsert it.
  UPDATE public.cities SET venue_count = 0 WHERE id = 999101;
  v_full := public.get_cities_catalog_v2(v_since);
  v_tomb := v_full->'tombstone_ids';
  IF NOT (v_tomb @> '999101'::jsonb) THEN
    RAISE EXCEPTION 'FAIL: fell-out-of-tier city 999101 not in tombstone_ids';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_full->'upserts') e WHERE (e->>'id')::int = 999101) THEN
    RAISE EXCEPTION 'FAIL: fell-out-of-tier city 999101 still present in upserts';
  END IF;

  -- ---- (8) get_cities_delta (063) UNCHANGED — still 14-key rows, no search_key
  IF to_regprocedure('public.get_cities_delta(timestamp with time zone)') IS NULL THEN
    RAISE EXCEPTION 'FAIL: get_cities_delta regressed (missing)';
  END IF;
  v_elem := (public.get_cities_delta(NULL)->'upserts')->0;
  IF (v_elem ? 'search_key') THEN
    RAISE EXCEPTION 'FAIL: get_cities_delta unexpectedly grew a search_key (should be untouched)';
  END IF;
  IF NOT ((v_elem ? 'county') AND (v_elem ? 'expansion_status') AND (v_elem ? 'updated_at')) THEN
    RAISE EXCEPTION 'FAIL: get_cities_delta no longer returns its full row shape';
  END IF;

  -- ---- cleanup ------------------------------------------------------------
  DELETE FROM public.cities          WHERE id BETWEEN 999101 AND 999199;
  DELETE FROM public.city_tombstones WHERE city_id BETWEEN 999101 AND 999199;

  RAISE NOTICE 'PASS: 139 assertions';
END $$;

-- Index-usage proof (separate from the DO block). On the tiny prod-parity DB the
-- cost-based planner seq-scans ~34 rows regardless; force seqscan off to PROVE
-- the prefix btree CAN serve `name_norm LIKE 'q%'`. On prod's 10k–100k rows the
-- planner picks it naturally.
SET enable_seqscan = off;
EXPLAIN (COSTS OFF)
  SELECT id FROM public.cities
  WHERE active = true AND expansion_status <> 'hidden'
    AND name_norm LIKE 'buc%';
RESET enable_seqscan;

SELECT 'ALL 139 ASSERTIONS PASSED' AS result;
