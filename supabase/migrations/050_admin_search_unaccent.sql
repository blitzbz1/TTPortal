-- Diacritic-insensitive admin venue search.
--
-- The previous searchVenuesAdmin used PostgREST's .or() with `ilike`, which
-- folds case but not diacritics — so an admin typing "bucuresti" wouldn't
-- find "București". Enable the `unaccent` extension and expose a small
-- SECURITY DEFINER RPC that does `unaccent(col) ILIKE unaccent(pattern)`
-- on both name and address. The client side calls this RPC instead of
-- the .from('venues').or() chain.

create extension if not exists unaccent;

create or replace function public.search_venues_admin(
  p_query text,
  p_limit int default 30
)
returns setof public.venues
language sql stable
security definer
set search_path = public
as $$
  select v.*
  from public.venues v
  where unaccent(v.name)    ilike '%' || unaccent(p_query) || '%'
     or unaccent(v.address) ilike '%' || unaccent(p_query) || '%'
  order by v.name
  limit greatest(coalesce(p_limit, 30), 1);
$$;

grant execute on function public.search_venues_admin(text, int) to authenticated;
