-- One-shot RPC for the map screen's venue list.
--
-- Why
-- ===
-- src/services/venues.ts#getVenues makes two round-trips:
--   1. select venues by approved/city/type
--   2. select venue_stats for the returned ids
-- That doubles the wire latency (especially on mobile) and the egress
-- overhead of two PostgREST responses. This RPC merges them into a
-- single payload by joining venues to venue_stats server-side.
--
-- The output shape mirrors what getVenues returns to its callers — a
-- venue row with a `venue_stats` object — so the client adapter is a
-- 1:1 swap with the existing two-step query.

create or replace function public.get_map_venues(
  p_city text default null,
  p_type text default null
)
returns jsonb
language sql stable
security definer
set search_path = public
as $$
  with v as (
    select
      id, name, type, city, address, lat, lng, tables_count, condition,
      free_access, night_lighting, nets, verified, approved
    from public.venues
    where approved = true
      and (p_city is null or city = p_city)
      and (p_type is null or type = p_type)
    order by name
    limit 300
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',              v.id,
      'name',            v.name,
      'type',            v.type,
      'city',            v.city,
      'address',         v.address,
      'lat',             v.lat,
      'lng',             v.lng,
      'tables_count',    v.tables_count,
      'condition',       v.condition,
      'free_access',     v.free_access,
      'night_lighting',  v.night_lighting,
      'nets',            v.nets,
      'verified',        v.verified,
      'approved',        v.approved,
      'venue_stats',     case when s.venue_id is null then null else jsonb_build_object(
        'venue_id',       s.venue_id,
        'avg_rating',     s.avg_rating,
        'review_count',   s.review_count,
        'checkin_count',  s.checkin_count,
        'favorite_count', s.favorite_count
      ) end
    )
  ), '[]'::jsonb)
  from v
  left join public.venue_stats s on s.venue_id = v.id;
$$;

grant execute on function public.get_map_venues(text, text) to authenticated, anon;
