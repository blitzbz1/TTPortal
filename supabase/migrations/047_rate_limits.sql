-- Per-user (and per-IP) rate limits for write actions.
--
-- Design notes
-- ============
-- - rate_limit_config holds the rules so they can be tweaked at runtime via
--   plain SQL, without an app rebuild. Each row is a (action, window) pair
--   with a max_attempts count; multiple rows per action stack (the action
--   is rejected if ANY window exceeds its max). enabled=false disables a
--   single rule without deleting it.
-- - action_log records every attempt that reached the trigger. Counts run
--   off this table; rate-checked actions ALSO insert here, so the log is
--   the single source of truth for "how many attempts has this user
--   actually made". The audit doubles as a debugging aid.
-- - Admins (profiles.is_admin = true) bypass rate limits entirely. The
--   exemption check uses an EXISTS subquery — cheap and indexed.
-- - IP rate limiting: PostgREST exposes the client's headers via the
--   `request.headers` GUC. We extract the first hop of x-forwarded-for and
--   record it on every attempt. A separate, table-driven set of rules (
--   action='*' in rate_limit_config) lets us cap per-IP traffic across all
--   actions, providing defense-in-depth against single-IP spam. NOTE: this
--   does NOT replace edge-level DDoS protection — true volumetric attacks
--   never reach Postgres. Use Cloudflare / Supabase Edge Functions / your
--   provider's IP rules for that. This layer protects against a single
--   misbehaving authenticated client.
-- - ip_block is an explicit deny list. Admins can drop rows in here to
--   block an IP for a fixed duration; the rate-limit function checks it
--   first and refuses any logged attempt from a banned IP.
-- - Failed attempts: this layer counts everything that reaches a write
--   trigger. PostgREST 400s caused by schema/RLS validation never reach
--   the trigger; mitigate that at the edge or via a future RPC funnel.
--   For typical app usage (the client driving the official flows), every
--   attempt that hits the table will be counted whether it commits or not
--   — except that a rolled-back transaction loses its log row. This is an
--   acceptable undercount: if a user's attempts are failing for non-rate
--   reasons, blocking them is overreach. Spammers with valid payloads are
--   counted accurately and capped.

create table if not exists public.rate_limit_config (
  id            serial primary key,
  action        text   not null,
  scope         text   not null check (scope in ('user', 'ip')),
  window_secs   int    not null check (window_secs > 0),
  max_attempts  int    not null check (max_attempts > 0),
  enabled       boolean not null default true,
  description   text,
  unique (action, scope, window_secs)
);

comment on table public.rate_limit_config is
  'Runtime-tunable rate limit rules. Multiple rows per action are AND-ed (any window over => block). scope=user uses auth.uid(); scope=ip uses x-forwarded-for first hop.';

-- Seed with the limits you specified. Tweak by UPDATE; no migration needed.
insert into public.rate_limit_config (action, scope, window_secs, max_attempts, description) values
  ('add_venue',    'user',    600, 10, '10 venue submissions per 10 minutes'),
  ('add_venue',    'user',  86400, 50, '50 venue submissions per 24 hours'),
  ('create_event', 'user',  86400, 10, '10 events per 24 hours'),
  ('checkin',      'user',    300, 10, '10 check-ins per 5 minutes'),
  ('checkin',      'user',  86400, 50, '50 check-ins per 24 hours'),
  -- Per-IP backstop: aggregate across all rate-limited actions. Sized
  -- generously enough that legitimate users on shared NAT never trip it,
  -- but tight enough to stop a single host from hammering us.
  ('*',            'ip',      60, 120, 'Per-IP burst across all actions, 120 / minute'),
  ('*',            'ip',    3600, 2000, 'Per-IP sustained across all actions, 2000 / hour')
on conflict do nothing;

create table if not exists public.action_log (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  ip_address  inet,
  action      text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_action_log_user_action_time
  on public.action_log (user_id, action, created_at desc);
create index if not exists idx_action_log_ip_action_time
  on public.action_log (ip_address, action, created_at desc);
-- Time index supports periodic pruning (delete old rows) without a full scan.
create index if not exists idx_action_log_created_at
  on public.action_log (created_at);

comment on table public.action_log is
  'Audit log of rate-limited write attempts. Counts read off this table.';

create table if not exists public.ip_block (
  ip_address     inet primary key,
  blocked_until  timestamptz not null,
  reason         text,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null
);

comment on table public.ip_block is
  'Explicit IP deny list. Insert a row to ban an IP until blocked_until. Auto-checked by enforce_rate_limit; expired rows are ignored (and pruned by retention).';

-- Pull the client IP out of the x-forwarded-for header PostgREST exposes.
-- The first hop in XFF is the originating client; everything after is
-- intermediary proxies. Returns NULL if the header is absent (direct DB
-- connections, psql, etc.) — the per-IP rule then degrades gracefully.
create or replace function public.current_client_ip()
returns inet
language plpgsql stable
as $$
declare
  v_xff text;
begin
  v_xff := nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for';
  if v_xff is null or v_xff = '' then
    return null;
  end if;
  -- Take the first comma-separated value, trim whitespace.
  v_xff := trim(split_part(v_xff, ',', 1));
  begin
    return v_xff::inet;
  exception when others then
    return null;
  end;
end;
$$;

-- Core rate-limit gate. Called by per-action triggers and (optionally)
-- directly by RPCs. Raises a structured exception when limited so the
-- client can parse it and show a localized "try again in N seconds" copy.
--
-- Exception format: rate_limit_exceeded:<scope>:<action>:<window_secs>:<max>
create or replace function public.enforce_rate_limit(p_action text)
returns void
language plpgsql security definer
as $$
declare
  v_user uuid := auth.uid();
  v_ip   inet := public.current_client_ip();
  v_rule record;
  v_count int;
begin
  -- Admin bypass.
  if v_user is not null and exists (
    select 1 from public.profiles where id = v_user and is_admin = true
  ) then
    -- Still log for audit, but do not enforce.
    insert into public.action_log(user_id, ip_address, action) values (v_user, v_ip, p_action);
    return;
  end if;

  -- Hard IP ban check.
  if v_ip is not null and exists (
    select 1 from public.ip_block where ip_address = v_ip and blocked_until > now()
  ) then
    raise exception 'ip_blocked:%', v_ip;
  end if;

  -- Per-user windows.
  if v_user is not null then
    for v_rule in
      select window_secs, max_attempts
      from public.rate_limit_config
      where action = p_action and scope = 'user' and enabled
    loop
      select count(*) into v_count
      from public.action_log
      where user_id = v_user
        and action = p_action
        and created_at > now() - make_interval(secs => v_rule.window_secs);
      if v_count >= v_rule.max_attempts then
        raise exception 'rate_limit_exceeded:user:%:%:%', p_action, v_rule.window_secs, v_rule.max_attempts;
      end if;
    end loop;
  end if;

  -- Per-IP windows. Match action='*' (any action) so a single rule covers
  -- the whole app. Per-IP per-action rules also work if added.
  if v_ip is not null then
    for v_rule in
      select window_secs, max_attempts
      from public.rate_limit_config
      where (action = p_action or action = '*') and scope = 'ip' and enabled
    loop
      select count(*) into v_count
      from public.action_log
      where ip_address = v_ip
        and created_at > now() - make_interval(secs => v_rule.window_secs);
      if v_count >= v_rule.max_attempts then
        raise exception 'rate_limit_exceeded:ip:%:%:%', p_action, v_rule.window_secs, v_rule.max_attempts;
      end if;
    end loop;
  end if;

  -- Passed all checks — record the attempt.
  insert into public.action_log(user_id, ip_address, action) values (v_user, v_ip, p_action);
end;
$$;

grant execute on function public.enforce_rate_limit(text) to authenticated;
grant execute on function public.current_client_ip() to authenticated;

-- Trigger functions: thin wrappers that pass the action label.
create or replace function public.trg_enforce_add_venue() returns trigger language plpgsql as $$
begin perform public.enforce_rate_limit('add_venue'); return new; end $$;

create or replace function public.trg_enforce_create_event() returns trigger language plpgsql as $$
begin perform public.enforce_rate_limit('create_event'); return new; end $$;

create or replace function public.trg_enforce_checkin() returns trigger language plpgsql as $$
begin perform public.enforce_rate_limit('checkin'); return new; end $$;

drop trigger if exists rate_limit_add_venue on public.venues;
create trigger rate_limit_add_venue
  before insert on public.venues
  for each row execute function public.trg_enforce_add_venue();

drop trigger if exists rate_limit_create_event on public.events;
create trigger rate_limit_create_event
  before insert on public.events
  for each row execute function public.trg_enforce_create_event();

drop trigger if exists rate_limit_checkin on public.checkins;
create trigger rate_limit_checkin
  before insert on public.checkins
  for each row execute function public.trg_enforce_checkin();

-- Retention: prune rows older than 30 days. Counts only ever look back
-- 24h (longest configured window), so anything older is dead weight. The
-- pg_cron extension is enabled by default on Supabase; if it's not in
-- your project, run this DELETE manually or via an Edge Function on a
-- schedule.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'prune_action_log',
      '17 3 * * *',  -- 03:17 daily
      $cron$delete from public.action_log where created_at < now() - interval '30 days'$cron$
    );
    perform cron.schedule(
      'prune_ip_block',
      '23 3 * * *',
      $cron$delete from public.ip_block where blocked_until < now() - interval '7 days'$cron$
    );
  end if;
end $$;

-- RLS: action_log and ip_block are admin-only. rate_limit_config is
-- readable by any authenticated user (so the client can show the limits
-- in UI if it wants); only admins can mutate.
alter table public.action_log     enable row level security;
alter table public.ip_block       enable row level security;
alter table public.rate_limit_config enable row level security;

drop policy if exists action_log_admin_all on public.action_log;
create policy action_log_admin_all on public.action_log
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin))
       with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists ip_block_admin_all on public.ip_block;
create policy ip_block_admin_all on public.ip_block
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin))
       with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists rlc_admin_write on public.rate_limit_config;
create policy rlc_admin_write on public.rate_limit_config
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin))
       with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin));

drop policy if exists rlc_authed_read on public.rate_limit_config;
create policy rlc_authed_read on public.rate_limit_config
  for select using (auth.role() = 'authenticated');
