#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Replay the FROZEN migration chain (000–081 immutable + 082+ additive) onto
# a fresh supabase/postgres container, with the manual interventions that
# prod history actually had. Verifies the whole chain + new migrations are
# appliable without touching any applied migration.
#
# Why interventions are needed: migrations 000–081 are applied on prod and
# MUST NOT be edited, but four of them depend on state that reached prod
# outside the chain:
#   - 009 assumes pg_net exists (its WITH SCHEMA clause errors on fresh DBs)
#   - 025/026/079 need the challenge system (applied manually, see
#     migrations/094_challenge_system.sql)
#   - 059/060 reference legacy event_visibility/event_invites (dashboard-era)
#   - 062 was retro-edited to use 063-era cities columns
# A real fresh environment should instead start from a prod baseline dump
# (T021); this script exists for verification and local hacking until then.
#
# Usage: ./replay_prod_parity.sh [container-name]
# ---------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="$HERE/../migrations"
CS="$HERE/../challenge-system"
NAME="${1:-tt_prodsim}"
IMAGE="supabase/postgres:15.8.1.085"

docker rm -f "$NAME" >/dev/null 2>&1 || true
# Optional: PUBLISH_PORT=54329 to expose postgres on the host (e.g. for
# `supabase gen types --db-url` — T051 generates client types from this
# container so they reflect the full 000–095 chain, not just what prod has).
PORTARGS=()
[ -n "${PUBLISH_PORT:-}" ] && PORTARGS=(-p "${PUBLISH_PORT}:5432")
docker run -d --name "$NAME" ${PORTARGS[@]+"${PORTARGS[@]}"} -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for i in $(seq 1 20); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break || sleep 3
done

PSQL=(docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q)

apply() {
  "${PSQL[@]}" < "$1" >/tmp/replay_prod_parity.log 2>&1 \
    || { echo "FAILED: $1"; tail -5 /tmp/replay_prod_parity.log; exit 1; }
}

range() { ls "$MIG"/0*.sql | sort | awk -F/ '{print $NF}' | awk -F_ -v lo="$1" -v hi="$2" '$1 >= lo && $1 <= hi'; }

# pg_net must pre-exist for 009's `WITH SCHEMA net` clause to no-op.
"${PSQL[@]}" -c "create extension if not exists pg_net;" >/dev/null

for f in $(range 000 024); do apply "$MIG/$f"; done

# Challenge system: applied to prod manually before 025 needed its enum.
apply "$CS/001_challenge_system_migration.sql"
apply "$CS/002_challenge_seed.sql"
apply "$CS/004_challenge_validation_helpers.sql"

for f in $(range 025 057); do apply "$MIG/$f"; done

# Legacy event bits (dashboard-era) that 059/060 clean up.
"${PSQL[@]}" <<'SQL'
alter table public.events add column if not exists event_visibility text default 'public';
create table if not exists public.event_invites (
  id bigserial primary key,
  event_id int references public.events(id) on delete cascade,
  inviter_id uuid, invitee_id uuid,
  created_at timestamptz not null default now()
);
SQL

for f in $(range 058 061); do apply "$MIG/$f"; done

# 062 was retro-edited after 063 ran in prod; give it the columns it expects.
"${PSQL[@]}" <<'SQL'
alter table public.cities
  add column if not exists country_code text,
  add column if not exists updated_at timestamptz not null default now();
update public.cities set country_code = 'RO' where country_code is null;
create unique index if not exists cities_country_code_name_key on public.cities(country_code, name);
SQL

for f in $(range 062 067); do apply "$MIG/$f"; done

# 095 carries these forward; prod ran them manually here (as .txt).
for f in $(range 069 999); do apply "$MIG/$f"; done

echo "✅ chain replayed (frozen 000–081 + additive 082+) on container '$NAME'"
echo "   run the invariants: docker exec -i $NAME psql -U postgres < $HERE/../tests/database/invariants.test.sql"
