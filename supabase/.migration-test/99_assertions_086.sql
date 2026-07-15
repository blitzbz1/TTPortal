-- Regression assertions for migration 086 (review/vote uniqueness + rate limits).

\set ON_ERROR_STOP on

-- 1. Upsert for the same user+venue replaces instead of duplicating
--    (PostgREST's on_conflict=user_id,venue_id translates to this).
do $$
declare n int; v int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  insert into public.reviews (venue_id, user_id, reviewer_name, rating, body)
  values (1, '00000000-0000-0000-0000-00000000000b', 'Bob', 4, 'first take')
  on conflict (user_id, venue_id) do update
    set rating = excluded.rating, body = excluded.body;
  insert into public.reviews (venue_id, user_id, reviewer_name, rating, body)
  values (1, '00000000-0000-0000-0000-00000000000b', 'Bob', 2, 'revised')
  on conflict (user_id, venue_id) do update
    set rating = excluded.rating, body = excluded.body;
  reset role;
  select count(*), max(rating) into n, v
    from public.reviews
   where user_id = '00000000-0000-0000-0000-00000000000b' and venue_id = 1;
  if n <> 1 then raise exception 'FAIL: % review rows after upsert (expected 1)', n; end if;
  if v <> 2 then raise exception 'FAIL: upsert did not edit in place (rating=%)', v; end if;
  raise notice 'PASS: review upsert edits in place';
end $$;

-- 2. A plain duplicate INSERT violates the unique constraint.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  begin
    insert into public.reviews (venue_id, user_id, reviewer_name, rating, body)
    values (1, '00000000-0000-0000-0000-00000000000b', 'Bob', 5, 'dupe');
    raise exception 'FAIL: duplicate review insert succeeded';
  exception when unique_violation then
    raise notice 'PASS: duplicate review insert rejected';
  end;
end $$;

-- 3. Condition-vote upsert edits in place (incl. the new UPDATE policy).
do $$
declare n int; c text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  insert into public.condition_votes (venue_id, user_id, condition)
  values (1, '00000000-0000-0000-0000-00000000000b', 'buna')
  on conflict (user_id, venue_id) do update set condition = excluded.condition;
  insert into public.condition_votes (venue_id, user_id, condition)
  values (1, '00000000-0000-0000-0000-00000000000b', 'deteriorata')
  on conflict (user_id, venue_id) do update set condition = excluded.condition;
  reset role;
  select count(*), max(condition) into n, c
    from public.condition_votes
   where user_id = '00000000-0000-0000-0000-00000000000b' and venue_id = 1;
  if n <> 1 then raise exception 'FAIL: % vote rows after upsert', n; end if;
  if c <> 'deteriorata' then raise exception 'FAIL: vote not edited in place (%)', c; end if;
  raise notice 'PASS: condition-vote upsert edits in place';
end $$;

-- 4. Burst inserts hit the 10-per-10-minutes rate limit.
--    (Venues seeded as superuser; the burst runs as carol.)
insert into public.venues (id, name, city, approved)
  select i, 'V' || i, 'Wien', true from generate_series(2, 12) i
  on conflict (id) do nothing;
select setval('venues_id_seq', 100);

do $$
declare i int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
  set local role authenticated;
  begin
    -- carol reviews 11 different venues in one burst.
    for i in 2..12 loop
      insert into public.reviews (venue_id, user_id, reviewer_name, rating, body)
      values (i, '00000000-0000-0000-0000-00000000000c', 'Carol', 3, 'spam ' || i)
      on conflict (user_id, venue_id) do update set body = excluded.body;
    end loop;
    raise exception 'FAIL: 11 review inserts in a burst all passed';
  exception when others then
    if sqlerrm like 'rate_limit_exceeded:user:add_review%' then
      raise notice 'PASS: review burst hit the rate limit (%)', sqlerrm;
    else
      raise;
    end if;
  end;
end $$;

select 'ALL 086 ASSERTIONS PASSED' as result;
