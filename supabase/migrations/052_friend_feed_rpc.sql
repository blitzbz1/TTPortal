-- Server-side merge for the friend activity feed.
--
-- src/services/feed.ts#getFriendFeed used to fire two separate queries
-- (checkins.limit(30) + reviews.limit(30)), pull up to 60 rows back,
-- sort the merged set in JS, slice to 30. Half the bytes were dropped
-- on the floor.
--
-- This RPC does the UNION ALL + ORDER BY + LIMIT in a single statement
-- so PostgREST returns exactly the n rows the client renders.

create or replace function public.get_friend_feed(
  p_friend_ids uuid[],
  p_limit      int default 30
)
returns table (
  kind         text,
  id           bigint,
  user_id      uuid,
  user_name    text,
  venue_id     int,
  venue_name   text,
  venue_city   text,
  rating       int,
  ts           timestamptz
)
language sql stable
security definer
set search_path = public
as $$
  with feed as (
    select
      'checkin'::text                as kind,
      c.id::bigint                   as id,
      c.user_id                      as user_id,
      coalesce(p.full_name, '?')     as user_name,
      c.venue_id                     as venue_id,
      coalesce(v.name, '?')          as venue_name,
      coalesce(v.city, '')           as venue_city,
      null::int                      as rating,
      c.started_at                   as ts
    from public.checkins c
    left join public.profiles p on p.id = c.user_id
    left join public.venues   v on v.id = c.venue_id
    where c.user_id = any(p_friend_ids)

    union all

    select
      'review'::text                 as kind,
      r.id::bigint                   as id,
      r.user_id                      as user_id,
      coalesce(r.reviewer_name, '?') as user_name,
      r.venue_id                     as venue_id,
      coalesce(v.name, '?')          as venue_name,
      ''::text                       as venue_city,
      r.rating                       as rating,
      r.created_at                   as ts
    from public.reviews r
    left join public.venues v on v.id = r.venue_id
    where r.user_id = any(p_friend_ids)
  )
  select * from feed
  order by ts desc
  limit greatest(coalesce(p_limit, 30), 1);
$$;

grant execute on function public.get_friend_feed(uuid[], int) to authenticated;
