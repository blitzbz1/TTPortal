#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Apply OSM venue seeds — NEW CITIES ONLY.
#
# Adds the staged countries/cities that aren't in the DB yet and their venues,
# but does NOT add venues to cities that already exist (your curated markets
# keep their current venue lists untouched).
#
# How: capture C0 = max(cities.id) BEFORE applying anything, then restrict each
# file's venue join to cities created by THIS run (c.id > C0). New cities get
# ids > C0; pre-existing cities are <= C0 and therefore receive no new venues.
# The seed files themselves are never modified — the filter is injected into a
# temp copy at apply time. Everything stays idempotent (ON CONFLICT DO NOTHING).
#
# Usage:
#   export DB="postgresql://postgres.<ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
#   ./apply_new_cities_only.sh                 # all 44 countries
#   ./apply_new_cities_only.sh de fr ch        # only these country files
#   DRY_RUN=1 ./apply_new_cities_only.sh me    # validate against prod, persist NOTHING
#
# Tip: psql ships with libpq — if it's not on PATH:
#   export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
# ---------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

: "${DB:?Set DB to your target connection string, e.g. export DB=postgresql://...}"
DRY_RUN="${DRY_RUN:-0}"
PSQL=(psql "$DB" -v ON_ERROR_STOP=1 -X)

# --- pick country files (args, else all two-letter <cc>.sql) ---------------
FILES=()
if [ "$#" -gt 0 ]; then
  for cc in "$@"; do FILES+=("${cc}.sql"); done
else
  for f in [a-z][a-z].sql; do FILES+=("$f"); done
fi

echo "==> Target host : ${DB##*@}"          # never prints the password
echo "==> Files       : ${#FILES[@]} (${FILES[*]})"
echo "==> Mode        : $([ "$DRY_RUN" != 0 ] && echo 'DRY RUN (rolls back, persists nothing)' || echo 'LIVE apply')"
echo

# --- preflight: connectivity + current state -------------------------------
echo "== Preflight (current DB state) =="
"${PSQL[@]}" -tAc "select 'countries='||count(*) from countries
  union all select 'cities   ='||count(*) from cities
  union all select 'venues   ='||count(*) from venues
  union all select 'venues(submitted_by null)='||count(*) from venues where submitted_by is null"

C0="$("${PSQL[@]}" -tAc "select coalesce(max(id),0) from cities")"
V0="$("${PSQL[@]}" -tAc "select coalesce(max(id),0) from venues")"
case "$C0$V0" in *[!0-9]*) echo "!! could not read integer watermarks (C0='$C0' V0='$V0')"; exit 1;; esac
echo "== Watermarks: C0(max city id)=$C0  V0(max venue id)=$V0 =="
echo

if [ "$DRY_RUN" = "0" ]; then
  TS="$(date -u +%Y%m%dT%H%M%SZ)"
  WMFILE="$HERE/.apply_watermarks_${TS}.txt"
  printf 'target_host=%s\nC0=%s\nV0=%s\nfiles=%s\n' "${DB##*@}" "$C0" "$V0" "${FILES[*]}" > "$WMFILE"
  echo "== Rollback watermarks saved to: $WMFILE =="
  echo

  # Provenance ledger (migration 093) — see apply_with_geo_dedup.sh.
  SOURCE_LABEL="osm_${TS}"
  RUN_ID="$("${PSQL[@]}" -tAc "
    insert into public.import_runs
      (source_label, files, new_cities_only, city_watermark, venue_watermark)
    values
      ('${SOURCE_LABEL}', '${FILES[*]}', true, ${C0}, ${V0})
    returning id" | tr -d '[:space:]')"
  case "$RUN_ID" in *[!0-9]*|'') echo "!! could not create import_runs row (RUN_ID='$RUN_ID')"; exit 1;; esac
  echo "== import_runs ledger row: id=$RUN_ID  source=$SOURCE_LABEL =="
  echo
fi

# --- apply loop ------------------------------------------------------------
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then echo "!! missing $f — skipping"; continue; fi
  njoin="$(grep -cE "^JOIN cities c ON c\.country_code='[A-Z]{2}' AND c\.name=v\.city$" "$f" || true)"
  out="$TMP/$f"

  # 1) restrict venue joins to cities created by THIS run (id > C0)
  sed -E "s/^(JOIN cities c ON c\.country_code='[A-Z]{2}' AND c\.name=v\.city)\$/\1 AND c.id > ${C0}/" "$f" > "$out"
  # 2) dry run -> turn the file's COMMIT into ROLLBACK so nothing persists
  if [ "$DRY_RUN" != "0" ]; then
    sed -i.bak -E "s/^COMMIT;\$/ROLLBACK;/" "$out" && rm -f "$out.bak"
  fi
  # 3) safety: every venue join must have been transformed, else abort
  ntrans="$(grep -cE "AND c\.id > ${C0}\$" "$out" || true)"
  if [ "$njoin" != "$ntrans" ]; then
    echo "!! $f: expected to filter $njoin venue-join(s) but filtered $ntrans — ABORTING (no change applied for this file)"
    exit 1
  fi

  printf '== %-7s  venue-joins filtered: %s%s\n' "$f" "$njoin" "$([ "$DRY_RUN" != 0 ] && echo '   [DRY-RUN]')"
  "${PSQL[@]}" -f "$out"      # psql prints "INSERT 0 N" per statement = live row counts
done
echo

# --- postflight (live runs only) -------------------------------------------
if [ "$DRY_RUN" = "0" ]; then
  echo "== Postflight =="
  # Stamp provenance (see apply_with_geo_dedup.sh for the guards).
  "${PSQL[@]}" -c "
    update public.venues
       set source = '${SOURCE_LABEL}', import_run_id = ${RUN_ID}
     where id > ${V0} and submitted_by is null and source = 'user';"
  "${PSQL[@]}" -c "
    update public.import_runs
       set finished_at     = now(),
           venues_inserted = (select count(*) from public.venues where import_run_id = ${RUN_ID}),
           cities_inserted = (select count(*) from public.cities where id > ${C0})
     where id = ${RUN_ID};"
  cities_added="$("${PSQL[@]}" -tAc "select count(*) from cities where id > $C0")"
  venues_added="$("${PSQL[@]}" -tAc "select count(*) from venues where id > $V0")"
  bad="$("${PSQL[@]}" -tAc "select count(*) from venues where id > $V0 and submitted_by is null and city_id <= $C0")"
  echo "cities added : $cities_added"
  echo "venues added : $venues_added"
  echo "venues added into PRE-EXISTING cities (must be 0): $bad"
  [ "$bad" = "0" ] || echo "!! WARNING: $bad venue(s) attached to pre-existing cities — investigate before trusting this run."
  echo
  echo "-- per country (this run) --"
  "${PSQL[@]}" -c "
    select co.code, co.name,
           count(distinct ci.id) as cities_added,
           count(v.id)           as venues_added
    from cities ci
    join countries co on co.code = ci.country_code
    left join venues v on v.city_id = ci.id and v.id > $V0
    where ci.id > $C0
    group by 1,2 order by venues_added desc, cities_added desc;"
  echo
  echo "== Rollback (children before parents; exact via the provenance ledger) =="
  echo "  psql \"\$DB\" -c \"delete from venues where import_run_id = ${RUN_ID};\""
  echo "  psql \"\$DB\" -c \"delete from cities where id > $C0 and not exists (select 1 from venues v where v.city_id = cities.id);\""
fi
echo "Done."
