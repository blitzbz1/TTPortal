-- 139_cities_tiered_catalog.sql
-- Stage 2 (Android map-load optimization): the cities catalog WINNER.
--
-- LocationProvider drives useCitiesQuery, which parses the full ~10,330-row /
-- 3.35 MB blob and runs a full-catalog toLocationCity + mergeExpansionCityWave +
-- cleanCityCatalog + compareRo sorts on every change, all consumed whole by the
-- switcher. Lazy field materialization can't help — only cutting the ROW COUNT
-- does. This migration ships:
--
--   * get_cities_catalog_v2(p_since) — ships ONLY the venue-bearing / eager tier
--     (the same set the Stage-M count query measures), with the full switcher
--     projection KEPT (id..updated_at) PLUS a server-built ascii `search_key`.
--   * search_cities(p_query, p_limit) — on-demand long-tail reach over the FULL
--     catalog via a generated `name_norm` PREFIX btree (≥2 chars), so a
--     zero-venue city outside the tier is still selectable.
--   * get_cities_by_ids(p_ids) — single-row fallback for a saved selectedCity
--     whose id is no longer in the eager tier (boot never null-flickers).
--
-- Design guards (research §6 DO-NOTs):
--   * get_cities_delta (063) is LEFT INTACT — already-shipped clients still call
--     it (099-style compat; the three functions below are additive).
--   * zoom + admin_area stay in the projection (#5: zoom drives
--     getMapRegionForCity, admin_area is the AddVenueScreen `state`). Only
--     country_name is client-derivable, but it is kept in the row for parity.
--   * Every output is built as ONE jsonb_agg of whole row-objects over a single
--     row_number() OVER (ORDER BY name, id) CTE — NEVER per-column ORDER BY: OSM
--     imports share updated_at, so a per-column order would misalign arrays (#8).
--   * search_cities uses a `name_norm` text_pattern_ops PREFIX btree, NOT a
--     pg_trgm GIN (#13: trigrams need ≥3 chars and don't match the switcher's
--     startsWith ranking). It is always min-length-guarded server-side and
--     debounced client-side.
--
-- name_norm / recall note (research §8.4): name_norm folds + concatenates
--   name, admin_area, local_area, county, country_name so the eager tier's
--   `search_key` gives the CLIENT's existing substring filter
--   (LocationSelector getCitySearchText) a consistent, diacritic-folded,
--   multi-field key. The SERVER long-tail search is a LEFT-ANCHORED name-prefix
--   (name leads name_norm) because a text_pattern_ops btree can only accelerate
--   `LIKE 'x%'` — true secondary-field infix recall would need the pg_trgm GIN
--   #13 forbids. The dominant long-tail query (typing a city name not in the
--   tier) is exactly a name prefix, so this is the right trade.
--
-- Renumber note: Stage 3's slim venue delta already shipped as 138; this
-- cities-tiering migration is the next free number, 139 (000-099 FROZEN; new
-- schema ships additively, never edits an applied migration).

-- ---------------------------------------------------------------------------
-- 1. IMMUTABLE unaccent wrapper.
-- The unaccent extension (050) provides unaccent(text) + unaccent(regdictionary,
-- text), both only STABLE — a STABLE expression cannot back a GENERATED column.
-- Wrapping the 2-arg form (the dictionary is fixed in practice) as IMMUTABLE is
-- the documented Postgres pattern for unaccent-backed generated columns/indexes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- ---------------------------------------------------------------------------
-- 2. name_norm generated column.
-- lower(folded, hyphen/punct-stripped) concatenation of the switcher's recall
-- fields. `||` + coalesce (not concat_ws) because `||` on text is IMMUTABLE
-- while concat/concat_ws are only STABLE (rejected by GENERATED).
-- ---------------------------------------------------------------------------
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS name_norm TEXT
  GENERATED ALWAYS AS (
    lower(regexp_replace(
      public.immutable_unaccent(
        coalesce(name, '')         || ' ' ||
        coalesce(admin_area, '')   || ' ' ||
        coalesce(local_area, '')   || ' ' ||
        coalesce(county, '')       || ' ' ||
        coalesce(country_name, '')
      ),
      '[^a-zA-Z0-9 ]', '', 'g'
    ))
  ) STORED;

-- ---------------------------------------------------------------------------
-- 3. Prefix btree (text_pattern_ops) — accelerates `name_norm LIKE 'q%'` at
--    ≥2 chars; lighter than a trgm GIN at 100k rows (#13).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cities_name_norm_prefix
  ON public.cities (name_norm text_pattern_ops);

-- ---------------------------------------------------------------------------
-- Eager-tier predicate (the authoritative "should ship eagerly" set, §8.6):
--   active = true
--   AND expansion_status <> 'hidden'
--   AND (venue_count > 0 OR expansion_status IN
--        ('launch_ready','community_review','coming_soon'))
-- The 6 client-recognized expansion_status literals (normalizeExpansionStatus):
--   active, launch_ready, community_review, researching, coming_soon, hidden.
--   'active' cities are caught by venue_count>0; 'researching' is the status of
--   the client-only EXPANSION_CITY_WAVE negative-id rows (never DB-fetched), so
--   both are deliberately excluded from the eager IN-list.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 4. get_cities_catalog_v2(p_since) — tier projection + fell-out-of-tier
--    tombstones, same {upserts, tombstone_ids, synced_at} envelope as 063.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cities_catalog_v2(p_since TIMESTAMPTZ DEFAULT NULL)
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
  -- Tier upserts: ONE ordered CTE, whole row-objects, deterministic rn order
  -- (DO-NOT #8). rn is stripped from the emitted object.
  WITH tier AS (
    SELECT
      id, name, county, country_code, country_name, admin_area, local_area,
      lat, lng, zoom, venue_count, active, expansion_status, updated_at,
      name_norm AS search_key,
      row_number() OVER (ORDER BY name, id) AS rn
    FROM public.cities
    WHERE active = true
      AND expansion_status <> 'hidden'
      AND (venue_count > 0 OR expansion_status IN ('launch_ready', 'community_review', 'coming_soon'))
      AND (p_since IS NULL OR updated_at > p_since)
  )
  SELECT COALESCE(jsonb_agg((to_jsonb(t) - 'rn') ORDER BY t.rn), '[]'::jsonb)
  INTO v_upserts
  FROM tier t;

  -- Tombstones: explicit city deletions UNION (on an incremental pull only)
  -- rows updated since p_since that NO LONGER satisfy the tier predicate —
  -- active=false / hidden AND the fell-out-of-tier case (venue_count dropped to
  -- 0 and not otherwise eager). On a since=null full pull the client cache is
  -- empty, so the fell-out branch is skipped (it would emit every non-tier id
  -- for nothing).
  SELECT COALESCE(jsonb_agg(DISTINCT t.city_id), '[]'::jsonb)
  INTO v_tombstones
  FROM (
    SELECT city_id
    FROM public.city_tombstones
    WHERE p_since IS NULL OR deleted_at > p_since
    UNION ALL
    SELECT id AS city_id
    FROM public.cities
    WHERE p_since IS NOT NULL
      AND updated_at > p_since
      AND NOT (
        active = true
        AND expansion_status <> 'hidden'
        AND (venue_count > 0 OR expansion_status IN ('launch_ready', 'community_review', 'coming_soon'))
      )
  ) t;

  RETURN jsonb_build_object(
    'upserts',       v_upserts,
    'tombstone_ids', v_tombstones,
    'synced_at',     v_now
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. search_cities(p_query, p_limit) — on-demand long-tail prefix search over
--    the FULL active/non-hidden catalog (not just the tier). Same projection as
--    get_cities_catalog_v2 upserts so the client merge logic is shared.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_cities(p_query TEXT, p_limit INTEGER DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q      TEXT;
  v_result JSONB;
BEGIN
  -- Normalize the query with the SAME fold name_norm uses.
  v_q := lower(regexp_replace(public.immutable_unaccent(coalesce(p_query, '')), '[^a-zA-Z0-9 ]', '', 'g'));

  -- Min-length guard (complements the client debounce, DO-NOT #13). <2 chars
  -- would scan a huge prefix slice — return empty instead.
  IF length(v_q) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- `name_norm LIKE v_q || '%'` is a left-anchored prefix → uses
  -- idx_cities_name_norm_prefix (text_pattern_ops). v_q is a plpgsql variable so
  -- the planner treats `v_q || '%'` as a constant prefix (sargable). Rank: an
  -- exact NAME match first (NOT name_norm = v_q — name_norm always carries the
  -- NOT-NULL country_name suffix, so the whole-key equality could never fire for
  -- a bare-name query; compare the folded NAME alone), then busiest, then
  -- name/id. ONE ordered CTE + jsonb_agg(ORDER BY rn) (DO-NOT #8).
  WITH matched AS (
    SELECT
      id, name, county, country_code, country_name, admin_area, local_area,
      lat, lng, zoom, venue_count, active, expansion_status, updated_at,
      name_norm AS search_key,
      row_number() OVER (
        ORDER BY
          (lower(regexp_replace(public.immutable_unaccent(coalesce(name, '')), '[^a-zA-Z0-9 ]', '', 'g')) = v_q) DESC,
          venue_count DESC NULLS LAST, name, id
      ) AS rn
    FROM public.cities
    WHERE active = true
      AND expansion_status <> 'hidden'
      AND name_norm LIKE v_q || '%'
    ORDER BY rn
    LIMIT GREATEST(p_limit, 0)
  )
  SELECT COALESCE(jsonb_agg((to_jsonb(m) - 'rn') ORDER BY m.rn), '[]'::jsonb)
  INTO v_result
  FROM matched m;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. get_cities_by_ids(p_ids) — single-row fallback for a saved selectedCity
--    no longer in the eager tier (T051 LocationProvider fallback). Positive ids
--    only; negative EXPANSION_CITY_WAVE ids resolve entirely client-side (§8.5).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cities_by_ids(p_ids INTEGER[])
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH picked AS (
    SELECT
      id, name, county, country_code, country_name, admin_area, local_area,
      lat, lng, zoom, venue_count, active, expansion_status, updated_at,
      name_norm AS search_key,
      row_number() OVER (ORDER BY name, id) AS rn
    FROM public.cities
    WHERE id = ANY(p_ids)
      AND active = true
      AND expansion_status <> 'hidden'
  )
  SELECT COALESCE(jsonb_agg((to_jsonb(p) - 'rn') ORDER BY p.rn), '[]'::jsonb)
  INTO v_result
  FROM picked p;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants — match get_cities_delta (063): authenticated + anon.
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_cities_catalog_v2(TIMESTAMPTZ) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.search_cities(TEXT, INTEGER)       TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_cities_by_ids(INTEGER[])       TO authenticated, anon;
