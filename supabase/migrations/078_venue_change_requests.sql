-- Migration: 078_venue_change_requests
-- User-submitted venue change requests + admin resolution workflow.
--
-- Design notes
-- ============
-- - Lets a signed-in user propose corrected physical attributes for a venue
--   (nets, night lighting, tables count) and/or flag that the venue is no
--   longer available / does not exist. Admins review each request in the
--   moderation screen and accept or reject each proposed value individually,
--   or mark the venue unavailable (hide) / remove it.
-- - One flat table mirrors content_reports (072): heterogeneous, low volume,
--   admin-reviewed. Per-field accept/reject is captured at resolution time as
--   a JSONB `resolution` snapshot (like venue_admin_audit before/after), so we
--   avoid per-field status columns.
-- - unique(submitted_by, venue_id): a user has at most one open request per
--   venue; re-submitting reopens/overwrites via ON CONFLICT (like report_content).
-- - Table condition is intentionally excluded — it stays in the condition_votes
--   crowd-voting flow.

-- ======================================================================
-- venue_change_requests
-- ======================================================================

create table if not exists public.venue_change_requests (
  id            bigserial primary key,
  venue_id      integer not null references public.venues(id) on delete cascade,
  submitted_by  uuid    not null references auth.users(id)   on delete cascade,
  -- proposed values; NULL = "no change proposed for this field"
  proposed_nets           boolean,
  proposed_night_lighting boolean,
  proposed_tables_count   integer,
  mark_unavailable        boolean not null default false,
  note          text,
  status        text not null default 'pending',
  resolution    jsonb,                 -- {nets:'accepted'|'rejected', ..., availability:'none'|'hide'|'remove'}
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint venue_change_requests_tables_count_chk
    check (proposed_tables_count is null
           or (proposed_tables_count >= 0 and proposed_tables_count <= 200)),
  constraint venue_change_requests_note_chk
    check (note is null or char_length(note) <= 500),
  constraint venue_change_requests_status_chk
    check (status in ('pending','applied','partially_applied','dismissed')),
  -- a request must propose at least one change
  constraint venue_change_requests_has_change_chk
    check (proposed_nets is not null
           or proposed_night_lighting is not null
           or proposed_tables_count is not null
           or mark_unavailable = true),
  -- at most one request per (user, venue); re-submit reopens via on-conflict
  constraint venue_change_requests_unique_per_user unique (submitted_by, venue_id)
);

comment on table public.venue_change_requests is
  'User-submitted proposals to correct a venue''s nets/lighting/tables or flag it unavailable. One row per (submitter, venue); admins resolve per-field.';

create index if not exists vcr_pending_idx
  on public.venue_change_requests (created_at desc) where status = 'pending';
create index if not exists vcr_venue_idx
  on public.venue_change_requests (venue_id);

-- updated_at maintenance reuses the shared trigger fn (see 045/046/063).
drop trigger if exists venue_change_requests_set_updated_at on public.venue_change_requests;
create trigger venue_change_requests_set_updated_at
  before update on public.venue_change_requests
  for each row execute function public.tg_set_updated_at();

alter table public.venue_change_requests enable row level security;

drop policy if exists "users insert own change requests" on public.venue_change_requests;
drop policy if exists "users read own change requests"   on public.venue_change_requests;
drop policy if exists "admins read all change requests"  on public.venue_change_requests;
drop policy if exists "admins update change requests"    on public.venue_change_requests;

-- Users submit and read their own requests. Writes go through the
-- security-definer RPC below, but these policies keep direct reads scoped.
create policy "users insert own change requests" on public.venue_change_requests
  for insert with check (submitted_by = auth.uid());

create policy "users read own change requests" on public.venue_change_requests
  for select using (submitted_by = auth.uid());

create policy "admins read all change requests" on public.venue_change_requests
  for select using (public.is_current_user_admin());

create policy "admins update change requests" on public.venue_change_requests
  for update using (public.is_current_user_admin());

-- ======================================================================
-- RPCs
-- ======================================================================

-- Submit (or refresh) a change request. SECURITY DEFINER so the
-- ON CONFLICT DO UPDATE path works when a user re-submits for the same
-- venue (a plain INSERT policy can't authorize the conflict-update branch).
-- submitted_by is forced to auth.uid(), so a user can only touch their own row.
create or replace function public.submit_venue_change_request(
  p_venue_id          integer,
  p_nets              boolean default null,
  p_night_lighting    boolean default null,
  p_tables_count      integer default null,
  p_mark_unavailable  boolean default false,
  p_note              text    default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_nets is null and p_night_lighting is null and p_tables_count is null
     and coalesce(p_mark_unavailable, false) = false then
    raise exception 'empty_change_request' using errcode = 'P0001';
  end if;

  insert into public.venue_change_requests
    (venue_id, submitted_by, proposed_nets, proposed_night_lighting,
     proposed_tables_count, mark_unavailable, note)
  values
    (p_venue_id, v_uid, p_nets, p_night_lighting, p_tables_count,
     coalesce(p_mark_unavailable, false), nullif(btrim(p_note), ''))
  on conflict (submitted_by, venue_id) do update
    set proposed_nets           = excluded.proposed_nets,
        proposed_night_lighting = excluded.proposed_night_lighting,
        proposed_tables_count   = excluded.proposed_tables_count,
        mark_unavailable        = excluded.mark_unavailable,
        note                    = excluded.note,
        status                  = 'pending',
        resolution              = null,
        reviewed_by             = null,
        reviewed_at             = null,
        created_at              = now(),
        updated_at              = now()
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.submit_venue_change_request is
  'Submit/refresh a venue change request. Re-submitting for the same venue reopens the existing row instead of creating a duplicate.';

grant execute on function public.submit_venue_change_request(integer, boolean, boolean, integer, boolean, text) to authenticated;

-- Resolve a change request: apply the admin-accepted fields to the venue,
-- optionally hide or remove the venue, and record the per-field decision.
-- Admin-gated and transactional. p_availability is 'none' | 'hide' | 'remove'.
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
  if not public.is_current_user_admin() then
    raise exception 'Unauthorized';
  end if;

  if v_avail not in ('none', 'hide', 'remove') then
    raise exception 'Invalid availability action: %', v_avail;
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
  'Admin-only: apply accepted fields from a venue change request, optionally hide/remove the venue, record the decision, and audit. Returns the resulting status.';

grant execute on function public.resolve_venue_change_request(bigint, boolean, boolean, boolean, text) to authenticated;

NOTIFY pgrst, 'reload schema';
