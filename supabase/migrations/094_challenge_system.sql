-- Migration: 094_challenge_system
-- Brings the challenge system into the tracked migration chain.
--
-- The challenge SQL in supabase/challenge-system/ was applied to prod
-- MANUALLY, outside the chain — so the schema exists in prod but not in
-- migration history, and migrations 026/079 depend on it. Per the
-- history-immutability rule (000–081 are applied and frozen), this lands
-- as a NEW migration rather than a backdated one.
--
-- Prod-safety: everything here is idempotent against the already-applied
-- state — IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS
-- throughout, and the seed uses ON CONFLICT (code) DO NOTHING (the
-- original DO UPDATE would have reverted migration 079's title rewording).
-- Fresh-environment note: a clean `db reset` still fails at 026 until a
-- prod baseline is cut (T021) — history immutability makes the early
-- chain unreplayable by design.
--
-- Contents, in order:
--   challenge-system/001_challenge_system_migration.sql  (verbatim)
--   challenge-system/002_challenge_seed.sql              (DO NOTHING seed)
--   challenge-system/004_challenge_validation_helpers.sql (verbatim)
-- plus a re-run of 089's search_path pin, since the CREATE OR REPLACE
-- statements above would otherwise leave these definer functions unpinned.

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

-- ====== challenge-system/002_challenge_seed.sql (DO NOTHING variant) ======
-- Seed catalog into public.challenges
-- Generated from challenge_catalog_category_codes.json

insert into public.challenges (code, legacy_code, category, title, verification_type)
values
  ('CRF001', 'BRZ004', 'craft_player'::public.challenge_category, 'Play a session longer than two hours', 'other'::public.verification_type),
  ('CRF002', 'BRZ005', 'craft_player'::public.challenge_category, 'Be as fairplay as Timo Boll', 'self'::public.verification_type),
  ('CRF003', 'BRZ011', 'craft_player'::public.challenge_category, 'Play 3 matches in one day', 'other'::public.verification_type),
  ('CRF004', 'BRZ013', 'craft_player'::public.challenge_category, 'Try a new rubber or paddle', 'other'::public.verification_type),
  ('CRF005', 'BRZ014', 'craft_player'::public.challenge_category, 'Warm up properly before a match', 'self'::public.verification_type),
  ('CRF006', 'BRZ017', 'craft_player'::public.challenge_category, 'Play a full set without arguing any point', 'self'::public.verification_type),
  ('CRF007', 'BRZ020', 'craft_player'::public.challenge_category, 'Do 20 shadow swings before a match', 'self'::public.verification_type),
  ('CRF008', 'BRZ024', 'craft_player'::public.challenge_category, 'Play one match without checking your phone', 'self'::public.verification_type),
  ('CRF009', 'BRZ147', 'craft_player'::public.challenge_category, 'Use a reset routine between 5 consecutive points', 'self'::public.verification_type),
  ('CRF010', 'SLV003', 'craft_player'::public.challenge_category, 'Play a set with your non-dominant hand', 'other'::public.verification_type),
  ('CRF011', 'SLV019', 'craft_player'::public.challenge_category, 'Win 5 points in a row', 'other'::public.verification_type),
  ('CRF012', 'SLV033', 'craft_player'::public.challenge_category, 'Play a set without looking at the score', 'self'::public.verification_type),
  ('CRF013', 'SLV034', 'craft_player'::public.challenge_category, 'Play a match using only 50% power', 'other'::public.verification_type),
  ('CRF014', 'SLV137', 'craft_player'::public.challenge_category, 'Play a set without a direct serve or receive error', 'self'::public.verification_type),
  ('CRF015', 'SLV147', 'craft_player'::public.challenge_category, 'Win 2 points in deuce situations during one match', 'other'::public.verification_type),
  ('CRF016', 'GLD001', 'craft_player'::public.challenge_category, 'Win 11-0', 'other'::public.verification_type),
  ('CRF017', 'GLD002', 'craft_player'::public.challenge_category, 'Win against Paul (comeback 0-2 → 3-2)', 'other'::public.verification_type),
  ('CRF018', 'GLD005', 'craft_player'::public.challenge_category, 'Full match only backhand', 'other'::public.verification_type),
  ('CRF019', 'GLD009', 'craft_player'::public.challenge_category, 'Win 3 matches in a row', 'other'::public.verification_type),
  ('CRF020', 'GLD010', 'craft_player'::public.challenge_category, 'Comeback from 0-2', 'other'::public.verification_type),
  ('CRF021', 'GLD014', 'craft_player'::public.challenge_category, 'Beat higher-rated player', 'other'::public.verification_type),
  ('CRF022', 'GLD015', 'craft_player'::public.challenge_category, 'Match without unforced errors', 'self'::public.verification_type),
  ('CRF023', 'GLD016', 'craft_player'::public.challenge_category, 'Win match 3-0', 'other'::public.verification_type),
  ('CRF024', 'GLD017', 'craft_player'::public.challenge_category, 'Win 5 matches in one day', 'other'::public.verification_type),
  ('CRF025', 'GLD019', 'craft_player'::public.challenge_category, 'Come back 5-10 → win set', 'other'::public.verification_type),
  ('CRF026', 'GLD020', 'craft_player'::public.challenge_category, 'Win final deciding set', 'other'::public.verification_type),
  ('CRF027', 'GLD021', 'craft_player'::public.challenge_category, 'Play blindfolded for 3 points', 'other'::public.verification_type),
  ('CRF028', 'GLD026', 'craft_player'::public.challenge_category, 'Whisper instead of talking for a full match', 'self'::public.verification_type),
  ('CRF029', 'GLD027', 'craft_player'::public.challenge_category, 'Play with music blasting in headphones', 'other'::public.verification_type),
  ('CRF030', 'GLD033', 'craft_player'::public.challenge_category, 'Let your opponent serve twice every point', 'self'::public.verification_type),
  ('CRF031', 'GLD138', 'craft_player'::public.challenge_category, 'Win a set from 8-8 or later without making an unforced error', 'self'::public.verification_type),
  ('CRF032', 'GLD145', 'craft_player'::public.challenge_category, 'Use a reset or timeout routine and come back to win a close match', 'other'::public.verification_type),
  ('CRF033', 'GLD146', 'craft_player'::public.challenge_category, 'Win a game after losing the first two points', 'other'::public.verification_type),
  ('SPN001', 'BRZ101', 'spin_artist'::public.challenge_category, 'Maintain a backspin rally of 10 shots', 'self'::public.verification_type),
  ('SPN002', 'BRZ102', 'spin_artist'::public.challenge_category, 'Land 5 controlled topspins against a passive block', 'self'::public.verification_type),
  ('SPN003', 'BRZ103', 'spin_artist'::public.challenge_category, 'Successfully return 5 sidespin serves', 'self'::public.verification_type),
  ('SPN004', 'BRZ136', 'spin_artist'::public.challenge_category, 'Place 5 backspin balls to a chosen target zone', 'self'::public.verification_type),
  ('SPN005', 'BRZ140', 'spin_artist'::public.challenge_category, 'Play one short push then one long push successfully 5 times', 'self'::public.verification_type),
  ('SPN006', 'SLV101', 'spin_artist'::public.challenge_category, 'Place 8 backspin shots alternately short and long', 'self'::public.verification_type),
  ('SPN007', 'SLV102', 'spin_artist'::public.challenge_category, 'Maintain a topspin rally of 15 shots', 'self'::public.verification_type),
  ('SPN008', 'SLV103', 'spin_artist'::public.challenge_category, 'Return sidespin serves with controlled placement 5 times', 'self'::public.verification_type),
  ('SPN009', 'SLV133', 'spin_artist'::public.challenge_category, 'Land 5 forehand topspins to 2 different target zones', 'self'::public.verification_type),
  ('SPN010', 'SLV145', 'spin_artist'::public.challenge_category, 'Change spin type during a rally and stay in the point', 'other'::public.verification_type),
  ('SPN011', 'GLD101', 'spin_artist'::public.challenge_category, 'Win a rally using at least 2 different spin types', 'other'::public.verification_type),
  ('SPN012', 'GLD102', 'spin_artist'::public.challenge_category, 'Win 3 points using topspin attacks under pressure', 'other'::public.verification_type),
  ('SPN013', 'GLD133', 'spin_artist'::public.challenge_category, 'Win a set by controlling the short game and opening first', 'other'::public.verification_type),
  ('SPN014', 'GLD142', 'spin_artist'::public.challenge_category, 'Win a rally with a counterloop from both forehand and backhand sides in one match', 'other'::public.verification_type),
  ('ATK001', 'BRZ110', 'first_attack_burst'::public.challenge_category, 'Win a point within first 3 shots', 'other'::public.verification_type),
  ('ATK002', 'BRZ111', 'first_attack_burst'::public.challenge_category, 'Execute 3 successful third-ball attacks', 'self'::public.verification_type),
  ('ATK003', 'BRZ134', 'first_attack_burst'::public.challenge_category, 'Open the rally with topspin after 2 pushes', 'self'::public.verification_type),
  ('ATK004', 'BRZ141', 'first_attack_burst'::public.challenge_category, 'Start the attack after receiving a long serve', 'self'::public.verification_type),
  ('ATK005', 'BRZ144', 'first_attack_burst'::public.challenge_category, 'Win a point by attacking the opponent’s elbow', 'other'::public.verification_type),
  ('ATK006', 'SLV110', 'first_attack_burst'::public.challenge_category, 'Win 3 points using serve + attack combination', 'other'::public.verification_type),
  ('ATK007', 'SLV111', 'first_attack_burst'::public.challenge_category, 'Land 5 controlled opening loops', 'self'::public.verification_type),
  ('ATK008', 'SLV134', 'first_attack_burst'::public.challenge_category, 'Win a point by attacking the wide forehand on the third ball', 'other'::public.verification_type),
  ('ATK009', 'SLV138', 'first_attack_burst'::public.challenge_category, 'Execute 3 successful backhand openings against backspin', 'self'::public.verification_type),
  ('ATK010', 'SLV139', 'first_attack_burst'::public.challenge_category, 'Serve short and win the point after a long return', 'other'::public.verification_type),
  ('ATK011', 'SLV144', 'first_attack_burst'::public.challenge_category, 'Win a point by attacking the opponent’s elbow', 'other'::public.verification_type),
  ('ATK012', 'GLD110', 'first_attack_burst'::public.challenge_category, 'Win 5 points directly from third-ball attack', 'other'::public.verification_type),
  ('ATK013', 'GLD111', 'first_attack_burst'::public.challenge_category, 'Win a set using aggressive first attacks', 'other'::public.verification_type),
  ('ATK014', 'GLD132', 'first_attack_burst'::public.challenge_category, 'Win 3 points using a serve + third-ball + fifth-ball pattern', 'other'::public.verification_type),
  ('ATK015', 'GLD135', 'first_attack_burst'::public.challenge_category, 'Win a point with a counterloop after the rally has already opened', 'other'::public.verification_type),
  ('ATK016', 'GLD140', 'first_attack_burst'::public.challenge_category, 'Win 3 points by attacking after a short receive exchange', 'other'::public.verification_type),
  ('FTW001', 'BRZ120', 'footwork_engine'::public.challenge_category, 'Complete 10 controlled side-to-side movements', 'self'::public.verification_type),
  ('FTW002', 'BRZ121', 'footwork_engine'::public.challenge_category, 'Return to ready position after every shot for 1 rally', 'self'::public.verification_type),
  ('FTW003', 'BRZ135', 'footwork_engine'::public.challenge_category, 'Serve and recover to ready position correctly 5 times', 'self'::public.verification_type),
  ('FTW004', 'BRZ139', 'footwork_engine'::public.challenge_category, 'Alternate 8 controlled placements from forehand to backhand', 'self'::public.verification_type),
  ('FTW005', 'BRZ144', 'footwork_engine'::public.challenge_category, 'Stay in a low ready stance for one full rally', 'self'::public.verification_type),
  ('FTW006', 'BRZ145', 'footwork_engine'::public.challenge_category, 'Backhand counter — 10 in a row', 'self'::public.verification_type),
  ('FTW007', 'BRZ146', 'footwork_engine'::public.challenge_category, 'Forehand counter — 10 in a row', 'self'::public.verification_type),
  ('FTW008', 'SLV120', 'footwork_engine'::public.challenge_category, 'Execute 3 successful pivot attacks', 'self'::public.verification_type),
  ('FTW009', 'SLV121', 'footwork_engine'::public.challenge_category, 'Maintain movement during a 10-shot rally', 'self'::public.verification_type),
  ('FTW010', 'SLV135', 'footwork_engine'::public.challenge_category, 'Pivot to attack and recover back into the rally successfully', 'self'::public.verification_type),
  ('FTW011', 'SLV141', 'footwork_engine'::public.challenge_category, 'Open with backhand topspin and recover to ready position', 'self'::public.verification_type),
  ('FTW012', 'SLV148', 'footwork_engine'::public.challenge_category, 'Maintain a forehand-backhand transition rally of 12 shots', 'self'::public.verification_type),
  ('FTW013', 'GLD120', 'footwork_engine'::public.challenge_category, 'Win 3 points using active footwork positioning', 'other'::public.verification_type),
  ('FTW014', 'GLD121', 'footwork_engine'::public.challenge_category, 'Recover position and win 3 extended rallies', 'other'::public.verification_type),
  ('DEF001', 'BRZ130', 'table_guardian'::public.challenge_category, 'Successfully block 5 shots in a row', 'self'::public.verification_type),
  ('DEF002', 'BRZ131', 'table_guardian'::public.challenge_category, 'Return 5 balls using defensive chop', 'self'::public.verification_type),
  ('DEF003', 'BRZ137', 'table_guardian'::public.challenge_category, 'Block 5 attacking balls back to the middle', 'self'::public.verification_type),
  ('DEF004', 'BRZ142', 'table_guardian'::public.challenge_category, 'Block 5 balls in a row back to the middle', 'self'::public.verification_type),
  ('DEF005', 'SLV130', 'table_guardian'::public.challenge_category, 'Block 10 shots in a rally', 'self'::public.verification_type),
  ('DEF006', 'SLV131', 'table_guardian'::public.challenge_category, 'Return 3 attacks using defensive lobs', 'self'::public.verification_type),
  ('DEF007', 'SLV136', 'table_guardian'::public.challenge_category, 'Block 6 balls deep while changing direction at least once', 'self'::public.verification_type),
  ('DEF008', 'SLV143', 'table_guardian'::public.challenge_category, 'Stay in the rally through 3 consecutive attacking balls', 'other'::public.verification_type),
  ('DEF009', 'GLD130', 'table_guardian'::public.challenge_category, 'Win 3 points by transitioning from defense to attack', 'other'::public.verification_type),
  ('DEF010', 'GLD131', 'table_guardian'::public.challenge_category, 'Win a point after defending with 3+ lobs', 'other'::public.verification_type),
  ('DEF011', 'GLD137', 'table_guardian'::public.challenge_category, 'Defend 3 attacks and then win the point with a counterattack', 'other'::public.verification_type),
  ('DEF012', 'GLD143', 'table_guardian'::public.challenge_category, 'Absorb both short and deep pressure in one rally, then win the point', 'other'::public.verification_type),
  ('SRV001', 'BRZ010', 'serve_lab'::public.challenge_category, 'Hold several balls in your pocket to serve as fast as Felix Lebrun', 'self'::public.verification_type),
  ('SRV002', 'BRZ023', 'serve_lab'::public.challenge_category, 'Learn and try one new serve', 'self'::public.verification_type),
  ('SRV003', 'BRZ039', 'serve_lab'::public.challenge_category, 'Serve 5 legal serves in a row', 'self'::public.verification_type),
  ('SRV004', 'BRZ132', 'serve_lab'::public.challenge_category, 'Serve 3 short balls that bounce twice on the opponent’s side', 'other'::public.verification_type),
  ('SRV005', 'BRZ138', 'serve_lab'::public.challenge_category, 'Land 5 short serves to the backhand half', 'self'::public.verification_type),
  ('SRV006', 'BRZ139', 'serve_lab'::public.challenge_category, 'Alternate 8 controlled placements from forehand to backhand', 'self'::public.verification_type),
  ('SRV007', 'SLV001', 'serve_lab'::public.challenge_category, 'Win a set serving only with the backhand', 'other'::public.verification_type),
  ('SRV008', 'SLV002', 'serve_lab'::public.challenge_category, 'Two consecutive successful tomahawk serves', 'self'::public.verification_type),
  ('SRV009', 'SLV009', 'serve_lab'::public.challenge_category, 'Attempt and win the point with a ghost serve', 'other'::public.verification_type),
  ('SRV010', 'SLV011', 'serve_lab'::public.challenge_category, 'Serve a reverse pendulum like Fan Zhendong', 'self'::public.verification_type),
  ('SRV011', 'SLV013', 'serve_lab'::public.challenge_category, 'Attempt a Ding Ning signature serve', 'self'::public.verification_type),
  ('SRV012', 'SLV016', 'serve_lab'::public.challenge_category, 'Do a very high toss service like Hugo Calderano', 'self'::public.verification_type),
  ('SRV013', 'SLV018', 'serve_lab'::public.challenge_category, 'Win a set using only long serves', 'other'::public.verification_type),
  ('SRV014', 'SLV020', 'serve_lab'::public.challenge_category, 'Successfully execute 3 different serves in one set', 'other'::public.verification_type),
  ('SRV015', 'SLV023', 'serve_lab'::public.challenge_category, 'Play a full set without missing a serve', 'other'::public.verification_type),
  ('SRV016', 'SLV032', 'serve_lab'::public.challenge_category, 'Only use serves you’ve never practiced', 'self'::public.verification_type),
  ('SRV017', 'GLD003', 'serve_lab'::public.challenge_category, 'Serve + pivot forehand like Ma Long', 'other'::public.verification_type),
  ('SRV018', 'GLD011', 'serve_lab'::public.challenge_category, 'Perfect serve set (no lost serve points)', 'other'::public.verification_type),
  ('SRV019', 'GLD012', 'serve_lab'::public.challenge_category, 'Win using 3 serve types', 'other'::public.verification_type),
  ('SRV020', 'GLD018', 'serve_lab'::public.challenge_category, 'Win using only one serve', 'other'::public.verification_type),
  ('SRV021', 'GLD136', 'serve_lab'::public.challenge_category, 'Win 3 points using a surprise long serve as the setup', 'other'::public.verification_type),
  ('SRV022', 'GLD139', 'serve_lab'::public.challenge_category, 'Win points using 3 different serve patterns in one match', 'other'::public.verification_type),
  ('SRV023', 'GLD148', 'serve_lab'::public.challenge_category, 'Win a set using a planned serve, receive, and first-attack pattern', 'other'::public.verification_type),
  ('CMP001', 'BRZ015', 'competitor'::public.challenge_category, 'Win a point with a simple push rally', 'other'::public.verification_type),
  ('CMP002', 'BRZ016', 'competitor'::public.challenge_category, 'Successfully return 5 serves in a row', 'self'::public.verification_type),
  ('CMP003', 'BRZ019', 'competitor'::public.challenge_category, 'Bounce the ball on your paddle 50 times without dropping', 'self'::public.verification_type),
  ('CMP004', 'BRZ033', 'competitor'::public.challenge_category, 'Forehand drive — 10 in a row', 'self'::public.verification_type),
  ('CMP005', 'BRZ034', 'competitor'::public.challenge_category, 'Backhand drive — 10 in a row', 'self'::public.verification_type),
  ('CMP006', 'BRZ035', 'competitor'::public.challenge_category, 'Forehand push — 10 in a row', 'self'::public.verification_type),
  ('CMP007', 'BRZ036', 'competitor'::public.challenge_category, 'Backhand push — 10 in a row', 'self'::public.verification_type),
  ('CMP008', 'BRZ037', 'competitor'::public.challenge_category, 'Block — 5 balls in a row on the table', 'self'::public.verification_type),
  ('CMP009', 'BRZ038', 'competitor'::public.challenge_category, 'Finish a high ball with a smash', 'other'::public.verification_type),
  ('CMP010', 'BRZ040', 'competitor'::public.challenge_category, 'Return 5 basic serves in a row', 'self'::public.verification_type),
  ('CMP011', 'BRZ133', 'competitor'::public.challenge_category, 'Alternate forehand and backhand drives for 8 shots', 'other'::public.verification_type),
  ('CMP012', 'BRZ145', 'competitor'::public.challenge_category, 'Backhand counter — 10 in a row', 'self'::public.verification_type),
  ('CMP013', 'BRZ146', 'competitor'::public.challenge_category, 'Forehand counter — 10 in a row', 'self'::public.verification_type),
  ('CMP014', 'BRZ147', 'competitor'::public.challenge_category, 'Use a reset routine between 5 consecutive points', 'self'::public.verification_type),
  ('CMP015', 'SLV004', 'competitor'::public.challenge_category, 'Win against a chopper', 'other'::public.verification_type),
  ('CMP016', 'SLV005', 'competitor'::public.challenge_category, 'Do a successful chop-block', 'other'::public.verification_type),
  ('CMP017', 'SLV010', 'competitor'::public.challenge_category, 'Win a point with an Adriana Diaz punch', 'other'::public.verification_type),
  ('CMP018', 'SLV012', 'competitor'::public.challenge_category, 'Do a forehand chop-block like Bernadette Szocs', 'other'::public.verification_type),
  ('CMP019', 'SLV014', 'competitor'::public.challenge_category, 'Attempt a Lin Yun-Ru backhand flip', 'other'::public.verification_type),
  ('CMP020', 'SLV015', 'competitor'::public.challenge_category, 'Perform a forehand flick like Ovidiu Ionescu', 'other'::public.verification_type),
  ('CMP021', 'SLV017', 'competitor'::public.challenge_category, 'Win the point defending with lobs like Simon Gauzy', 'other'::public.verification_type),
  ('CMP022', 'SLV021', 'competitor'::public.challenge_category, 'Win a point with a third ball attack', 'other'::public.verification_type),
  ('CMP023', 'SLV022', 'competitor'::public.challenge_category, 'Win a rally of 10+ shots', 'other'::public.verification_type),
  ('CMP024', 'SLV024', 'competitor'::public.challenge_category, 'Win a point with a backhand down the line', 'other'::public.verification_type),
  ('CMP025', 'SLV025', 'competitor'::public.challenge_category, 'Win a point with a forehand down the line', 'other'::public.verification_type),
  ('CMP026', 'SLV026', 'competitor'::public.challenge_category, 'Win a point using only pushes', 'other'::public.verification_type),
  ('CMP027', 'SLV027', 'competitor'::public.challenge_category, 'Successfully receive heavy spin 5 times', 'other'::public.verification_type),
  ('CMP028', 'SLV028', 'competitor'::public.challenge_category, 'Perform 3 successful flicks', 'self'::public.verification_type),
  ('CMP029', 'SLV029', 'competitor'::public.challenge_category, 'Win a point after fast serve + third ball', 'other'::public.verification_type),
  ('CMP030', 'SLV030', 'competitor'::public.challenge_category, 'Try to win a point without using spin', 'other'::public.verification_type),
  ('CMP031', 'SLV031', 'competitor'::public.challenge_category, 'Play a mirror match (copy your opponent’s style)', 'other'::public.verification_type),
  ('CMP032', 'SLV036', 'competitor'::public.challenge_category, 'Open with a forehand topspin against backspin', 'other'::public.verification_type),
  ('CMP033', 'SLV037', 'competitor'::public.challenge_category, 'Open with a backhand topspin against backspin', 'other'::public.verification_type),
  ('CMP034', 'SLV038', 'competitor'::public.challenge_category, 'Forehand flick a short ball to win the point', 'other'::public.verification_type),
  ('CMP035', 'SLV039', 'competitor'::public.challenge_category, 'Backhand flick a short ball to start the attack', 'other'::public.verification_type),
  ('CMP036', 'GLD004', 'competitor'::public.challenge_category, 'Truls Moregard chop-block sequence', 'other'::public.verification_type),
  ('CMP037', 'GLD006', 'competitor'::public.challenge_category, 'Forehand all around table like Quadri Aruna', 'other'::public.verification_type),
  ('CMP038', 'GLD013', 'competitor'::public.challenge_category, 'Perfect third ball attacks', 'other'::public.verification_type),
  ('CMP039', 'GLD034', 'competitor'::public.challenge_category, 'Win a point with a banana flick receive', 'other'::public.verification_type),
  ('CMP040', 'GLD035', 'competitor'::public.challenge_category, 'Counter-topspin — 3 balls in a row', 'other'::public.verification_type),
  ('CMP041', 'GLD036', 'competitor'::public.challenge_category, 'Backhand loop against backspin to start the rally', 'other'::public.verification_type),
  ('CMP042', 'GLD037', 'competitor'::public.challenge_category, 'Step around and win with a forehand loop from the backhand corner', 'other'::public.verification_type),
  ('CMP043', 'GLD038', 'competitor'::public.challenge_category, 'Win a point with a forehand sidespin loop', 'other'::public.verification_type),
  ('CMP044', 'GLD039', 'competitor'::public.challenge_category, 'Win a point with a backhand sidespin flick', 'other'::public.verification_type),
  ('CMP045', 'GLD040', 'competitor'::public.challenge_category, 'Fish from mid-distance and turn defense into attack', 'other'::public.verification_type),
  ('CMP046', 'GLD041', 'competitor'::public.challenge_category, 'Counter-smash and win the point', 'other'::public.verification_type),
  ('CMP047', 'GLD101', 'competitor'::public.challenge_category, 'Win a rally using at least 2 different spin types', 'other'::public.verification_type),
  ('CMP048', 'GLD102', 'competitor'::public.challenge_category, 'Win 3 points using topspin attacks under pressure', 'other'::public.verification_type),
  ('CMP049', 'GLD133', 'competitor'::public.challenge_category, 'Win a set by controlling the short game and opening first', 'other'::public.verification_type),
  ('CMP050', 'GLD142', 'competitor'::public.challenge_category, 'Win a rally with a counterloop from both forehand and backhand sides in one match', 'other'::public.verification_type),
  ('CMP051', 'GLD147', 'competitor'::public.challenge_category, 'Win a point that includes short game, opening attack, and counter phase', 'other'::public.verification_type),
  ('EXP001', 'BRZ001', 'explorer'::public.challenge_category, 'Play at any indoor venue', 'self'::public.verification_type),
  ('EXP002', 'BRZ002', 'explorer'::public.challenge_category, 'Play at any outdoor venue', 'self'::public.verification_type),
  ('EXP003', 'BRZ003', 'explorer'::public.challenge_category, 'Check-in at two locations in the same day', 'self'::public.verification_type),
  ('EXP004', 'BRZ009', 'explorer'::public.challenge_category, 'Register in a local tournament', 'self'::public.verification_type),
  ('EXP005', 'BRZ012', 'explorer'::public.challenge_category, 'Play with a new opponent', 'other'::public.verification_type),
  ('EXP006', 'BRZ018', 'explorer'::public.challenge_category, 'Record one rally on video', 'self'::public.verification_type),
  ('EXP007', 'BRZ021', 'explorer'::public.challenge_category, 'Play a lefty vs righty friendly match', 'other'::public.verification_type),
  ('EXP008', 'BRZ022', 'explorer'::public.challenge_category, 'Compliment your opponent after every set', 'other'::public.verification_type),
  ('EXP009', 'BRZ025', 'explorer'::public.challenge_category, 'Let your opponent choose your serves for one set', 'other'::public.verification_type),
  ('EXP010', 'BRZ026', 'explorer'::public.challenge_category, 'Record and post your best rally', 'self'::public.verification_type),
  ('EXP011', 'BRZ027', 'explorer'::public.challenge_category, 'Let a beginner coach you for one set', 'other'::public.verification_type),
  ('EXP012', 'BRZ028', 'explorer'::public.challenge_category, 'High-five your opponent after every point', 'other'::public.verification_type),
  ('EXP013', 'BRZ029', 'explorer'::public.challenge_category, 'Film a pro intro video of yourself', 'self'::public.verification_type),
  ('EXP014', 'BRZ030', 'explorer'::public.challenge_category, 'Teach someone a skill you learned', 'self'::public.verification_type),
  ('EXP015', 'BRZ031', 'explorer'::public.challenge_category, 'Add a new location on TTPortal', 'self'::public.verification_type),
  ('EXP016', 'BRZ032', 'explorer'::public.challenge_category, 'Invite a friend on TTPortal', 'self'::public.verification_type),
  ('EXP017', 'SLV146', 'explorer'::public.challenge_category, 'Play a best-of-three match with a friend', 'other'::public.verification_type),
  ('EXP018', 'SLV147', 'explorer'::public.challenge_category, 'Win 2 points in deuce situations during one match', 'other'::public.verification_type),
  ('EXP019', 'GLD028', 'explorer'::public.challenge_category, 'Let the crowd decide your tactics', 'other'::public.verification_type),
  ('EXP020', 'GLD030', 'explorer'::public.challenge_category, 'Play doubles with a stranger', 'other'::public.verification_type),
  ('EXP021', 'GLD144', 'explorer'::public.challenge_category, 'Beat two different opponents in the same session', 'other'::public.verification_type)
-- DO NOTHING (was DO UPDATE in the original seed): prod rows already
-- exist and 079 reworded titles — re-applying must not clobber them.
on conflict (code) do nothing;

update public.challenges
set title_key = 'badgeChallenge_' || code
where title_key is null
  and code ~ '^(CRF|SPN|ATK|FTW|DEF|SRV|CMP|EXP)[0-9]{3}$';

-- Optional sanity checks
select category, count(*) as challenge_count
from public.challenges
group by category
order by category;

select verification_type, count(*) as challenge_count
from public.challenges
group by verification_type
order by verification_type;

-- ====== challenge-system/004_challenge_validation_helpers.sql ======
-- Supabase migration: Challenge validation helper RPCs
-- Gives invited validators a safe, RLS-friendly way to fetch approval cards.

create or replace function public.get_pending_challenge_validations()
returns table (
  validation_id uuid,
  submission_id uuid,
  submitter_user_id uuid,
  submitter_name text,
  challenge_id uuid,
  challenge_code text,
  challenge_legacy_code text,
  challenge_title_key text,
  challenge_title text,
  category public.challenge_category,
  event_id integer,
  event_title text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    v.id as validation_id,
    s.id as submission_id,
    s.user_id as submitter_user_id,
    coalesce(nullif(trim(p.full_name), ''), p.username, 'Player') as submitter_name,
    c.id as challenge_id,
    c.code as challenge_code,
    c.legacy_code as challenge_legacy_code,
    c.title_key as challenge_title_key,
    c.title as challenge_title,
    c.category,
    s.event_id,
    e.title as event_title,
    v.created_at
  from public.challenge_validations v
  join public.challenge_submissions s on s.id = v.submission_id
  join public.challenges c on c.id = s.challenge_id
  left join public.profiles p on p.id = s.user_id
  left join public.events e on e.id = s.event_id
  where v.validator_user_id = auth.uid()
    and v.status = 'pending'
    and s.status = 'pending'
  order by v.created_at desc;
$$;

grant execute on function public.get_pending_challenge_validations() to authenticated;

comment on function public.get_pending_challenge_validations() is
  'Returns pending challenge validation cards for the current validator with submitter, challenge, and event context.';

create unique index if not exists challenge_submissions_one_active_per_user_event_uidx
  on public.challenge_submissions(user_id, event_id)
  where event_id is not null
    and status in ('pending', 'approved', 'auto_approved');

create or replace function public.add_challenge_to_event(
  v_event_id integer,
  v_challenge_id uuid
)
returns public.challenge_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_challenge public.challenges;
  v_submission public.challenge_submissions;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select *
    into v_event
  from public.events
  where id = v_event_id;

  if not found then
    raise exception 'event not found';
  end if;

  if v_event.status in ('cancelled', 'completed') then
    raise exception 'cannot add a challenge to a finished event';
  end if;

  if not exists (
    select 1
    from public.event_participants ep
    where ep.event_id = v_event_id
      and ep.user_id = auth.uid()
  ) then
    raise exception 'player must join the event before adding a challenge';
  end if;

  select *
    into v_challenge
  from public.challenges
  where id = v_challenge_id
    and is_active = true;

  if not found then
    raise exception 'challenge not found';
  end if;

  if v_challenge.verification_type <> 'other' then
    raise exception 'only other-player challenges can be added to events';
  end if;

  insert into public.challenge_submissions (
    user_id,
    challenge_id,
    event_id,
    verification_type,
    metadata
  )
  values (
    auth.uid(),
    v_challenge_id,
    v_event_id,
    'other',
    jsonb_build_object('source', 'event_challenge')
  )
  returning * into v_submission;

  return v_submission;
end;
$$;

create or replace function public.complete_self_challenge(v_challenge_id uuid)
returns public.challenge_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.challenges;
  v_submission public.challenge_submissions;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select *
    into v_challenge
  from public.challenges
  where id = v_challenge_id
    and is_active = true;

  if not found then
    raise exception 'challenge not found';
  end if;

  if v_challenge.verification_type <> 'self' then
    raise exception 'challenge is not self-verifiable';
  end if;

  select *
    into v_submission
  from public.challenge_submissions
  where user_id = auth.uid()
    and challenge_id = v_challenge_id
    and status in ('approved', 'auto_approved')
  order by submitted_at desc
  limit 1;

  if found then
    return v_submission;
  end if;

  select *
    into v_submission
  from public.challenge_submissions
  where user_id = auth.uid()
    and challenge_id = v_challenge_id
    and status = 'pending'
  order by submitted_at desc
  limit 1
  for update;

  if found then
    update public.challenge_submissions
    set status = 'auto_approved',
        auto_review_reason = 'self challenge completed',
        reviewed_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('source', 'challenge_screen')
    where id = v_submission.id
    returning * into v_submission;

    return v_submission;
  end if;

  insert into public.challenge_submissions (
    user_id,
    challenge_id,
    verification_type,
    status,
    reviewed_at,
    auto_review_reason,
    metadata
  )
  values (
    auth.uid(),
    v_challenge_id,
    'self',
    'auto_approved',
    now(),
    'self challenge completed',
    jsonb_build_object('source', 'challenge_screen')
  )
  returning * into v_submission;

  return v_submission;
end;
$$;

create or replace function public.get_event_challenge_submissions(v_event_id integer)
returns table (
  submission_id uuid,
  submitter_user_id uuid,
  submitter_name text,
  challenge_id uuid,
  challenge_code text,
  challenge_legacy_code text,
  challenge_title_key text,
  challenge_title text,
  category public.challenge_category,
  status public.submission_status,
  reviewer_user_id uuid,
  reviewer_name text,
  submitted_at timestamptz,
  reviewed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.id as submission_id,
    s.user_id as submitter_user_id,
    coalesce(nullif(trim(submitter.full_name), ''), submitter.username, 'Player') as submitter_name,
    c.id as challenge_id,
    c.code as challenge_code,
    c.legacy_code as challenge_legacy_code,
    c.title_key as challenge_title_key,
    c.title as challenge_title,
    c.category,
    s.status,
    s.reviewer_user_id,
    coalesce(nullif(trim(reviewer.full_name), ''), reviewer.username) as reviewer_name,
    s.submitted_at,
    s.reviewed_at
  from public.challenge_submissions s
  join public.challenges c on c.id = s.challenge_id
  left join public.profiles submitter on submitter.id = s.user_id
  left join public.profiles reviewer on reviewer.id = s.reviewer_user_id
  join public.events e on e.id = s.event_id
  where s.event_id = v_event_id
    and s.verification_type = 'other'
    and exists (
      select 1
      from public.event_participants ep
      where ep.event_id = v_event_id
        and ep.user_id = auth.uid()
    )
  order by s.submitted_at desc;
$$;

create or replace function public.award_event_challenge_submission(v_submission_id uuid)
returns public.challenge_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.challenge_submissions;
  v_event public.events;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select *
    into v_submission
  from public.challenge_submissions
  where id = v_submission_id
  for update;

  if not found then
    raise exception 'submission not found';
  end if;

  if v_submission.event_id is null then
    raise exception 'submission is not linked to an event';
  end if;

  if v_submission.verification_type <> 'other' then
    raise exception 'submission does not require event validation';
  end if;

  if v_submission.user_id = auth.uid() then
    raise exception 'players cannot award their own challenge';
  end if;

  if v_submission.status <> 'pending' then
    raise exception 'challenge already awarded';
  end if;

  select *
    into v_event
  from public.events
  where id = v_submission.event_id;

  if not found then
    raise exception 'event not found';
  end if;

  if not exists (
    select 1
    from public.event_participants ep
    where ep.event_id = v_submission.event_id
      and ep.user_id = auth.uid()
  ) then
    raise exception 'validator must be part of the linked event';
  end if;

  update public.challenge_submissions
  set status = 'approved',
      reviewed_at = now(),
      reviewer_user_id = auth.uid()
  where id = v_submission_id
    and status = 'pending'
  returning * into v_submission;

  if not found then
    raise exception 'challenge already awarded';
  end if;

  insert into public.challenge_validations (
    submission_id,
    validator_user_id,
    status,
    responded_at
  )
  values (
    v_submission_id,
    auth.uid(),
    'approved',
    now()
  )
  on conflict (submission_id, validator_user_id)
  do update set
    status = 'approved',
    responded_at = now();

  return v_submission;
end;
$$;

grant execute on function public.get_event_challenge_submissions(integer) to authenticated;
grant execute on function public.award_event_challenge_submission(uuid) to authenticated;
grant execute on function public.add_challenge_to_event(integer, uuid) to authenticated;
grant execute on function public.complete_self_challenge(uuid) to authenticated;

comment on function public.get_event_challenge_submissions(integer) is
  'Returns event-linked other-player challenge submissions visible to event participants.';
comment on function public.award_event_challenge_submission(uuid) is
  'Lets the first other event participant award an event-linked challenge submission.';
comment on function public.add_challenge_to_event(integer, uuid) is
  'Adds one current other-player challenge to an event for the authenticated participant.';
comment on function public.complete_self_challenge(uuid) is
  'Atomically completes a self-verifiable challenge for the authenticated user and syncs badge progress.';

-- ----------------------------------------------------------------------
-- Re-pin search_path on any definer function the CREATE OR REPLACE
-- statements above re-created without one (mirrors migration 089).
-- ----------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
    RAISE NOTICE 'search_path pinned on %', r.sig;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
