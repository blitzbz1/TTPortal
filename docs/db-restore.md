# Database Restore Runbook (Supabase)

How to restore TTPortal from the logical backups produced by `supabase db dump`
(the `backups/<date>/` folders). Covers full disaster recovery and a focused
cities/venues catalog restore, into a cloud or local target.

> The backup files live under `backups/<date>/` which is **git-ignored** (they
> contain `auth`/`storage`/user data). This runbook is the tracked copy of the
> procedure — keep it; the dumps themselves stay local and secure.

---

## What's in a backup folder

Each `backups/<date>/` snapshot (worked example below uses `2026-05-30`):

| File | Contents |
|------|----------|
| `schema.sql` | Full DDL — every schema (`public`, `auth`, `storage`, …), tables, FKs, sequences, functions. No data. |
| `roles.sql` | Cluster roles. |
| `data_full.sql` | **All** table data (COPY), data-only. Starts with `SET session_replication_role = replica;` and ends with sequence `setval`s. A complete restore point. |
| `catalog_cities_venues.sql` | Focused: `countries` → `cities` → `venues` only, data-only, **original IDs preserved**, plus `setval`s for `cities_id_seq1` / `venues_id_seq1`. |

**Source of the `2026-05-30` snapshot:** cloud project `vzewwlaqqgukjkqjyfoq`
(eu-west-1). Expected counts: `countries` 12, `cities` 56 (id 17..173),
`venues` 1386 (id 5..1579).

---

## Prerequisites

```bash
# psql / pg_restore ship with libpq (not on PATH by default on this machine):
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
psql --version            # expect 18.x — fine for restoring into the PG17 server

# Pick the snapshot to restore from (run all commands from the repo root):
export BACKUP_DIR="backups/2026-05-30"
```

**Connection strings — pick the target and export it as `TARGET_DB`:**

```bash
# (A) Local CLI dev stack (safe rehearsal target) — port from supabase/config.toml
export TARGET_DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# (B) Cloud project — SESSION pooler (port 5432; transaction pooler 6543 won't work)
#     The cloud DB password is NOT in supabase/.env — that file holds the LOCAL
#     self-hosted password. Get the cloud password from:
#       Supabase Dashboard -> Project Settings -> Database -> Connection string.
export TARGET_DB="postgresql://postgres.vzewwlaqqgukjkqjyfoq:<CLOUD_DB_PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
```

---

## ⚠️ Before restoring over anything live

1. **Take a fresh backup first** (see the backup procedure / `supabase db dump`).
2. **Rehearse on the local stack or a throwaway project** before touching prod —
   prefer restoring into an **empty** database.
3. Restoring over a populated database is **destructive and may be irreversible**.
4. For a same-project point-in-time rollback, the cloud project's **automated
   daily backups + PITR** (Dashboard → Database → Backups) are often the easier,
   safer path than a logical restore. Use this runbook when you need a logical /
   selective restore or a restore into a different database.

---

## Scenario A — Full restore into an EMPTY database (disaster recovery)

Target should be a freshly created project or a clean local stack with no schema.

```bash
# 1. Roles (optional). On managed Supabase, most roles are pre-provisioned —
#    expect "already exists" notices; safe to skip if it errors.
psql "$TARGET_DB" -f "$BACKUP_DIR/roles.sql"

# 2. Schema (DDL).
psql "$TARGET_DB" -v ON_ERROR_STOP=1 -f "$BACKUP_DIR/schema.sql"

# 3. Data. The file disables triggers/FK checks for the load and fixes sequences.
psql "$TARGET_DB" -f "$BACKUP_DIR/data_full.sql"
```

### Caveat: the dump includes `auth` and `storage` (platform-managed) schemas
- **Same-project rollback** → fine.
- **Into a NEW cloud project** → the platform pre-creates `auth`/`storage`, so
  restoring those rows can conflict. For app-data-only recovery, restore only the
  `public` data (see Scenario B pattern) and recreate users via Supabase Auth.
- **Into the local stack** → run `supabase db reset` first for a clean
  platform schema, then load only the data you need.

---

## Scenario B — Restore ONLY the cities/venues catalog

Uses `catalog_cities_venues.sql`. Loads `countries → cities → venues` in FK
order, preserves the exact IDs, and advances the id sequences past the max.

**Into a DB that already has the schema but not these rows:**
```bash
psql "$TARGET_DB" -v ON_ERROR_STOP=1 -f "$BACKUP_DIR/catalog_cities_venues.sql"
```

**To replace an existing catalog** you must clear the three tables first —
⚠️ **foot-gun:** `venues`/`cities` are referenced `ON DELETE CASCADE` by
`events`, `reviews`, photos, check-ins, equipment, etc. A `TRUNCATE … CASCADE`
**also deletes all those child rows.** Choose deliberately:

- *Safest* — restore into an empty DB / local rehearsal, diff against prod, then
  port only what actually changed.
- *Full catalog reset (also wipes dependents)* — only if you truly intend to:
  ```bash
  psql "$TARGET_DB" -c 'TRUNCATE public.venues, public.cities, public.countries RESTART IDENTITY CASCADE;'
  psql "$TARGET_DB" -v ON_ERROR_STOP=1 -f "$BACKUP_DIR/catalog_cities_venues.sql"
  ```
- *Upsert without touching children* — load into a temp schema and
  `INSERT … ON CONFLICT (id) DO UPDATE`. More involved; ask if you need this.

---

## Scenario C — Rehearse on the local Docker stack (recommended first)

```bash
export TARGET_DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
# clean schema, then load data:
supabase db reset            # rebuilds schema from migrations (optional)
psql "$TARGET_DB" -f "$BACKUP_DIR/data_full.sql"
# or, for just the catalog:
psql "$TARGET_DB" -v ON_ERROR_STOP=1 -f "$BACKUP_DIR/catalog_cities_venues.sql"
```

---

## Verify after restore

```bash
psql "$TARGET_DB" -c "select
  (select count(*) from countries)  as countries,
  (select count(*) from cities)     as cities,
  (select count(*) from venues)     as venues,
  (select max(id)  from cities)     as max_city_id,
  (select max(id)  from venues)     as max_venue_id;"
```
Expected for `2026-05-30`: `countries=12, cities=56, venues=1386, max_city_id=173, max_venue_id=1579`.

```bash
# Sequences are ahead of the data (next insert won't collide):
psql "$TARGET_DB" -c "select last_value from public.cities_id_seq1;
                      select last_value from public.venues_id_seq1;"

# No orphaned FKs (expect 0):
psql "$TARGET_DB" -c "select count(*) from venues v
  left join cities c on c.id = v.city_id
  where v.city_id is not null and c.id is null;"
```

---

## Notes

- These are logical (`pg_dump`) backups; restoring is plain `psql -f` — no
  `pg_restore` needed (the dumps are SQL, not custom-format archives).
- The leading `SET session_replication_role = replica;` in the data files
  requires the `postgres` role (granted on Supabase cloud and local).
- `backups/` is git-ignored — never commit the dumps; they contain PII.
- Always take a fresh dump immediately before restoring over a live database.

---

## Automated nightly backups (T083)

`.github/workflows/db-backup.yml` dumps schema + data + roles daily at
02:40 UTC, encrypts with [age](https://github.com/FiloSottile/age) to
`BACKUP_AGE_PUBLIC_KEY`, and stores the bundle as a workflow artifact
(90-day retention). Failures ping Discord.

**Restore from an automated backup:**

```bash
# 1. Download the artifact (db-backup-<run_id>) from the Actions run.
# 2. Decrypt with the offline private key:
age -d -i ~/keys/ttportal-backup.key -o backup.tar.gz backup.tar.gz.age
tar xzf backup.tar.gz   # → backup/{schema,data_full,roles}.sql
# 3. Follow the "Full disaster recovery" section above with these files.
```

**Operator setup (one-time):** `age-keygen` → store the private key in the
password manager, add the public key as the `BACKUP_AGE_PUBLIC_KEY` secret;
add `SUPABASE_DB_URL` and `DISCORD_WEBHOOK_URL` secrets; run the workflow
once via *Run workflow* and do a test decrypt — an untested backup is not a
backup.

**Restore drill log:**

| Date | Who | Result |
| --- | --- | --- |
| _none yet_ | | run the first drill after the secrets are configured |
