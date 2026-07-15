-- Account deletion with a 30-day grace period.
--
-- Design notes
-- ============
-- - Google Play and Apple require apps that let users create accounts to
--   also let them delete those accounts in-app (and via a web URL, per
--   Google). When you delete an account, the user's data must also be
--   deleted. See appstore_requirements.md Phase 4 for the full plan.
-- - The grace period is for the *user*, not the regulator: a 30-day soft
--   window lets a user undo an accidental delete by signing back in. The
--   hard delete itself is what satisfies the policy requirement.
-- - The soft-delete state lives in profiles.pending_deletion_at. Two
--   user-facing RPCs flip it (request_account_deletion,
--   cancel_account_deletion). A third function
--   hard_delete_expired_accounts() runs on a cron and actually removes
--   the auth.users row, which cascades to profiles and from there to
--   every user-owned table via existing ON DELETE CASCADE FKs.
-- - Shared content (reviews, venues.submitted_by, feature_requests
--   authorship, notifications.sender_id, audit logs) is already wired
--   with ON DELETE SET NULL so deletion anonymizes those rows rather
--   than orphaning them. We rely on the existing FK behavior; nothing
--   to change here.
-- - During the grace period the user retains normal app access; the UI
--   shows a banner with a cancel option. We deliberately do NOT add RLS
--   blocking writes during the grace window — that would surprise users
--   who haven't yet realized they want to cancel.
-- - hard_delete_expired_accounts is SECURITY DEFINER because deleting
--   from auth.users requires elevated privileges. It accepts no
--   parameters and only operates on rows whose pending_deletion_at has
--   actually expired, so it cannot be abused even if reachable.

alter table public.profiles
  add column if not exists pending_deletion_at timestamptz;

comment on column public.profiles.pending_deletion_at is
  'When set, the user has requested account deletion. They can cancel by '
  'calling cancel_account_deletion() before this timestamp. After this '
  'timestamp, hard_delete_expired_accounts() will delete the auth.users '
  'row (which cascades to this profile and all user-owned content).';

create index if not exists profiles_pending_deletion_at_idx
  on public.profiles (pending_deletion_at)
  where pending_deletion_at is not null;

-- ----------------------------------------------------------------------
-- User-facing RPCs
-- ----------------------------------------------------------------------

create or replace function public.request_account_deletion()
returns timestamptz
language plpgsql
security invoker
as $$
declare
  v_uid uuid := auth.uid();
  v_deletion_at timestamptz := now() + interval '30 days';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.profiles
     set pending_deletion_at = v_deletion_at
   where id = v_uid;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return v_deletion_at;
end;
$$;

comment on function public.request_account_deletion is
  'Soft-delete the calling user''s account. Returns the timestamp at '
  'which the hard delete will run (now + 30 days). Idempotent: calling '
  'twice does not double the grace window — it resets it to 30 days '
  'from the most recent call.';

grant execute on function public.request_account_deletion to authenticated;

create or replace function public.cancel_account_deletion()
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

  update public.profiles
     set pending_deletion_at = null
   where id = v_uid;
end;
$$;

comment on function public.cancel_account_deletion is
  'Clear the calling user''s pending deletion. Safe to call when there '
  'is no pending deletion (no-op).';

grant execute on function public.cancel_account_deletion to authenticated;

-- ----------------------------------------------------------------------
-- Scheduled hard-delete
-- ----------------------------------------------------------------------

create or replace function public.hard_delete_expired_accounts()
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_deleted_count integer := 0;
  v_user_id uuid;
begin
  for v_user_id in
    select id
      from public.profiles
     where pending_deletion_at is not null
       and pending_deletion_at < now()
  loop
    -- Deleting from auth.users cascades to public.profiles (FK is
    -- ON DELETE CASCADE) and from there to every user-owned table.
    -- Shared-content tables already have ON DELETE SET NULL on their
    -- author/submitter columns, so those rows are anonymized in place.
    delete from auth.users where id = v_user_id;
    v_deleted_count := v_deleted_count + 1;
  end loop;

  if v_deleted_count > 0 then
    raise notice 'hard_delete_expired_accounts: deleted % expired account(s)', v_deleted_count;
  end if;

  return v_deleted_count;
end;
$$;

comment on function public.hard_delete_expired_accounts is
  'Cron entry point. Iterates profiles where pending_deletion_at has '
  'elapsed and deletes the corresponding auth.users row (which cascades '
  'to all owned data). Returns the number of accounts hard-deleted.';

-- Only the postgres / service_role should ever invoke this. revoke from
-- PUBLIC just to be explicit; nothing else gets access by default.
revoke all on function public.hard_delete_expired_accounts from public;

-- ----------------------------------------------------------------------
-- Schedule: run daily. pg_cron is enabled on Supabase by default. If
-- your project doesn't have it, run the function from an Edge Function
-- on a schedule or from an external cron.
-- ----------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Drop any previous schedule with this name so re-running this
    -- migration is idempotent.
    perform cron.unschedule(jobid)
       from cron.job
      where jobname = 'hard_delete_expired_accounts';

    perform cron.schedule(
      'hard_delete_expired_accounts',
      '11 4 * * *',  -- 04:11 UTC daily
      $cron$select public.hard_delete_expired_accounts()$cron$
    );
  end if;
end $$;
