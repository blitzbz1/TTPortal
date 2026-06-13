-- Migration: 102_postgis_geo_foundation (T027)
-- PostGIS foundation for geo queries at OSM scale (34k venues and growing).
--
-- - venues.geom: generated geography(Point,4326) column (lat/lng stay — the
--   client payloads keep using them) + GIST index.
-- - admin_get_venues_in_viewport: bounding via `geom && ST_MakeEnvelope`
--   (index-served) instead of two BETWEENs over btree-less lat/lng.
-- - get_venues_near(lat, lng, radius_m): the primitive for future
--   near-me/busyness features, ST_DWithin + distance-sorted.
-- - The OSM apply script's awk-injected haversine dedup gate is replaced
--   with ST_DWithin in the same change (supabase/seeds/osm/).
--
-- NOTE: functions touching geom must keep 'extensions' in their pinned
-- search_path — postgis installs there per Supabase convention, and 089's
-- public-only pins would otherwise break ST_* resolution.

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS geom extensions.geography(Point, 4326)
  GENERATED ALWAYS AS (
    extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography
  ) STORED;

CREATE INDEX IF NOT EXISTS venues_geom_gist ON public.venues USING GIST (geom);

-- Near-me primitive: public venue data, so anon may call it too.
CREATE OR REPLACE FUNCTION public.get_venues_near(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_m DOUBLE PRECISION DEFAULT 5000,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  type TEXT,
  condition TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  city TEXT,
  distance_m DOUBLE PRECISION
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT v.id, v.name, v.type, v.condition, v.lat, v.lng, v.city,
         ST_Distance(v.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) AS distance_m
  FROM public.venues v
  WHERE v.approved = true
    AND ST_DWithin(v.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_m)
  ORDER BY distance_m
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;
REVOKE ALL ON FUNCTION public.get_venues_near(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venues_near(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO anon, authenticated;

-- Viewport query, index-served (prod-parity body from 100 with the
-- bounding swapped to geography overlap):
CREATE OR REPLACE FUNCTION public.admin_get_venues_in_viewport(p_min_lat double precision, p_min_lng double precision, p_max_lat double precision, p_max_lng double precision, p_city_id integer DEFAULT NULL::integer, p_approved boolean DEFAULT NULL::boolean, p_type text DEFAULT NULL::text, p_query text DEFAULT NULL::text, p_needs_attention boolean DEFAULT false, p_limit integer DEFAULT 600)
 RETURNS TABLE(id integer, name text, city text, city_id integer, country_code text, address text, type text, tables_count integer, condition text, lat double precision, lng double precision, approved boolean, verified boolean, description text, review_status text, duplicate_of_venue_id integer, needs_manual_pin boolean, admin_review_notes text, reviewed_at timestamp with time zone, reviewed_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone, avg_rating numeric, review_count integer, checkin_count integer, flagged_review_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    v.id,
    v.name,
    v.city,
    v.city_id,
    c.country_code,
    v.address,
    v.type,
    v.tables_count,
    v.condition,
    v.lat,
    v.lng,
    v.approved,
    v.verified,
    v.description,
    v.review_status,
    v.duplicate_of_venue_id,
    v.needs_manual_pin,
    v.admin_review_notes,
    v.reviewed_at,
    v.reviewed_by,
    v.created_at,
    v.updated_at,
    s.avg_rating,
    s.review_count,
    s.checkin_count,
    COUNT(r.id) FILTER (WHERE r.flagged = true)::INTEGER AS flagged_review_count
  FROM public.venues v
  LEFT JOIN public.cities c ON c.id = v.city_id
  LEFT JOIN public.venue_stats s ON s.venue_id = v.id
  LEFT JOIN public.reviews r ON r.venue_id = v.id
  WHERE v.geom && ST_MakeEnvelope(
          LEAST(p_min_lng, p_max_lng), LEAST(p_min_lat, p_max_lat),
          GREATEST(p_min_lng, p_max_lng), GREATEST(p_min_lat, p_max_lat), 4326
        )::geography
    AND (p_city_id IS NULL OR v.city_id = p_city_id)
    AND (p_approved IS NULL OR v.approved = p_approved)
    AND (p_type IS NULL OR v.type = p_type)
    AND (
      p_query IS NULL
      OR trim(p_query) = ''
      OR unaccent(v.name) ILIKE '%' || unaccent(p_query) || '%'
      OR unaccent(v.address) ILIKE '%' || unaccent(p_query) || '%'
    )
    AND (
      p_needs_attention = false
      OR v.address IS NULL
      OR trim(v.address) = ''
      OR v.tables_count IS NULL
      OR v.tables_count = 0
      OR v.condition IS NULL
      OR v.condition = 'necunoscuta'
      OR v.needs_manual_pin = true
      OR v.review_status IN ('needs_manual_pin', 'duplicate_candidate')
      OR EXISTS (
        SELECT 1
        FROM public.reviews attention_review
        WHERE attention_review.venue_id = v.id
          AND attention_review.flagged = true
      )
    )
  GROUP BY
    v.id,
    v.name,
    v.city,
    v.city_id,
    c.country_code,
    v.address,
    v.type,
    v.tables_count,
    v.condition,
    v.lat,
    v.lng,
    v.approved,
    v.verified,
    v.description,
    v.review_status,
    v.duplicate_of_venue_id,
    v.needs_manual_pin,
    v.admin_review_notes,
    v.reviewed_at,
    v.reviewed_by,
    v.created_at,
    v.updated_at,
    s.avg_rating,
    s.review_count,
    s.checkin_count
  ORDER BY
    COUNT(r.id) FILTER (WHERE r.flagged = true) DESC,
    v.approved ASC,
    v.updated_at DESC,
    v.name
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 600), 1), 1000);
END;
$function$;
