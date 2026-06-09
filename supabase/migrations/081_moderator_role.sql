-- Migration: 081_moderator_role
-- Add a lesser-privileged "moderator" role: trusted users who can help with
-- community moderation (flagged reviews, content reports, venue change requests)
-- WITHOUT full admin power (no pending-venue approval, no user feedback, and no
-- permanent venue deletion).
--
-- Design notes
-- ============
-- - Mirrors the existing profiles.is_admin boolean instead of introducing a role
--   enum, so the ~30 existing is_admin RLS policies stay untouched. Admin is a
--   superset of moderator.
-- - public.can_moderate() returns true for admins OR moderators; ONLY the three
--   moderated surfaces (venue_change_requests, content_reports, reviews) switch
--   to it. Everything else stays admin-only via is_current_user_admin() (073).
-- - Destructive limit: a moderator resolving a "mark unavailable" change request
--   may HIDE a venue but not permanently REMOVE it — resolve_venue_change_request
--   still requires is_current_user_admin() for the 'remove' action.
-- - Granting is admin-only via admin_set_user_moderator() (profiles UPDATE RLS is
--   own-row only, so a SECURITY DEFINER RPC is the only way to set another user's
--   flag). Admins find users with admin_search_users() (mirrors search_venues_admin,
--   migration 050; unaccent extension is created in 073).

-- ======================================================================
-- Column + capability helper
-- ======================================================================

alter table public.profiles
  add column if not exists is_moderator boolean not null default false;

-- True when the current user can moderate community content (admins included).
-- Mirrors is_current_user_admin() (073); used by the three moderated surfaces.
create or replace function public.can_moderate()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_admin or p.is_moderator
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

grant execute on function public.can_moderate() to authenticated;

-- ======================================================================
-- venue_change_requests: moderators read + update (were admin-only, 078)
-- ======================================================================

drop policy if exists "admins read all change requests"      on public.venue_change_requests;
drop policy if exists "admins update change requests"         on public.venue_change_requests;
drop policy if exists "moderators read all change requests"   on public.venue_change_requests;
drop policy if exists "moderators update change requests"     on public.venue_change_requests;

create policy "moderators read all change requests" on public.venue_change_requests
  for select using (public.can_moderate());

create policy "moderators update change requests" on public.venue_change_requests
  for update using (public.can_moderate());

-- ======================================================================
-- content_reports: moderators read + update (were admin-only, 072)
-- ======================================================================

drop policy if exists "admins read all reports"        on public.content_reports;
drop policy if exists "admins update reports"           on public.content_reports;
drop policy if exists "moderators read all reports"     on public.content_reports;
drop policy if exists "moderators update reports"        on public.content_reports;

create policy "moderators read all reports" on public.content_reports
  for select using (public.can_moderate());

create policy "moderators update reports" on public.content_reports
  for update using (public.can_moderate());

-- ======================================================================
-- reviews: moderators can clear flags (UPDATE) and delete flagged reviews
-- ----------------------------------------------------------------------
-- NOTE: there was previously NO admin UPDATE policy on reviews (004 only grants
-- "Users can update own reviews"), so the admin "keep" action — which clears
-- flagged/flag_count on ANOTHER user's review — was silently blocked by RLS.
-- Adding this UPDATE policy fixes that latent bug and extends both the keep and
-- delete capabilities to moderators.
-- ======================================================================

drop policy if exists "Admins can delete any review"      on public.reviews;
drop policy if exists "Moderators can delete any review"  on public.reviews;
drop policy if exists "Moderators can update any review"  on public.reviews;

create policy "Moderators can delete any review" on public.reviews
  for delete to authenticated
  using (public.can_moderate());

create policy "Moderators can update any review" on public.reviews
  for update to authenticated
  using (public.can_moderate())
  with check (public.can_moderate());

-- ======================================================================
-- resolve_venue_change_request: allow moderators, keep hard-remove admin-only.
-- Recreated verbatim from 078 except: the auth gate now uses can_moderate(),
-- and a new guard reserves the 'remove' availability action for admins.
-- ======================================================================

create or replace function public.resolve_venue_change_request(
  p_request_id           bigint,
  p_apply_nets           boolean default false,
  p_apply_night_lighting boolean default false,
  p_apply_tables_count   boolean default false,
  p_availability         text    default 'none'
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req         public.venue_change_requests;
  v_venue       public.venues;
  v_before      jsonb;
  v_avail       text := coalesce(p_availability, 'none');
  v_do_nets     boolean;
  v_do_light    boolean;
  v_do_tables   boolean;
  v_applied     int := 0;
  v_proposed    int := 0;
  v_status      text;
  v_resolution  jsonb := jsonb_build_object();
begin
  if not public.can_moderate() then
    raise exception 'Unauthorized';
  end if;

  if v_avail not in ('none', 'hide', 'remove') then
    raise exception 'Invalid availability action: %', v_avail;
  end if;

  -- Permanent removal is admin-only; moderators may hide but not delete venues.
  if v_avail = 'remove' and not public.is_current_user_admin() then
    raise exception 'remove_requires_admin';
  end if;

  select * into v_req from public.venue_change_requests where id = p_request_id;
  if v_req.id is null then
    raise exception 'Change request not found: %', p_request_id;
  end if;

  select * into v_venue from public.venues where id = v_req.venue_id;
  if v_venue.id is null then
    -- Venue already gone; close the request without touching anything.
    update public.venue_change_requests
       set status = 'dismissed', reviewed_by = auth.uid(), reviewed_at = now(),
           resolution = jsonb_build_object('venue_missing', true)
     where id = p_request_id;
    return 'dismissed';
  end if;

  v_before := to_jsonb(v_venue);

  v_do_nets   := p_apply_nets           and v_req.proposed_nets is not null;
  v_do_light  := p_apply_night_lighting and v_req.proposed_night_lighting is not null;
  v_do_tables := p_apply_tables_count   and v_req.proposed_tables_count is not null;

  -- Build the per-field decision snapshot + count proposed fields.
  if v_req.proposed_nets is not null then
    v_proposed := v_proposed + 1;
    v_resolution := v_resolution || jsonb_build_object('nets', case when v_do_nets then 'accepted' else 'rejected' end);
  end if;
  if v_req.proposed_night_lighting is not null then
    v_proposed := v_proposed + 1;
    v_resolution := v_resolution || jsonb_build_object('night_lighting', case when v_do_light then 'accepted' else 'rejected' end);
  end if;
  if v_req.proposed_tables_count is not null then
    v_proposed := v_proposed + 1;
    v_resolution := v_resolution || jsonb_build_object('tables_count', case when v_do_tables then 'accepted' else 'rejected' end);
  end if;
  if v_req.mark_unavailable then
    v_proposed := v_proposed + 1;
    v_resolution := v_resolution || jsonb_build_object('availability', v_avail);
  end if;

  -- Apply accepted attribute edits in one UPDATE (skip entirely if none, to
  -- avoid a no-op updated_at bump / delta-sync churn).
  if v_do_nets or v_do_light or v_do_tables then
    update public.venues
       set nets           = case when v_do_nets   then v_req.proposed_nets           else nets end,
           night_lighting = case when v_do_light  then v_req.proposed_night_lighting else night_lighting end,
           tables_count   = case when v_do_tables then v_req.proposed_tables_count   else tables_count end
     where id = v_req.venue_id;
    v_applied := v_applied
      + (case when v_do_nets then 1 else 0 end)
      + (case when v_do_light then 1 else 0 end)
      + (case when v_do_tables then 1 else 0 end);
  end if;

  -- Availability action.
  if v_avail = 'remove' then
    -- Hard delete. The 045 ON DELETE trigger writes a venue_tombstones row so
    -- delta-sync clients drop the venue. We do NOT write a venue_admin_audit
    -- row here: its venue_id FK is ON DELETE CASCADE, so any audit row would be
    -- removed by this same delete (consistent with the existing, likewise
    -- unaudited admin deleteVenue path). This change-request row also cascades.
    delete from public.venues where id = v_req.venue_id;
    return 'applied';
  elsif v_avail = 'hide' then
    update public.venues
       set approved = false, review_status = 'hidden',
           reviewed_at = now(), reviewed_by = auth.uid()
     where id = v_req.venue_id;
    v_applied := v_applied + 1;
  end if;

  if v_applied = 0 then
    v_status := 'dismissed';
  elsif v_applied >= v_proposed then
    v_status := 'applied';
  else
    v_status := 'partially_applied';
  end if;

  update public.venue_change_requests
     set status = v_status, resolution = v_resolution,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_request_id;

  insert into public.venue_admin_audit(venue_id, admin_id, action, before_state, after_state, note)
  values (
    v_req.venue_id, auth.uid(), 'change_request_' || v_status, v_before,
    (select to_jsonb(v2) from public.venues v2 where v2.id = v_req.venue_id), v_req.note
  );

  return v_status;
end;
$$;

comment on function public.resolve_venue_change_request is
  'Moderator/admin: apply accepted fields from a venue change request, optionally hide (admins also: remove) the venue, record the decision, and audit. Returns the resulting status.';

grant execute on function public.resolve_venue_change_request(bigint, boolean, boolean, boolean, text) to authenticated;

-- ======================================================================
-- Admin-only role management
-- ======================================================================

-- Grant/revoke the moderator role on another user. Admin-only: profiles UPDATE
-- RLS is own-row only, so this SECURITY DEFINER RPC is the only way to set it.
create or replace function public.admin_set_user_moderator(
  p_user_id uuid,
  p_value   boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Unauthorized';
  end if;
  update public.profiles
     set is_moderator = coalesce(p_value, false)
   where id = p_user_id;
end;
$$;

comment on function public.admin_set_user_moderator is
  'Admin-only: grant (true) or revoke (false) the moderator role on another user.';

grant execute on function public.admin_set_user_moderator(uuid, boolean) to authenticated;

-- Admin-only diacritic-insensitive user search for the moderator-management UI.
-- Mirrors search_venues_admin (050); returns only the columns the UI renders.
create or replace function public.admin_search_users(
  p_query text,
  p_limit int default 30
) returns table (
  id           uuid,
  full_name    text,
  email        text,
  username     text,
  is_admin     boolean,
  is_moderator boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Unauthorized';
  end if;
  return query
    select p.id, p.full_name, p.email, p.username, p.is_admin, p.is_moderator
    from public.profiles p
    where unaccent(coalesce(p.full_name, '')) ilike '%' || unaccent(p_query) || '%'
       or unaccent(coalesce(p.email, ''))     ilike '%' || unaccent(p_query) || '%'
       or unaccent(coalesce(p.username, ''))  ilike '%' || unaccent(p_query) || '%'
    order by p.full_name nulls last
    limit greatest(coalesce(p_limit, 30), 1);
end;
$$;

comment on function public.admin_search_users is
  'Admin-only: diacritic-insensitive search over profiles (name/email/username) for the moderator-management UI.';

grant execute on function public.admin_search_users(text, int) to authenticated;

NOTIFY pgrst, 'reload schema';
