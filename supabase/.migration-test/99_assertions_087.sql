-- Regression assertions for migration 087 (event_participants visibility).
-- Seed: event 100 is private (organizer alice, invitee carol, participants
-- alice+carol); event 101 is public (participant bob).

\set ON_ERROR_STOP on

-- 1. Anon cannot enumerate a private event's participants.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  select count(*) into n from public.event_participants where event_id = 100;
  if n <> 0 then raise exception 'FAIL: anon sees % private participants', n; end if;
  raise notice 'PASS: anon cannot enumerate private event participants';
end $$;

-- 2. Anon still sees public event participants (web event pages).
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  select count(*) into n from public.event_participants where event_id = 101;
  if n <> 1 then raise exception 'FAIL: anon sees % public participants (expected 1)', n; end if;
  raise notice 'PASS: public event participants stay visible';
end $$;

-- 3. A stranger (dave, authenticated) cannot see private participants.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
  set local role authenticated;
  select count(*) into n from public.event_participants where event_id = 100;
  if n <> 0 then raise exception 'FAIL: stranger sees % private participants', n; end if;
  raise notice 'PASS: authenticated stranger cannot enumerate private participants';
end $$;

-- 4. An invitee can see the private event's participants.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
  set local role authenticated;
  select count(*) into n from public.event_participants where event_id = 100;
  if n <> 2 then raise exception 'FAIL: invitee sees % participants (expected 2)', n; end if;
  raise notice 'PASS: invitee sees private event participants';
end $$;

-- 5. The organizer sees them too.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  set local role authenticated;
  select count(*) into n from public.event_participants where event_id = 100;
  if n <> 2 then raise exception 'FAIL: organizer sees % participants', n; end if;
  raise notice 'PASS: organizer sees private event participants';
end $$;

select 'ALL 087 ASSERTIONS PASSED' as result;
