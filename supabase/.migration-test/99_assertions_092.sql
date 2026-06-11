-- Regression assertions for migration 092 (storage policies + server-side cap).
-- The harness inserts directly into storage.objects with owner = auth.uid(),
-- mirroring what the Storage API does on upload.

\set ON_ERROR_STOP on

-- 1. Upload into an app-managed prefix works.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name, owner)
  values ('venue-photos', 'venues/1/1000.jpg', auth.uid());
  raise notice 'PASS: upload into venues/ prefix allowed';
end $$;

-- 2. Upload outside the app prefixes is rejected.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('venue-photos', 'avatars/evil.jpg', auth.uid());
    raise exception 'FAIL: arbitrary prefix accepted';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: non-app prefix rejected (%)', sqlstate;
  end;
end $$;

-- 3. Top-level uploads (no venue folder) are rejected.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('venue-photos', 'venues-flat.jpg', auth.uid());
    raise exception 'FAIL: top-level upload accepted';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: top-level upload rejected';
  end;
end $$;

-- 4. The 11th upload within 24h fails even without calling the RPC.
do $$
declare i int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
  set local role authenticated;
  begin
    for i in 1..11 loop
      insert into storage.objects (bucket_id, name, owner)
      values ('venue-photos', 'condition-votes/1/' || i || '.jpg', auth.uid());
    end loop;
    raise exception 'FAIL: 11 uploads in 24h all passed';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: server-side daily cap enforced at upload %', i;
  end;
end $$;

-- 5. Anon cannot upload but can read.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('venue-photos', 'venues/1/anon.jpg', null);
    raise exception 'FAIL: anon upload accepted';
  exception when insufficient_privilege or check_violation then
    null;
  end;
  select count(*) into n from storage.objects where bucket_id = 'venue-photos';
  if n < 1 then raise exception 'FAIL: anon cannot read venue photos'; end if;
  raise notice 'PASS: anon read-only on venue photos';
end $$;

select 'ALL 092 ASSERTIONS PASSED' as result;
