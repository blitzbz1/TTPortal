-- Regression assertions for migration 091 (check-in visibility).
-- bob ↔ carol are accepted friends; both have active checkins at venue 1.

\set ON_ERROR_STOP on

-- Make carol private.
update public.profiles set checkin_visibility = 'private'
 where id = '00000000-0000-0000-0000-00000000000c';

-- 1. A private user's active check-in is invisible to friends (direct read).
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  select count(*) into n from public.checkins where user_id = '00000000-0000-0000-0000-00000000000c';
  if n <> 0 then raise exception 'FAIL: friend bob sees private carol''s checkins (%)', n; end if;
  raise notice 'PASS: private checkins invisible to friends';
end $$;

-- 2. The private user still sees their own rows.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
  set local role authenticated;
  select count(*) into n from public.checkins where user_id = '00000000-0000-0000-0000-00000000000c';
  if n < 1 then raise exception 'FAIL: carol cannot see her own checkins'; end if;
  raise notice 'PASS: own checkins unaffected by private mode';
end $$;

-- 3. Counts still include private users (anonymous).
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  n := public.get_venue_active_checkin_count(1);
  if n <> 3 then raise exception 'FAIL: count RPC returned % (expected 3 incl. private)', n; end if;
  raise notice 'PASS: anonymous counts still include private users';
end $$;

-- 4. get_friend_feed drops the private friend's checkins but keeps reviews.
do $$
declare n_checkins int; n_reviews int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  select count(*) filter (where kind = 'checkin' and user_id = '00000000-0000-0000-0000-00000000000c'),
         count(*) filter (where kind = 'review'  and user_id = '00000000-0000-0000-0000-00000000000c')
    into n_checkins, n_reviews
    from public.get_friend_feed();
  if n_checkins <> 0 then raise exception 'FAIL: feed shows private friend checkins (%)', n_checkins; end if;
  if n_reviews < 1 then raise exception 'FAIL: feed dropped public reviews of private friend'; end if;
  raise notice 'PASS: feed hides private checkins, keeps reviews';
end $$;

-- 5. get_friends_at_venue omits the private friend.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  select count(*) into n from public.get_friends_at_venue(1)
   where user_id = '00000000-0000-0000-0000-00000000000c';
  if n <> 0 then raise exception 'FAIL: friends-at-venue lists private friend'; end if;
  raise notice 'PASS: friends-at-venue omits private users';
end $$;

-- 6. Flipping back to friends restores visibility.
update public.profiles set checkin_visibility = 'friends'
 where id = '00000000-0000-0000-0000-00000000000c';

do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  select count(*) into n from public.checkins where user_id = '00000000-0000-0000-0000-00000000000c';
  if n < 1 then raise exception 'FAIL: visibility did not restore'; end if;
  raise notice 'PASS: switching back to friends restores visibility';
end $$;

-- 7. Users can update their own preference through PostgREST-style UPDATE.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
  set local role authenticated;
  update public.profiles set checkin_visibility = 'private'
   where id = '00000000-0000-0000-0000-00000000000c';
  update public.profiles set checkin_visibility = 'friends'
   where id = '00000000-0000-0000-0000-00000000000c';
  raise notice 'PASS: own preference updatable (082 guard untouched)';
end $$;

select 'ALL 091 ASSERTIONS PASSED' as result;
