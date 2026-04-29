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

  if v_event.status = 'cancelled' then
    raise exception 'cannot add a challenge to a cancelled event';
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
