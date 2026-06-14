-- Migration: 111_city_guide (F015)
-- One anon-readable aggregate RPC powering the public /city/[id] web guide for
-- traveling players. Aggregates only PUBLIC data: city meta, approved venues
-- (with public stats), and upcoming PUBLIC events. No player identities, so it
-- leaks nothing private (mspec aggregation contract). No new tables.

CREATE OR REPLACE FUNCTION public.get_city_guide(p_city_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH c AS (
    SELECT * FROM public.cities
    WHERE id = p_city_id AND COALESCE(expansion_status, 'active') <> 'hidden'
  ),
  city_venues AS (
    SELECT v.id, v.name, v.type, v.free_access, v.lat, v.lng,
           COALESCE(vs.avg_rating, 0)::numeric  AS avg_rating,
           COALESCE(vs.review_count, 0)::int    AS review_count,
           COALESCE(vs.checkin_count, 0)::int   AS checkin_count
    FROM public.venues v
    LEFT JOIN public.venue_stats vs ON vs.venue_id = v.id
    WHERE v.city_id = p_city_id AND v.approved = true
  ),
  upcoming AS (
    SELECT e.id, e.title, e.starts_at, e.venue_id, v.name AS venue_name
    FROM public.events e
    JOIN public.venues v ON v.id = e.venue_id
    WHERE v.city_id = p_city_id
      AND v.approved = true
      AND e.visibility = 'public'
      AND e.status NOT IN ('cancelled', 'completed')
      AND e.starts_at >= now()
      AND e.starts_at < now() + INTERVAL '14 days'
    ORDER BY e.starts_at
    LIMIT 10
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM c) THEN NULL ELSE jsonb_build_object(
    'city', (SELECT jsonb_build_object(
               'id', id, 'name', name, 'county', county,
               'country_code', country_code, 'country_name', country_name,
               'lat', lat, 'lng', lng) FROM c),
    'venue_count', (SELECT count(*)::int FROM city_venues),
    'outdoor', (SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM (
       SELECT * FROM city_venues WHERE type = 'parc_exterior'
       ORDER BY checkin_count DESC, avg_rating DESC LIMIT 6) x),
    'indoor', (SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM (
       SELECT * FROM city_venues WHERE type = 'sala_indoor'
       ORDER BY checkin_count DESC, avg_rating DESC LIMIT 6) x),
    'free_access', (SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) FROM (
       SELECT * FROM city_venues WHERE free_access = true
       ORDER BY checkin_count DESC, avg_rating DESC LIMIT 6) x),
    'events', (SELECT COALESCE(jsonb_agg(to_jsonb(u)), '[]'::jsonb) FROM upcoming u)
  ) END;
$$;

REVOKE ALL ON FUNCTION public.get_city_guide(integer) FROM PUBLIC;
-- Anon-readable: the public web guide is the whole point (pre-install reach).
GRANT EXECUTE ON FUNCTION public.get_city_guide(integer) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
