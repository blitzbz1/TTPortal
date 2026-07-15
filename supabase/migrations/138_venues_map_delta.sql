-- 138_venues_map_delta.sql
-- Stage 3 (Android map-load optimization): a slimmer venue delta for the map/list.
--
-- MapViewScreen feeds both the GPU cluster pins and the bottom-sheet list/search
-- from a single useVenuesQuery array. get_venues_delta (063) ships a 17-field row;
-- five of those earn nothing on the load path: city_id, created_at, updated_at and
-- approved are dead on the client, and `city` duplicates selectedCity.name. This
-- NEW function projects ONLY the 12 kept fields (~25-30% smaller payload, ~35-45%
-- less parse / MMKV-stringify / GC per cold city-switch), inside the same
-- {upserts, tombstone_ids, synced_at} envelope.
--
-- Design guards (research §6 DO-NOTs):
--   * get_venues_delta is LEFT INTACT — already-shipped clients still call it
--     (099-style compat; do NOT drop or CREATE OR REPLACE it here).
--   * Enum strings (type, condition) + bool flags (free_access/night_lighting/
--     nets/verified) kept as-is — NO int/bit packing (#7).
--   * upserts built as ONE jsonb_agg of whole row-objects ORDER BY id — NOT split
--     into per-column arrays; a deterministic id order can't misalign (#8).
--   * The city / city_id / updated_at / approved table columns stay in the WHERE
--     predicate (they still exist); only the JSON projection drops them.
--
-- Renumber note: Stage 3 ships as 138 (next-free after 137) because it lands
-- before Stage 2; the cities-tiering migration takes 139+ when it lands.

CREATE OR REPLACE FUNCTION public.get_venues_map_delta(
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
  -- Slim 12-column projection, whole-row objects, deterministic ORDER BY id.
  SELECT COALESCE(jsonb_agg(to_jsonb(rec) ORDER BY rec.id), '[]'::jsonb)
  INTO v_upserts
  FROM (
    SELECT
      id,
      name,
      type,
      address,
      lat,
      lng,
      tables_count,
      condition,
      free_access,
      night_lighting,
      nets,
      verified
    FROM public.venues
    WHERE approved = true
      AND (p_since IS NULL OR updated_at > p_since)
      AND (p_city_id IS NULL OR city_id = p_city_id)
      AND (p_city IS NULL OR city = p_city)
      AND (p_type IS NULL OR type = p_type)
  ) rec;

  -- Tombstones: explicit deletions UNION rows flipped to unapproved (unchanged from 063).
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

GRANT EXECUTE ON FUNCTION public.get_venues_map_delta(TIMESTAMPTZ, TEXT, TEXT, INTEGER)
  TO authenticated, anon;
