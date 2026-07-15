-- Supabase migration: Table Tennis Challenge System
-- Includes: enums, tables, indexes, triggers, RLS, helper functions, seed helper views

create extension if not exists pgcrypto;

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challenge_category') THEN
    CREATE TYPE public.challenge_category AS ENUM (
      'craft_player',
      'spin_artist',
      'first_attack_burst',
      'footwork_engine',
      'table_guardian',
      'serve_lab',
      'competitor',
      'explorer'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_type') THEN
    CREATE TYPE public.verification_type AS ENUM ('self', 'other');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
    CREATE TYPE public.submission_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'auto_approved',
      'expired'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
    CREATE TYPE public.assignment_status AS ENUM (
      'active',
      'completed',
      'expired',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'validation_status') THEN
    CREATE TYPE public.validation_status AS ENUM (
      'pending',
      'approved',
      'rejected'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'badge_level') THEN
    CREATE TYPE public.badge_level AS ENUM (
      'none',
      'bronze',
      'silver',
      'gold',
      'master'
    );
  END IF;
END $$;

-- Core catalog
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  legacy_code text,
  title_key text,
  category public.challenge_category not null,
  title text not null,
  description text,
  verification_type public.verification_type not null,
  is_active boolean not null default true,
  difficulty_score smallint,
  monthly_weight smallint not null default 1,
  cooldown_hours integer not null default 0,
  per_day_cap smallint not null default 1,
  requires_proof boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint challenges_code_format_chk check (code ~ '^(CRF|SPN|ATK|FTW|DEF|SRV|CMP|EXP)[0-9]{3}$'),
  constraint challenges_legacy_code_format_chk check (
    legacy_code is null or legacy_code ~ '^(BRZ|SLV|GLD)[0-9]{3}$'
  ),
  constraint challenges_title_not_blank_chk check (length(trim(title)) > 0),
  constraint challenges_difficulty_score_chk check (
    difficulty_score is null or difficulty_score between 1 and 100
  ),
  constraint challenges_monthly_weight_chk check (monthly_weight between 1 and 10),
  constraint challenges_per_day_cap_chk check (per_day_cap between 1 and 100)
);

alter table public.challenges
  add column if not exists title_key text;
alter table public.challenges
  drop constraint if exists challenges_legacy_code_key;

create index if not exists challenges_category_idx on public.challenges(category);
create index if not exists challenges_verification_type_idx on public.challenges(verification_type);
create index if not exists challenges_active_category_idx on public.challenges(is_active, category);
create unique index if not exists challenges_title_key_uidx
  on public.challenges(title_key)
  where title_key is not null;
create unique index if not exists challenges_category_legacy_code_uidx
  on public.challenges(category, legacy_code)
  where legacy_code is not null;

-- User badge progress
create table if not exists public.user_badge_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category public.challenge_category not null,
  completed_count integer not null default 0,
  approved_count integer not null default 0,
  xp integer not null default 0,
  badge_level public.badge_level not null default 'none',
  last_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_badge_progress_unique unique (user_id, category),
  constraint user_badge_progress_counts_chk check (
    completed_count >= 0 and approved_count >= 0 and xp >= 0
  )
);

create index if not exists user_badge_progress_user_idx on public.user_badge_progress(user_id);
create index if not exists user_badge_progress_level_idx on public.user_badge_progress(badge_level);

-- Challenge assignments
create table if not exists public.challenge_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  assigned_for_month date not null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  status public.assignment_status not null default 'active',
  source text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  constraint challenge_assignments_unique unique (user_id, challenge_id, assigned_for_month)
);

create index if not exists challenge_assignments_user_month_idx on public.challenge_assignments(user_id, assigned_for_month);
create index if not exists challenge_assignments_status_idx on public.challenge_assignments(status);

-- Submissions
create table if not exists public.challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  assignment_id uuid references public.challenge_assignments(id) on delete set null,
  event_id integer references public.events(id) on delete set null,
  status public.submission_status not null default 'pending',
  verification_type public.verification_type not null,
  occurred_at timestamptz,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  proof_text text,
  proof_urls jsonb not null default '[]'::jsonb,
  notes text,
  auto_review_reason text,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  constraint challenge_submissions_proof_urls_array_chk check (jsonb_typeof(proof_urls) = 'array')
);

alter table public.challenge_submissions
  add column if not exists event_id integer references public.events(id) on delete set null;

create index if not exists challenge_submissions_user_idx on public.challenge_submissions(user_id);
create index if not exists challenge_submissions_challenge_idx on public.challenge_submissions(challenge_id);
create index if not exists challenge_submissions_status_idx on public.challenge_submissions(status);
create index if not exists challenge_submissions_user_challenge_idx on public.challenge_submissions(user_id, challenge_id);
create index if not exists challenge_submissions_event_idx on public.challenge_submissions(event_id);
create unique index if not exists challenge_submissions_one_approved_per_user_challenge_uidx
  on public.challenge_submissions(user_id, challenge_id)
  where status in ('approved', 'auto_approved');

-- Peer validations
create table if not exists public.challenge_validations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.challenge_submissions(id) on delete cascade,
  validator_user_id uuid not null references auth.users(id) on delete cascade,
  status public.validation_status not null default 'pending',
  responded_at timestamptz,
  comment text,
  created_at timestamptz not null default now(),
  constraint challenge_validations_unique unique (submission_id, validator_user_id)
);

create index if not exists challenge_validations_submission_idx on public.challenge_validations(submission_id);
create index if not exists challenge_validations_validator_idx on public.challenge_validations(validator_user_id);

-- Seasonal mastery history
create table if not exists public.challenge_master_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id text not null,
  awarded_at timestamptz not null default now(),
  badge_snapshot jsonb not null default '{}'::jsonb,
  constraint challenge_master_history_unique unique (user_id, season_id)
);

create index if not exists challenge_master_history_user_idx on public.challenge_master_history(user_id);

-- Utility triggers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_submission_verification_type()
returns trigger
language plpgsql
as $$
begin
  if new.verification_type is null then
    select c.verification_type into new.verification_type
    from public.challenges c
    where c.id = new.challenge_id;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_self_validation()
returns trigger
language plpgsql
as $$
declare
  v_submitter uuid;
begin
  select user_id into v_submitter
  from public.challenge_submissions
  where id = new.submission_id;

  if v_submitter = new.validator_user_id then
    raise exception 'validator cannot be the submitter';
  end if;

  return new;
end;
$$;

create or replace function public.recompute_badge_level(v_completed_count integer)
returns public.badge_level
language sql
immutable
as $$
  select case
    when v_completed_count >= 15 then 'gold'::public.badge_level
    when v_completed_count >= 10 then 'silver'::public.badge_level
    when v_completed_count >= 5 then 'bronze'::public.badge_level
    else 'none'::public.badge_level
  end;
$$;

create or replace function public.challenge_xp_value(v_code text)
returns integer
language sql
immutable
as $$
  select case
    when v_code ~ '^.*00[1-9]$|^.*0[1-3][0-9]$|^.*1[0-4][0-9]$' then 50
    else 100
  end;
$$;

-- Badge progress sync from approved submissions
create or replace function public.sync_badge_progress_from_submission(v_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_category public.challenge_category;
  v_submitted_at timestamptz;
  v_total integer;
  v_xp integer;
  v_level public.badge_level;
begin
  select s.user_id, c.category, s.submitted_at
    into v_user_id, v_category, v_submitted_at
  from public.challenge_submissions s
  join public.challenges c on c.id = s.challenge_id
  where s.id = v_submission_id
    and s.status in ('approved', 'auto_approved');

  if v_user_id is null then
    return;
  end if;

  select count(*)::integer,
         coalesce(sum(case
           when ch.legacy_code like 'BRZ%' then 50
           when ch.legacy_code like 'SLV%' then 150
           when ch.legacy_code like 'GLD%' then 400
           else 100
         end), 0)::integer
    into v_total, v_xp
  from public.challenge_submissions s
  join public.challenges ch on ch.id = s.challenge_id
  where s.user_id = v_user_id
    and ch.category = v_category
    and s.status in ('approved', 'auto_approved');

  v_level := public.recompute_badge_level(v_total);

  insert into public.user_badge_progress (
    user_id, category, completed_count, approved_count, xp, badge_level, last_completed_at
  )
  values (
    v_user_id, v_category, v_total, v_total, v_xp, v_level, v_submitted_at
  )
  on conflict (user_id, category)
  do update set
    completed_count = excluded.completed_count,
    approved_count = excluded.approved_count,
    xp = excluded.xp,
    badge_level = excluded.badge_level,
    last_completed_at = greatest(public.user_badge_progress.last_completed_at, excluded.last_completed_at),
    updated_at = now();
end;
$$;

create or replace function public.handle_submission_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('approved', 'auto_approved')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.sync_badge_progress_from_submission(new.id);
  end if;
  return new;
end;
$$;

-- Approval / rejection functions
create or replace function public.approve_self_submission(v_submission_id uuid)
returns public.challenge_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.challenge_submissions;
  v_challenge public.challenges;
begin
  select * into v_submission
  from public.challenge_submissions
  where id = v_submission_id;

  if not found then
    raise exception 'submission not found';
  end if;

  if v_submission.user_id <> auth.uid() then
    raise exception 'not allowed to approve this self submission';
  end if;

  select * into v_challenge
  from public.challenges
  where id = v_submission.challenge_id;

  if v_challenge.verification_type <> 'self' then
    raise exception 'submission is not self-verifiable';
  end if;

  update public.challenge_submissions
  set status = case when v_challenge.requires_proof then 'pending' else 'auto_approved' end,
      auto_review_reason = case when v_challenge.requires_proof then null else 'self challenge auto-approved' end,
      reviewed_at = case when v_challenge.requires_proof then null else now() end
  where id = v_submission_id
  returning * into v_submission;

  return v_submission;
end;
$$;

create or replace function public.respond_to_validation(
  v_submission_id uuid,
  v_status public.validation_status,
  v_comment text default null
)
returns public.challenge_validations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_validation public.challenge_validations;
  v_total_approved integer;
  v_total_rejected integer;
begin
  update public.challenge_validations
  set status = v_status,
      responded_at = now(),
      comment = coalesce(v_comment, comment)
  where submission_id = v_submission_id
    and validator_user_id = auth.uid()
  returning * into v_validation;

  if not found then
    raise exception 'validation request not found';
  end if;

  select count(*) filter (where status = 'approved'),
         count(*) filter (where status = 'rejected')
    into v_total_approved, v_total_rejected
  from public.challenge_validations
  where submission_id = v_submission_id;

  if v_total_rejected > 0 then
    update public.challenge_submissions
    set status = 'rejected', reviewed_at = now(), reviewer_user_id = auth.uid()
    where id = v_submission_id and status = 'pending';
  elsif v_total_approved >= 1 then
    update public.challenge_submissions
    set status = 'approved', reviewed_at = now(), reviewer_user_id = auth.uid()
    where id = v_submission_id and status = 'pending';
  end if;

  return v_validation;
end;
$$;

create or replace function public.request_other_player_validation(
  v_submission_id uuid,
  v_validator_user_id uuid
)
returns public.challenge_validations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.challenge_submissions;
  v_validation public.challenge_validations;
begin
  select * into v_submission
  from public.challenge_submissions
  where id = v_submission_id;

  if not found then
    raise exception 'submission not found';
  end if;

  if v_submission.user_id <> auth.uid() then
    raise exception 'not allowed to request validation for this submission';
  end if;

  if v_submission.verification_type <> 'other' then
    raise exception 'submission does not require other-player validation';
  end if;

  if v_submission.event_id is not null and not exists (
    select 1
    from public.event_participants ep
    where ep.event_id = v_submission.event_id
      and ep.user_id = v_validator_user_id
    union
    select 1
    from public.events e
    where e.id = v_submission.event_id
      and e.organizer_id = v_validator_user_id
  ) then
    raise exception 'validator must be part of the linked event';
  end if;

  insert into public.challenge_validations (submission_id, validator_user_id)
  values (v_submission_id, v_validator_user_id)
  on conflict (submission_id, validator_user_id)
  do update set status = 'pending', responded_at = null
  returning * into v_validation;

  return v_validation;
end;
$$;

create or replace function public.get_challenge_choices(
  v_category public.challenge_category,
  v_limit_count integer default 4
)
returns table (
  id uuid,
  code text,
  legacy_code text,
  title_key text,
  category public.challenge_category,
  title text,
  description text,
  verification_type public.verification_type,
  requires_proof boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  return query
  select
    c.id,
    c.code,
    c.legacy_code,
    c.title_key,
    c.category,
    c.title,
    c.description,
    c.verification_type,
    c.requires_proof
  from public.challenges c
  where c.is_active = true
    and c.category = v_category
    and not exists (
      select 1
      from public.challenge_submissions s
      where s.user_id = auth.uid()
        and s.challenge_id = c.id
        and s.status in ('approved', 'auto_approved')
    )
  order by random()
  limit greatest(1, least(coalesce(v_limit_count, 4), 20));
end;
$$;

-- Triggers
DROP TRIGGER IF EXISTS set_updated_at_challenges ON public.challenges;
CREATE TRIGGER set_updated_at_challenges
BEFORE UPDATE ON public.challenges
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_user_badge_progress ON public.user_badge_progress;
CREATE TRIGGER set_updated_at_user_badge_progress
BEFORE UPDATE ON public.user_badge_progress
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_submission_verification_type_on_insert ON public.challenge_submissions;
CREATE TRIGGER set_submission_verification_type_on_insert
BEFORE INSERT ON public.challenge_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_submission_verification_type();

DROP TRIGGER IF EXISTS prevent_self_validation_on_insert ON public.challenge_validations;
CREATE TRIGGER prevent_self_validation_on_insert
BEFORE INSERT ON public.challenge_validations
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_validation();

DROP TRIGGER IF EXISTS submission_status_sync_progress_ins ON public.challenge_submissions;
CREATE TRIGGER submission_status_sync_progress_ins
AFTER INSERT ON public.challenge_submissions
FOR EACH ROW EXECUTE FUNCTION public.handle_submission_status_change();

DROP TRIGGER IF EXISTS submission_status_sync_progress_upd ON public.challenge_submissions;
CREATE TRIGGER submission_status_sync_progress_upd
AFTER UPDATE OF status ON public.challenge_submissions
FOR EACH ROW EXECUTE FUNCTION public.handle_submission_status_change();

-- RLS
alter table public.challenges enable row level security;
alter table public.user_badge_progress enable row level security;
alter table public.challenge_assignments enable row level security;
alter table public.challenge_submissions enable row level security;
alter table public.challenge_validations enable row level security;
alter table public.challenge_master_history enable row level security;

-- challenges: public read, service-role write
DROP POLICY IF EXISTS "challenges are readable by authenticated users" ON public.challenges;
CREATE POLICY "challenges are readable by authenticated users"
ON public.challenges
FOR SELECT
TO authenticated
USING (is_active = true);

-- user_badge_progress
DROP POLICY IF EXISTS "users read own badge progress" ON public.user_badge_progress;
CREATE POLICY "users read own badge progress"
ON public.user_badge_progress
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- assignments
DROP POLICY IF EXISTS "users read own assignments" ON public.challenge_assignments;
CREATE POLICY "users read own assignments"
ON public.challenge_assignments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- submissions
DROP POLICY IF EXISTS "users read own submissions" ON public.challenge_submissions;
CREATE POLICY "users read own submissions"
ON public.challenge_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users create own submissions" ON public.challenge_submissions;
CREATE POLICY "users create own submissions"
ON public.challenge_submissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own pending submissions" ON public.challenge_submissions;
CREATE POLICY "users update own pending submissions"
ON public.challenge_submissions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id and status = 'pending')
WITH CHECK (auth.uid() = user_id and status = 'pending');

-- validations
DROP POLICY IF EXISTS "validators read relevant validations" ON public.challenge_validations;
CREATE POLICY "validators read relevant validations"
ON public.challenge_validations
FOR SELECT
TO authenticated
USING (
  validator_user_id = auth.uid()
  or exists (
    select 1
    from public.challenge_submissions s
    where s.id = submission_id
      and s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "submitter can request validation" ON public.challenge_validations;
CREATE POLICY "submitter can request validation"
ON public.challenge_validations
FOR INSERT
TO authenticated
WITH CHECK (
  exists (
    select 1
    from public.challenge_submissions s
    where s.id = submission_id
      and s.user_id = auth.uid()
      and s.verification_type = 'other'
  )
  and validator_user_id <> auth.uid()
);

DROP POLICY IF EXISTS "validator can answer own validation" ON public.challenge_validations;
CREATE POLICY "validator can answer own validation"
ON public.challenge_validations
FOR UPDATE
TO authenticated
USING (validator_user_id = auth.uid())
WITH CHECK (validator_user_id = auth.uid());

-- mastery history
DROP POLICY IF EXISTS "users read own mastery history" ON public.challenge_master_history;
CREATE POLICY "users read own mastery history"
ON public.challenge_master_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Seed helper view (useful for import validation)
create or replace view public.challenge_catalog_export_template as
select
  null::text as code,
  null::text as legacy_code,
  null::text as title_key,
  null::public.challenge_category as category,
  null::text as title,
  null::text as description,
  null::public.verification_type as verification_type,
  false::boolean as requires_proof,
  1::smallint as monthly_weight,
  0::integer as cooldown_hours,
  1::smallint as per_day_cap,
  null::smallint as difficulty_score,
  '{}'::jsonb as metadata;

comment on table public.challenges is 'Challenge catalog seeded from category-coded JSON export.';
comment on table public.challenge_submissions is 'User claims of completing assigned or catalog challenges.';
comment on table public.challenge_validations is 'Peer review requests for other-player verified challenges.';
comment on function public.approve_self_submission(uuid) is 'Auto-approves self challenges when proof is not required.';
comment on function public.respond_to_validation(uuid, public.validation_status, text) is 'Validator approves or rejects another player submission.';
comment on function public.get_challenge_choices(public.challenge_category, integer) is 'Returns fresh active challenges for the current user/category, excluding already approved completions.';

grant execute on function public.get_challenge_choices(public.challenge_category, integer) to authenticated;
grant execute on function public.approve_self_submission(uuid) to authenticated;
grant execute on function public.request_other_player_validation(uuid, uuid) to authenticated;
grant execute on function public.respond_to_validation(uuid, public.validation_status, text) to authenticated;
