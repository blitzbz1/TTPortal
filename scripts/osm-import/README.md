# OSM table-tennis → TTPortal venue import

One-off, **idempotent**, review-before-apply import of OpenStreetMap `sport=table_tennis`
tables (`/tables.json`, 47,209 points across Europe) into `venues`.

Reverse-geocoding is done **locally** by streaming [Overture Maps](https://overturemaps.org)
GeoParquet (release `2026-05-20.0`) through DuckDB, plus an offline
[GeoNames](https://www.geonames.org) `cities1000` gazetteer for clean city/region/county.
No data is written to any database by these scripts — they emit reviewable SQL.

## Pipeline (run from this directory)

```bash
# 0. tools: brew install duckdb ; GeoNames + cities1000 land in ./data (gitignored)
duckdb < 00-prep.sql            # tables.json -> data/points.parquet ; GeoNames -> data/geonames_eu.parquet
duckdb < 01-admin.sql           # country (Overture PIP) + nearest GeoNames city -> data/pts_admin.parquet
duckdb < 02-enrich-overture.sql # containing park/square, nearest good POI, nearest street -> data/enr_*.parquet
duckdb < 03-combine.sql         # join everything + existing-venue proximity -> data/enriched.ndjson
node    04-derive.mjs           # derive venues, dedupe, collapse, validate -> ../../supabase/seeds/osm/<cc>.sql + REPORT.md
```

## Maintenance (operate on the already-emitted SQL, preserving any manual name edits)

`04-derive.mjs` regenerates from scratch and would overwrite hand-edited names. To re-collapse or
re-report **in place** instead:

```bash
node collapse-venues.mjs ../../supabase/seeds/osm ../../supabase/seeds/osm  # merge co-located dup rows
node update-report.mjs                                                      # rebuild REPORT.md from the SQL
```

## Derivation rules

- **Name** (local-language descriptor + local place name; descriptor map in `04-derive.mjs`):
  OSM name → containing park/square → nearby park/plaza/playground POI (≤150 m) → nearest street → else **drop**.
- **Collapse:** tables sharing `(cc, city, name)` that are **single-linkage-connected within 100 m** are merged
  into one venue with `tables_count` = the cluster size (centroid location). Same-name tables that sit far apart
  (a street/park name spanning a town, a generic `Spielplatz`, a `Naturpark` polygon) stay **separate** venues,
  re-disambiguated with a deterministic ` (2)`, ` (3)` suffix.
- **Dedup:** any point within **100 m** of an existing venue is dropped (existing wins). Snapshot = `backups/venues.json`.
- **Fields:** `type=parc_exterior`; `free_access`←`fee`/`access`; `night_lighting`←`lit`; `hours`←`opening_hours`;
  `tables_count`←co-located table count; `description`←`operator`; `approved=true`, `verified=false`, `submitted_by=NULL`.
- A row is dropped (and counted in `REPORT.md`) if it lacks a country, a city within 30 km, or any NOT-NULL field.

## Applying the output (you do this, after review)

`supabase/seeds/osm/<cc>.sql` are self-contained + idempotent (`ON CONFLICT DO NOTHING`, `city_id`
resolved by sub-select). Review `REPORT.md` first, then apply e.g. one country to the **local** stack:

```bash
psql "$LOCAL_DB_URL" -f ../../supabase/seeds/osm/de.sql   # re-running inserts 0 rows
```

Attribution: imported data requires "© OpenStreetMap contributors · © Overture Maps · GeoNames" in-app.
