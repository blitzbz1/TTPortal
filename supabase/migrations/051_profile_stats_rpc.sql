-- Server-side aggregate for the profile stats panel.
--
-- Why
-- ===
-- src/services/profiles.ts#getProfileStats used to:
--   1. Fetch one row from leaderboard_checkins (cheap, ok)
--   2. Fetch *every* event_participants row for the user, just to sum
--      hours_played client-side.
-- That second query grows linearly with the number of events the user
-- has joined — forever. After a hundred events, the wire payload is
-- ~100 rows where the only number we care about is the SUM.
--
-- This RPC pushes the SUM and COUNT into the database and returns one
-- row with all four numbers in a single round-trip.

create or replace function public.get_profile_stats(p_user_id uuid)
returns table (
  total_checkins  int,
  unique_venues   int,
  events_joined   int,
  total_hours_played numeric
)
language sql stable
security definer
set search_path = public
as $$
  select
    coalesce(lc.total_checkins, 0) as total_checkins,
    coalesce(lc.unique_venues, 0)  as unique_venues,
    coalesce(ep.events_joined, 0)  as events_joined,
    coalesce(ep.total_hours_played, 0) as total_hours_played
  from
    (select 1) base
    left join (
      select total_checkins, unique_venues
      from public.leaderboard_checkins
      where user_id = p_user_id
    ) lc on true
    left join (
      select count(*)::int                     as events_joined,
             coalesce(sum(hours_played), 0)    as total_hours_played
      from public.event_participants
      where user_id = p_user_id
    ) ep on true;
$$;

grant execute on function public.get_profile_stats(uuid) to authenticated, anon;
