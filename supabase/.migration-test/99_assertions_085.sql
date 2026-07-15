-- Regression assertions for migration 085 (profiles email privacy).

\set ON_ERROR_STOP on

-- 1. Authenticated user selecting another profile's email errors.
do $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
  set local role authenticated;
  begin
    select email into v from public.profiles
     where id = '00000000-0000-0000-0000-00000000000b';
    raise exception 'FAIL: dave read bob''s email (%)', v;
  exception when insufficient_privilege then
    raise notice 'PASS: email column not selectable by authenticated';
  end;
end $$;

-- 2. select * errors too (forces clients to enumerate columns).
do $$
declare r record;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
  set local role authenticated;
  begin
    select * into r from public.profiles limit 1;
    raise exception 'FAIL: select * on profiles still allowed';
  exception when insufficient_privilege then
    raise notice 'PASS: select * on profiles rejected';
  end;
end $$;

-- 3. pending_deletion_at not selectable.
do $$
declare v timestamptz;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
  set local role authenticated;
  begin
    select pending_deletion_at into v from public.profiles
     where id = '00000000-0000-0000-0000-00000000000b';
    raise exception 'FAIL: pending_deletion_at readable';
  exception when insufficient_privilege then
    raise notice 'PASS: pending_deletion_at not selectable';
  end;
end $$;

-- 4. The public column set (the client's PUBLIC_PROFILE_COLUMNS) still works,
--    for own and other rows.
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
  set local role authenticated;
  select count(*) into n from (
    select id, full_name, avatar_url, city, lang, auth_provider, created_at,
           username, is_admin, is_moderator, notify_friend_checkins
    from public.profiles
  ) q;
  if n < 4 then raise exception 'FAIL: public column select returned % rows', n; end if;
  raise notice 'PASS: public profile columns selectable (% rows)', n;
end $$;

-- 5. updateProfile-style UPDATE ... RETURNING public columns still works.
do $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
  set local role authenticated;
  update public.profiles set full_name = 'Dave D.'
   where id = '00000000-0000-0000-0000-00000000000d'
   returning full_name into v;
  if v <> 'Dave D.' then raise exception 'FAIL: returning clause broken'; end if;
  raise notice 'PASS: own-row update with public-column RETURNING works';
end $$;

-- 6. SECURITY DEFINER admin surfaces still read emails (owner bypasses the
--    column grant) — mirrors admin_search_users (081).
create or replace function public._test_admin_email_lookup(p_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp
as $$ select email from public.profiles where id = p_id $$;
grant execute on function public._test_admin_email_lookup(uuid) to authenticated;

do $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  set local role authenticated;
  v := public._test_admin_email_lookup('00000000-0000-0000-0000-00000000000b');
  if v is distinct from 'bob@example.com' then
    raise exception 'FAIL: definer email lookup returned %', v;
  end if;
  raise notice 'PASS: SECURITY DEFINER admin surface still reads email';
end $$;

drop function public._test_admin_email_lookup(uuid);

select 'ALL 085 ASSERTIONS PASSED' as result;
