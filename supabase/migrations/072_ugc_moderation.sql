-- User-facing moderation primitives: reports and blocks.
--
-- Design notes
-- ============
-- - Apple App Store §1.2 requires UGC apps to let users *report*
--   objectionable content AND *block* other users. TTPortal has reviews,
--   check-ins, photos, and a friend graph — that's UGC. See
--   appstore_requirements.md Phase 5 for the full plan.
-- - content_reports is the general report queue. Any UGC type can be
--   reported by referencing (content_type, content_id). We treat
--   content_id as text so a single table can hold references to tables
--   that use bigint, uuid, or other id types. A unique(reporter, type,
--   id) constraint prevents the same user from reporting the same item
--   twice.
-- - user_blocks is a directed relationship — A blocks B means A doesn't
--   want to see B's content. Blocking is one-way; B might not know.
-- - Reports always set reviews.flagged = true when content_type =
--   'review', so existing admin tooling that filters flagged reviews
--   continues to work without a new query.
-- - Block effect on visibility is implemented at the SERVICE layer (a
--   join against user_blocks excludes blocked users' content from the
--   blocker's feeds). We do NOT do this in RLS, because RLS that
--   references user_blocks would explode every read query's plan, and
--   the blocker's own client is the audience we care about — the
--   blocked user can still see their own content (they don't know
--   they're blocked), which is the expected UX.
-- - We don't unfriend automatically on block. Block + unfriend is two
--   separate buttons; the user can choose.

-- ======================================================================
-- content_reports
-- ======================================================================

create table if not exists public.content_reports (
  id            bigserial primary key,
  reporter_id   uuid not null references auth.users(id) on delete cascade,
  content_type  text not null check (
    content_type in ('review', 'venue', 'checkin', 'photo', 'profile')
  ),
  content_id    text not null,
  reason        text not null check (
    reason in ('spam', 'harassment', 'hate_speech',
               'sexual_content', 'misinformation', 'other')
  ),
  notes         text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolution    text,
  unique (reporter_id, content_type, content_id)
);

comment on table public.content_reports is
  'User reports of objectionable UGC. One row per (reporter, content_type, content_id). Resolved fields filled in by admins.';

create index if not exists content_reports_unresolved_idx
  on public.content_reports (created_at desc)
  where resolved_at is null;

create index if not exists content_reports_content_idx
  on public.content_reports (content_type, content_id);

alter table public.content_reports enable row level security;

drop policy if exists "users insert own reports"   on public.content_reports;
drop policy if exists "users read own reports"     on public.content_reports;
drop policy if exists "admins read all reports"    on public.content_reports;
drop policy if exists "admins update reports"      on public.content_reports;

create policy "users insert own reports" on public.content_reports
  for insert
  with check (reporter_id = auth.uid());

create policy "users read own reports" on public.content_reports
  for select
  using (reporter_id = auth.uid());

create policy "admins read all reports" on public.content_reports
  for select
  using (
    exists (select 1 from public.profiles
             where id = auth.uid() and is_admin = true)
  );

create policy "admins update reports" on public.content_reports
  for update
  using (
    exists (select 1 from public.profiles
             where id = auth.uid() and is_admin = true)
  );

-- ======================================================================
-- user_blocks
-- ======================================================================

create table if not exists public.user_blocks (
  id          bigserial primary key,
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

comment on table public.user_blocks is
  'Directed user block: blocker_id has chosen not to see blocked_id''s content. Service-layer filters exclude blocked users from the blocker''s feeds.';

create index if not exists user_blocks_blocker_idx
  on public.user_blocks (blocker_id);

alter table public.user_blocks enable row level security;

drop policy if exists "users read own blocks"   on public.user_blocks;
drop policy if exists "users insert own blocks" on public.user_blocks;
drop policy if exists "users delete own blocks" on public.user_blocks;

create policy "users read own blocks" on public.user_blocks
  for select
  using (blocker_id = auth.uid());

create policy "users insert own blocks" on public.user_blocks
  for insert
  with check (blocker_id = auth.uid());

create policy "users delete own blocks" on public.user_blocks
  for delete
  using (blocker_id = auth.uid());

-- ======================================================================
-- RPCs
-- ======================================================================

create or replace function public.report_content(
  p_content_type text,
  p_content_id   text,
  p_reason       text,
  p_notes        text default null
) returns bigint
language plpgsql
security invoker
as $$
declare
  v_uid uuid := auth.uid();
  v_report_id bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.content_reports
    (reporter_id, content_type, content_id, reason, notes)
  values
    (v_uid, p_content_type, p_content_id, p_reason, p_notes)
  on conflict (reporter_id, content_type, content_id) do update
    set reason     = excluded.reason,
        notes      = excluded.notes,
        created_at = now(),
        resolved_at = null,
        resolution = null
  returning id into v_report_id;

  -- Surface review flags into the existing reviews.flagged column so
  -- legacy admin views light up immediately.
  if p_content_type = 'review' then
    update public.reviews
       set flagged = true
     where id = p_content_id::bigint;
  end if;

  return v_report_id;
end;
$$;

comment on function public.report_content is
  'Submit a moderation report. Same user reporting the same item twice updates the existing row instead of creating a duplicate.';

grant execute on function public.report_content to authenticated;

create or replace function public.block_user(p_target_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_uid = p_target_id then
    raise exception 'cannot_block_self' using errcode = 'P0001';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_uid, p_target_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

comment on function public.block_user is
  'Block another user. Idempotent: re-calling does nothing.';

grant execute on function public.block_user to authenticated;

create or replace function public.unblock_user(p_target_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from public.user_blocks
   where blocker_id = v_uid
     and blocked_id = p_target_id;
end;
$$;

comment on function public.unblock_user is
  'Remove a block. Safe to call when not blocked (no-op).';

grant execute on function public.unblock_user to authenticated;

create or replace function public.get_blocked_users()
returns table (
  user_id     uuid,
  username    text,
  full_name   text,
  avatar_url  text,
  blocked_at  timestamptz
)
language sql
security invoker
stable
as $$
  select p.id, p.username, p.full_name, p.avatar_url, b.created_at
    from public.user_blocks b
    join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc;
$$;

comment on function public.get_blocked_users is
  'List the calling user''s active blocks with the blocked profile''s display info.';

grant execute on function public.get_blocked_users to authenticated;
