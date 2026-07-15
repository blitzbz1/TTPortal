-- Regression assertions for migration 089 (amatur_cache + definer hardening).

\set ON_ERROR_STOP on

insert into public.amatur_cache (payload) values ('{"k": 1}'::jsonb);

-- 1. Authenticated cannot UPDATE amatur_cache.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  update public.amatur_cache set payload = '{"poison": true}'::jsonb;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: authenticated updated % amatur_cache rows', n; end if;
  raise notice 'PASS: authenticated cannot UPDATE amatur_cache';
end $$;

-- 2. Authenticated cannot DELETE amatur_cache.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  delete from public.amatur_cache;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: authenticated deleted % amatur_cache rows', n; end if;
  raise notice 'PASS: authenticated cannot DELETE amatur_cache';
end $$;

-- 3. Anon can still read.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  select count(*) into n from public.amatur_cache;
  if n < 1 then raise exception 'FAIL: anon cannot read amatur_cache'; end if;
  raise notice 'PASS: anon read on amatur_cache intact';
end $$;

-- 4. No public SECURITY DEFINER function is left without a pinned search_path.
do $$
declare n int;
begin
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      where cfg like 'search_path=%');
  if n <> 0 then raise exception 'FAIL: % definer functions still unpinned', n; end if;
  raise notice 'PASS: every public definer function has search_path pinned';
end $$;

select 'ALL 089 ASSERTIONS PASSED' as result;
