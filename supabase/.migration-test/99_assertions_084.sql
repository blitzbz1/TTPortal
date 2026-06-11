-- Regression assertions for migration 084 (checkins RLS scope).
-- Seed recap (00_harness.sql): bob↔carol accepted friends; dave is a
-- stranger to both; all three have active checkins at venue 1.

\set ON_ERROR_STOP on

-- Helper: the 040 leaderboard functions reference public.weekly_* only in
-- prod; in the harness they may not pre-exist — 084 CREATE OR REPLACEs them,
-- so they exist after applying it.

-- 1. A stranger cannot SELECT another user's active check-in.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
  set local role authenticated;
  select count(*) into n from public.checkins where user_id = '00000000-0000-0000-0000-00000000000b';
  if n <> 0 then raise exception 'FAIL: stranger dave sees bob''s checkins (%)', n; end if;
  raise notice 'PASS: stranger cannot read another user''s checkins';
end $$;

-- 2. A friend can.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
  set local role authenticated;
  select count(*) into n from public.checkins where user_id = '00000000-0000-0000-0000-00000000000b';
  if n < 1 then raise exception 'FAIL: friend carol cannot read bob''s checkins'; end if;
  raise notice 'PASS: accepted friend can read checkins';
end $$;

-- 3. Own rows always readable.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
  set local role authenticated;
  select count(*) into n from public.checkins where user_id = '00000000-0000-0000-0000-00000000000d';
  if n < 1 then raise exception 'FAIL: dave cannot read his own checkins'; end if;
  raise notice 'PASS: own checkins readable';
end $$;

-- 4. Count RPC works for anon and counts everyone.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  n := public.get_venue_active_checkin_count(1);
  if n <> 3 then raise exception 'FAIL: anon count RPC returned % (expected 3)', n; end if;
  raise notice 'PASS: anon count RPC counts all active checkins';
end $$;

-- 5. Weekly leaderboard stays global under the scoped RLS.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
  set local role authenticated;
  select count(distinct user_id) into n
    from public.weekly_leaderboard_checkins(now() - interval '7 days');
  if n <> 3 then raise exception 'FAIL: leaderboard sees % users (expected 3)', n; end if;
  raise notice 'PASS: weekly leaderboard remains global';
end $$;

select 'ALL 084 ASSERTIONS PASSED' as result;
