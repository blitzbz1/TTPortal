# Deployment — OpenStreetMap venue import

**44,914 venues · 10,291 cities · 44 countries**, derived from OpenStreetMap (via Overture Maps
`2026-05-20.0` + GeoNames). One **idempotent** `.sql` file per country in this directory, plus
`run_all.sql`. Per-country counts, name-source breakdown, drop reasons and samples are in
[`REPORT.md`](./REPORT.md). The generator lives in `scripts/osm-import/` (re-runnable).

---

## 1. Staged by design — applying does NOT launch markets

| Object | State written | Effect |
|---|---|---|
| `countries` | `active = true` | reference rows / FK targets only |
| `cities` | `active = false`, `expansion_status = 'community_review'` | **hidden in-app** — `active=false` normalizes to `'hidden'`, so these cities do **not** appear in the location picker or country list until you activate them |
| `venues` | `approved = true` | returned by `get_venues_delta` → pins **are visible on the map** once applied |

**Why venues are `approved=true` and not held back:** `getPendingVenues()` (admin moderation screen)
is an unbounded `WHERE approved=false` query — staging 44k rows there would break that screen. These
are curated, not user submissions, so they are written approved.

**Net effect of applying a file:** venue pins appear on the map for that country; **no new market is
launched** (cities stay out of the picker). If you want *zero* user-visible change for a region yet,
simply **don't apply that country's file yet** — the files are independent and safe to apply later.

---

## 2. Prerequisites

- `psql` (or the Supabase SQL editor — paste a file's contents).
- A target DB connection string. **These files do not choose a database** — you point `psql` at one
  (your production project, or a staging DB). Example: `export DB="postgresql://…"`.
- Schema must already include `countries`, `cities`, `venues` (migrations ≥ `063`).
- A backup/snapshot, or the rollback watermarks from step 3.

---

## 3. Deploy

```bash
cd supabase/seeds/osm
export DB="postgresql://USER:PASS@HOST:PORT/postgres"   # your target DB

# (a) review first
less REPORT.md ; less de.sql

# (b) record rollback watermarks — note both numbers
psql "$DB" -tAc "SELECT max(id) FROM venues;"   # -> V0
psql "$DB" -tAc "SELECT max(id) FROM cities;"   # -> C0

# (c) apply ONE country (recommended — controllable), or all of them
psql "$DB" -v ON_ERROR_STOP=1 -f de.sql
# psql "$DB" -v ON_ERROR_STOP=1 -f run_all.sql   # every country, each in its own transaction

# (d) verify
psql "$DB" -tAc "SELECT count(*) FROM venues  WHERE submitted_by IS NULL AND approved;"
psql "$DB" -tAc "SELECT count(*) FROM cities  WHERE expansion_status='community_review';"
psql "$DB" -c   "SELECT name,address,city FROM venues WHERE submitted_by IS NULL ORDER BY id DESC LIMIT 10;"
```

Each `<cc>.sql` is wrapped in a single `BEGIN…COMMIT`. **Re-running any file is a no-op**
(`ON CONFLICT DO NOTHING`) — the second pass inserts 0 rows.

---

## 4. Activate a market (when you're ready to launch it)

Cities are imported hidden. To make a region live (appears in the picker; venues were already on the map):

```sql
-- whole country
UPDATE cities SET active = true, expansion_status = 'active'
WHERE country_code = 'DE' AND expansion_status = 'community_review';

-- or a single city
UPDATE cities SET active = true, expansion_status = 'active'
WHERE country_code = 'DE' AND name = 'München';
```

`venue_count` per city is maintained automatically by a trigger. To re-stage, set
`active=false, expansion_status='community_review'` again.

---

## 5. Rollback

FKs are `ON DELETE RESTRICT`, so delete **children before parents**, using the watermarks from 3(b):

```sql
-- removes imported venues; the delete trigger writes tombstones so clients sync the removal
DELETE FROM venues WHERE id > :V0 AND submitted_by IS NULL;
-- remove imported cities that no longer have venues
DELETE FROM cities WHERE id > :C0
  AND NOT EXISTS (SELECT 1 FROM venues v WHERE v.city_id = cities.id);
-- (optional) remove countries that ended up with no cities
-- DELETE FROM countries c WHERE NOT EXISTS (SELECT 1 FROM cities WHERE country_code = c.code) AND c.active = true AND c.code IN ('…');
```

Per-country rollback instead of watermarks:
```sql
DELETE FROM venues v USING cities c
WHERE v.city_id = c.id AND c.country_code = 'DE' AND v.submitted_by IS NULL;
```
> The `submitted_by IS NULL` filter avoids touching user-submitted venues. If other imports/inserts
> happened after your watermark, prefer the per-country form.

---

## 6. Notes

- **Idempotent**: safe to re-apply; `city_id` is resolved by sub-select at apply time, so the files
  don't depend on serial IDs.
- **Attribution** (ODbL/CC-BY): "© OpenStreetMap contributors · Overture · GeoNames" is already shown
  in **Settings → Data sources** (`src/screens/SettingsScreen.tsx`). Keep it.
- **Romania is intentionally empty**: all 103 RO points fell within 100 m of existing venues, so dedup
  dropped them (existing data wins).
- **Regenerate** (e.g. a newer Overture release or tweaked rules): re-run `scripts/osm-import/00→04`.
  Staging/dedup/naming knobs are constants at the top of `04-derive.mjs`
  (`CITY_ACTIVE`, `CITY_STATUS`, `DUP_M`, `POI_MAX_M`, `DESCRIPTOR`).
