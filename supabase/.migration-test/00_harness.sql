-- Scratch-container harness mimicking the Supabase runtime pieces that
-- migrations 082/083 depend on: auth.uid(), the PostgREST roles, the
-- own-row profiles RLS from 002, is_current_user_admin() from 073, and
-- the original (SECURITY INVOKER) 071 account-deletion RPCs.

create schema if not exists auth;

create table if not exists auth.users (id uuid primary key);

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.role() returns text
language sql stable
as $$ select current_user::text $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;

-- ---- minimal tables ----

create table public.profiles (
  id uuid primary key,
  full_name text,
  email text,
  username text,
  avatar_url text,
  city text,
  lang text not null default 'ro',
  auth_provider text not null default 'email',
  created_at timestamptz not null default now(),
  notify_friend_checkins boolean not null default true,
  is_admin boolean not null default false,
  is_moderator boolean not null default false,
  pending_deletion_at timestamptz
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

grant select, update on public.profiles to authenticated;

create table public.venues (
  id serial primary key,
  name text, type text, city text, county text, sector text, address text,
  lat float8, lng float8, tables_count int, condition text, hours text,
  description text, tags text[], photos text[], free_access boolean,
  night_lighting boolean, nets boolean, verified boolean, tariff text,
  website text, submitted_by uuid, approved boolean,
  created_at timestamptz default now()
);

create table public.venue_stats (
  venue_id int primary key,
  avg_rating numeric, review_count int, checkin_count int, favorite_count int
);

create table public.checkins (
  id bigserial primary key,
  user_id uuid, venue_id int, table_number int,
  started_at timestamptz default now(), ended_at timestamptz
);

-- 004 base state replaced by migration 084
alter table public.checkins enable row level security;
create policy "Users can read own checkins" on public.checkins for select to authenticated
  using (auth.uid() = user_id);
create policy "Active checkins are readable" on public.checkins for select to authenticated
  using (ended_at > now());
grant select, insert, update on public.checkins to authenticated;
grant select on public.friendships to authenticated;

create table public.reviews (
  id bigserial primary key,
  venue_id int, user_id uuid, reviewer_name text, rating int, body text,
  created_at timestamptz default now()
);

alter table public.reviews enable row level security;
create policy "Reviews are publicly readable" on public.reviews for select using (true);
create policy "Users can insert own reviews" on public.reviews for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update own reviews" on public.reviews for update to authenticated
  using (auth.uid() = user_id);
grant select, insert, update on public.reviews to authenticated, anon;

create table public.condition_votes (
  id serial primary key,
  user_id uuid not null,
  venue_id int not null,
  condition text not null check (condition in ('buna', 'acceptabila', 'deteriorata')),
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.condition_votes enable row level security;
create policy "Condition votes are publicly readable" on public.condition_votes for select using (true);
create policy "Authenticated users can vote" on public.condition_votes for insert to authenticated
  with check (auth.uid() = user_id);
grant select, insert, update on public.condition_votes to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create table public.favorites (
  user_id uuid, venue_id int, primary key (user_id, venue_id)
);

create table public.friendships (
  id bigserial primary key,
  requester_id uuid, addressee_id uuid, status text
);

create table public.events (
  id bigserial primary key,
  venue_id int, title text, status text,
  starts_at timestamptz, ends_at timestamptz,
  organizer_id uuid,
  visibility text not null default 'public'
);

create table public.event_participants (
  event_id bigint, user_id uuid
);

create table public.event_invitations (
  id bigserial primary key, event_id bigint, user_id uuid, invited_by uuid
);

-- 058/059 state replaced/extended by migration 087
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.event_invitations enable row level security;
create policy "Events visibility-aware select" on public.events
  for select using (
    visibility = 'public'
    or organizer_id = auth.uid()
    or (visibility = 'friends' and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = events.organizer_id)
          or (f.addressee_id = auth.uid() and f.requester_id = events.organizer_id))))
    or (visibility = 'private' and exists (
      select 1 from public.event_invitations ei
      where ei.event_id = events.id and ei.user_id = auth.uid()))
  );
-- 059's non-recursive version (058's original recursed via events)
create policy "Invitees can read own invites" on public.event_invitations
  for select to authenticated
  using (user_id = auth.uid() or invited_by = auth.uid());
create policy "Event participants are publicly readable" on public.event_participants
  for select using (true);
grant select on public.events, public.event_participants, public.event_invitations to authenticated, anon;
grant select on public.friendships to anon;

create table if not exists public.cities (
  id serial primary key,
  name text not null unique,
  county text,
  lat double precision, lng double precision,
  zoom int default 12,
  venue_count int default 0,
  active boolean default true,
  country_code text,
  country_name text not null default 'Romania',
  expansion_status text not null default 'active'
);

create table if not exists public.countries (
  code text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 004/034/069 base state replaced by migration 088
alter table public.cities enable row level security;
alter table public.countries enable row level security;
create policy "Cities are publicly readable" on public.cities for select using (true);
create policy "Countries are publicly readable" on public.countries for select using (true);
create policy "Authenticated users can insert cities" on public.cities
  for insert to authenticated with check (true);
create policy "Authenticated users can insert countries" on public.countries
  for insert to authenticated with check (true);
grant select, insert, update on public.cities, public.countries to authenticated, anon;

insert into public.countries (code, name) values ('RO', 'Romania'), ('AT', 'Austria')
  on conflict do nothing;
insert into public.cities (name, country_code, country_name, lat, lng)
  values ('Wien', 'AT', 'Austria', 48.2082, 16.3738) on conflict do nothing;

-- ---- is_current_user_admin (verbatim from 073) ----

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT p.is_admin
    FROM public.profiles p
    WHERE p.id = auth.uid()
  ), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- ---- 071 account-deletion RPCs (original SECURITY INVOKER versions) ----

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

grant execute on function public.request_account_deletion to authenticated;
grant execute on function public.cancel_account_deletion to authenticated;

-- ---- 052/044 original RPC signatures (so 083's DROPs exercise the real path) ----

create or replace function public.get_friend_feed(p_friend_ids uuid[], p_limit int default 30)
returns table (kind text, id bigint, user_id uuid, user_name text, venue_id int,
               venue_name text, venue_city text, rating int, ts timestamptz)
language sql stable security definer set search_path = public
as $$ select 'x'::text, 0::bigint, null::uuid, ''::text, 0, ''::text, ''::text, 0, now() where false $$;

create or replace function public.get_venue_detail(p_venue_id integer, p_user_id uuid default null, p_review_limit integer default 5)
returns jsonb language sql stable security definer set search_path = public
as $$ select null::jsonb $$;

create or replace function public.get_friends_at_venue(p_venue_id integer, p_user_id uuid)
returns table (user_id uuid, full_name text, avatar_url text, source text, event_title text)
language sql stable security definer set search_path = public
as $$ select null::uuid, ''::text, ''::text, ''::text, ''::text where false $$;

grant execute on function public.get_friend_feed(uuid[], int) to authenticated;
grant execute on function public.get_venue_detail(integer, uuid, integer) to authenticated, anon;
grant execute on function public.get_friends_at_venue(integer, uuid) to authenticated, anon;

-- ---- seed ----

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000000d');

insert into public.profiles (id, full_name, email, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Alice Admin', 'alice@example.com', true),
  ('00000000-0000-0000-0000-00000000000b', 'Bob',   'bob@example.com',   false),
  ('00000000-0000-0000-0000-00000000000c', 'Carol', 'carol@example.com', false),
  ('00000000-0000-0000-0000-00000000000d', 'Dave',  'dave@example.com',  false);

insert into public.venues (id, name, city, approved) values (1, 'Test Venue', 'Wien', true);
select setval('venues_id_seq', 10);

-- bob ↔ carol accepted; bob → dave only pending
insert into public.friendships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 'accepted'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000d', 'pending');

insert into public.checkins (user_id, venue_id, started_at, ended_at) values
  ('00000000-0000-0000-0000-00000000000b', 1, now() - interval '10 min', now() + interval '2 hours'),
  ('00000000-0000-0000-0000-00000000000c', 1, now() - interval '5 min',  now() + interval '2 hours'),
  ('00000000-0000-0000-0000-00000000000d', 1, now() - interval '2 min',  now() + interval '2 hours');

insert into public.reviews (venue_id, user_id, reviewer_name, rating, body) values
  (1, '00000000-0000-0000-0000-00000000000c', 'Carol', 5, 'great'),
  (1, '00000000-0000-0000-0000-00000000000d', 'Dave',  1, 'bad');

insert into public.favorites (user_id, venue_id) values
  ('00000000-0000-0000-0000-00000000000b', 1);
