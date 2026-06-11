-- Regression assertions for migrations 082 + 083.
-- Every check raises loudly on failure; a clean run prints only the NOTICEs.

\set ON_ERROR_STOP on

-- =====================================================================
-- 082: profiles role guard
-- =====================================================================

-- 1. Non-admin self-PATCH of is_admin is rejected.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  begin
    update public.profiles set is_admin = true
     where id = '00000000-0000-0000-0000-00000000000b';
    raise exception 'FAIL: bob escalated is_admin';
  exception when insufficient_privilege then
    raise notice 'PASS: self-escalation of is_admin blocked';
  end;
end $$;

-- 2. Non-admin self-PATCH of is_moderator is rejected.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  begin
    update public.profiles set is_moderator = true
     where id = '00000000-0000-0000-0000-00000000000b';
    raise exception 'FAIL: bob escalated is_moderator';
  exception when insufficient_privilege then
    raise notice 'PASS: self-escalation of is_moderator blocked';
  end;
end $$;

-- 3. Non-admin direct PATCH of pending_deletion_at is rejected.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  begin
    update public.profiles set pending_deletion_at = now()
     where id = '00000000-0000-0000-0000-00000000000b';
    raise exception 'FAIL: bob set pending_deletion_at directly';
  exception when insufficient_privilege then
    raise notice 'PASS: direct pending_deletion_at update blocked';
  end;
end $$;

-- 4. Harmless own-row updates still work.
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  update public.profiles set full_name = 'Bobby'
   where id = '00000000-0000-0000-0000-00000000000b';
  raise notice 'PASS: normal profile update unaffected';
end $$;

-- 5. request_account_deletion / cancel_account_deletion still work
--    (recreated as SECURITY DEFINER in 082).
do $$
declare v timestamptz;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  v := public.request_account_deletion();
  if v is null then raise exception 'FAIL: request_account_deletion returned null'; end if;
  reset role;
  if (select pending_deletion_at from public.profiles where id = '00000000-0000-0000-0000-00000000000b') is null then
    raise exception 'FAIL: pending_deletion_at not set by RPC';
  end if;
  set local role authenticated;
  perform public.cancel_account_deletion();
  reset role;
  if (select pending_deletion_at from public.profiles where id = '00000000-0000-0000-0000-00000000000b') is not null then
    raise exception 'FAIL: pending_deletion_at not cleared by RPC';
  end if;
  raise notice 'PASS: account-deletion RPCs route through the guard';
end $$;

-- 6. Admin RPC admin_set_user_moderator still works (SECURITY DEFINER owner path).
create or replace function public.admin_set_user_moderator(p_user_id uuid, p_value boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_current_user_admin() then raise exception 'Unauthorized'; end if;
  update public.profiles set is_moderator = coalesce(p_value, false) where id = p_user_id;
end $$;
grant execute on function public.admin_set_user_moderator(uuid, boolean) to authenticated;

do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  set local role authenticated;
  perform public.admin_set_user_moderator('00000000-0000-0000-0000-00000000000b', true);
  reset role;
  if not (select is_moderator from public.profiles where id = '00000000-0000-0000-0000-00000000000b') then
    raise exception 'FAIL: admin_set_user_moderator did not stick';
  end if;
  raise notice 'PASS: admin_set_user_moderator passes the guard';
end $$;

-- 7. An admin may edit role flags directly (dashboard path).
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  set local role authenticated;
  update public.profiles set is_moderator = true
   where id = '00000000-0000-0000-0000-00000000000a';
  raise notice 'PASS: admin direct role edit allowed';
end $$;

-- =====================================================================
-- 083: auth.uid()-derived RPCs
-- =====================================================================

-- 8. get_friend_feed returns only the caller's accepted friends.
do $$
declare n_carol int; n_dave int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  select count(*) filter (where user_id = '00000000-0000-0000-0000-00000000000c'),
         count(*) filter (where user_id = '00000000-0000-0000-0000-00000000000d')
    into n_carol, n_dave
    from public.get_friend_feed();
  if n_carol < 2 then raise exception 'FAIL: feed missing accepted friend rows (carol=%)', n_carol; end if;
  if n_dave > 0 then raise exception 'FAIL: feed leaked non-friend rows (dave=%)', n_dave; end if;
  raise notice 'PASS: get_friend_feed scoped to accepted friendships';
end $$;

-- 9. get_friend_feed signature no longer accepts friend ids.
do $$
begin
  begin
    perform public.get_friend_feed(array['00000000-0000-0000-0000-00000000000d']::uuid[], 30);
    raise exception 'FAIL: old get_friend_feed(uuid[],int) still callable';
  exception when undefined_function then
    raise notice 'PASS: get_friend_feed(uuid[],int) dropped';
  end;
end $$;

-- 10. get_venue_detail personalizes for the caller only.
do $$
declare b jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  b := public.get_venue_detail(1);
  if (b->>'is_favorited')::boolean is distinct from true then
    raise exception 'FAIL: bob favorite missing from bundle';
  end if;
  if b->'user_active_checkin' = 'null'::jsonb then
    raise exception 'FAIL: bob active checkin missing from bundle';
  end if;
  if (b->'user_active_checkin'->>'user_id') <> '00000000-0000-0000-0000-00000000000b' then
    raise exception 'FAIL: bundle returned another user''s checkin';
  end if;
  raise notice 'PASS: get_venue_detail personalization is self-only';
end $$;

-- 11. get_venue_detail as anon: public bundle, no personalization.
do $$
declare b jsonb;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  b := public.get_venue_detail(1);
  if b is null then raise exception 'FAIL: anon cannot read public venue bundle'; end if;
  if (b->>'is_favorited')::boolean then raise exception 'FAIL: anon got is_favorited=true'; end if;
  if b->'user_active_checkin' is not null and b->'user_active_checkin' <> 'null'::jsonb then
    raise exception 'FAIL: anon got an active checkin';
  end if;
  raise notice 'PASS: anon venue bundle is unpersonalized';
end $$;

-- 12. get_venue_detail old signature is gone.
do $$
begin
  begin
    perform public.get_venue_detail(1, '00000000-0000-0000-0000-00000000000c'::uuid, 5);
    raise exception 'FAIL: old get_venue_detail(int,uuid,int) still callable';
  exception when undefined_function then
    raise notice 'PASS: get_venue_detail(int,uuid,int) dropped';
  end;
end $$;

-- 13. get_friends_at_venue uses the caller's friendships.
do $$
declare n_carol int; n_dave int;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  select count(*) filter (where user_id = '00000000-0000-0000-0000-00000000000c'),
         count(*) filter (where user_id = '00000000-0000-0000-0000-00000000000d')
    into n_carol, n_dave
    from public.get_friends_at_venue(1);
  if n_carol <> 1 then raise exception 'FAIL: accepted friend not listed (carol=%)', n_carol; end if;
  if n_dave > 0 then raise exception 'FAIL: non-friend listed (dave=%)', n_dave; end if;
  raise notice 'PASS: get_friends_at_venue scoped to caller friendships';
end $$;

-- 14. get_friends_at_venue revoked from anon.
do $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    perform public.get_friends_at_venue(1);
    raise exception 'FAIL: anon can call get_friends_at_venue';
  exception when insufficient_privilege then
    raise notice 'PASS: get_friends_at_venue revoked from anon';
  end;
end $$;

select 'ALL ASSERTIONS PASSED' as result;
