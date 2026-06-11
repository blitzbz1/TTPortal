-- Regression assertions for migration 088 (catalog insert RPCs).

\set ON_ERROR_STOP on

-- 1. Authenticated direct INSERT into cities fails.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  begin
    insert into public.cities (name, country_code, country_name, lat, lng)
    values ('Spamville', 'RO', 'Romania', 1, 1);
    raise exception 'FAIL: direct city insert still allowed';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: direct city insert blocked for non-admins (%)', sqlstate;
  end;
end $$;

-- 2. Direct INSERT into countries fails too.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  begin
    insert into public.countries (code, name) values ('XX', 'Nowhere');
    raise exception 'FAIL: direct country insert still allowed';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS: direct country insert blocked for non-admins (%)', sqlstate;
  end;
end $$;

-- 3. The RPC dedupes "Wien"/"wien"/"wíen" onto the existing row.
do $$
declare id1 int; id2 int; id3 int; n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  id1 := public.find_or_create_city('Wien', 'AT', 'Austria', 48.2082, 16.3738, 12);
  id2 := public.find_or_create_city('wien', 'AT', 'Austria', 48.2082, 16.3738, 12);
  id3 := public.find_or_create_city('  wíen ', 'AT', 'Austria', 48.2082, 16.3738, 12);
  reset role;
  if id1 is distinct from id2 or id2 is distinct from id3 then
    raise exception 'FAIL: dedupe produced different ids (%, %, %)', id1, id2, id3;
  end if;
  select count(*) into n from public.cities where lower(unaccent(name)) = 'wien';
  if n <> 1 then raise exception 'FAIL: % wien rows', n; end if;
  raise notice 'PASS: find_or_create_city dedupes case/diacritic variants';
end $$;

-- 4. New city via RPC works and validates the country code.
do $$
declare v_id int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  v_id := public.find_or_create_city('Graz', 'at', 'Austria', 47.0707, 15.4395, 12);
  if v_id is null then raise exception 'FAIL: new city not created'; end if;
  begin
    perform public.find_or_create_city('Atlantis', 'XYZ', null, 1, 1, 12);
    raise exception 'FAIL: invalid country code accepted';
  exception when others then
    if sqlerrm like 'invalid_country_code%' then
      raise notice 'PASS: new city created; invalid country code rejected';
    else
      raise;
    end if;
  end;
end $$;

-- 5. Creating without a map center fails for new cities.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  begin
    perform public.find_or_create_city('Linz', 'AT', 'Austria', null, null, null);
    raise exception 'FAIL: new city without map center accepted';
  exception when others then
    if sqlerrm = 'city_map_center_required' then
      raise notice 'PASS: map center required for new cities';
    else
      raise;
    end if;
  end;
end $$;

-- 6. Anon cannot call the RPCs.
do $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    perform public.find_or_create_city('Salzburg', 'AT', 'Austria', 47.8, 13.04, 12);
    raise exception 'FAIL: anon can call find_or_create_city';
  exception when insufficient_privilege then
    raise notice 'PASS: find_or_create_city revoked from anon';
  end;
end $$;

-- 7. The repair pass actually fixes hidden/stale rows now.
insert into public.cities (name, country_code, country_name, lat, lng, active, expansion_status)
values ('Krems', 'AT', 'Austria', null, null, false, 'hidden');

do $$
declare v_id int; v_row public.cities;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  v_id := public.find_or_create_city('Krems', 'AT', 'Austria', 48.41, 15.61, 13);
  reset role;
  select * into v_row from public.cities where id = v_id;
  if not v_row.active or v_row.expansion_status <> 'active' or v_row.lat is null then
    raise exception 'FAIL: repair pass did not fix the row (active=%, status=%, lat=%)',
      v_row.active, v_row.expansion_status, v_row.lat;
  end if;
  raise notice 'PASS: repair pass reactivates and backfills matched rows';
end $$;

select 'ALL 088 ASSERTIONS PASSED' as result;
