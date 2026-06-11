#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Apply OSM venue seeds — with a 50 m GEO-DEDUP against existing venues.
#
# Inserts seed venues but SKIPS any incoming venue that lies within RADIUS_M
# metres (default 50) of a venue ALREADY in the target DB. Cities are still
# matched/created on (country_code, name) — existing cities are reused, never
# duplicated — and venues attach to existing OR new cities, gated only by the
# perimeter (unless NEW_CITIES_ONLY=1, see below).
#
# Two dedup layers are applied to every venue insert:
#   1. geo gate          — WHERE NOT EXISTS (an existing venue within RADIUS_M m)
#   2. exact idempotency — the file's own ON CONFLICT (name, city_id) DO NOTHING
#
# The seed files are NEVER modified — the gate is injected into a temp copy at
# apply time (awk). Everything stays idempotent and safe to re-run.
#
# How the gate is evaluated: an INSERT...SELECT's NOT EXISTS sees the table as
# it was BEFORE that statement, so dedup is against venues already in the DB
# (incl. earlier countries/statements in this same run). Intra-statement
# co-located rows were already collapsed at generation time.
#
# Usage:
#   export DB="postgresql://postgres.<ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
#   ./apply_with_geo_dedup.sh                     # all 44 countries, 50 m gate
#   ./apply_with_geo_dedup.sh de fr ch            # only these country files
#   RADIUS_M=100 ./apply_with_geo_dedup.sh me     # use a 100 m gate instead
#   NEW_CITIES_ONLY=1 ./apply_with_geo_dedup.sh   # ALSO skip existing cities entirely
#   DRY_RUN=1 ./apply_with_geo_dedup.sh me        # validate against prod, persist NOTHING
#
# Tip: psql ships with libpq — if it's not on PATH:
#   export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
# ---------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

: "${DB:?Set DB to your target connection string, e.g. export DB=postgresql://...}"
DRY_RUN="${DRY_RUN:-0}"
RADIUS_M="${RADIUS_M:-50}"
NEW_CITIES_ONLY="${NEW_CITIES_ONLY:-0}"
PSQL=(psql "$DB" -v ON_ERROR_STOP=1 -X)

# bounding-box half-width, in degrees latitude, for RADIUS_M (+2% safety margin
# so the cheap pre-filter can never exclude a true within-radius match — the
# exact haversine below makes the precise cut).
LATD="$(awk -v r="$RADIUS_M" 'BEGIN{ printf "%.8f", (r/111320.0)*1.02 }')"

# --- pick country files (args, else all two-letter <cc>.sql) ---------------
FILES=()
if [ "$#" -gt 0 ]; then
  for cc in "$@"; do FILES+=("${cc}.sql"); done
else
  for f in [a-z][a-z].sql; do FILES+=("$f"); done
fi

echo "==> Target host     : ${DB##*@}"          # never prints the password
echo "==> Files           : ${#FILES[@]} (${FILES[*]})"
echo "==> Dedup radius    : ${RADIUS_M} m  (bbox lat half-width ${LATD}°)"
echo "==> New cities only : $([ "$NEW_CITIES_ONLY" != 0 ] && echo 'YES — also skip venues in pre-existing cities' || echo 'no — venues may enter existing cities, gated by radius')"
echo "==> Mode            : $([ "$DRY_RUN" != 0 ] && echo 'DRY RUN (rolls back, persists nothing)' || echo 'LIVE apply')"
echo

# --- preflight: connectivity + current state -------------------------------
echo "== Preflight (current DB state) =="
"${PSQL[@]}" -tAc "select 'countries='||count(*) from countries
  union all select 'cities   ='||count(*) from cities
  union all select 'venues   ='||count(*) from venues"

C0="$("${PSQL[@]}" -tAc "select coalesce(max(id),0) from cities")"
V0="$("${PSQL[@]}" -tAc "select coalesce(max(id),0) from venues")"
case "$C0$V0" in *[!0-9]*) echo "!! could not read integer watermarks (C0='$C0' V0='$V0')"; exit 1;; esac
echo "== Watermarks: C0(max city id)=$C0  V0(max venue id)=$V0 =="

# --- ensure a (lat,lng) index so the geo gate is fast ----------------------
# Without this the gate degrades to a sequential scan per incoming row.
IDX_PRE="$("${PSQL[@]}" -tAc "select count(*) from pg_indexes where schemaname='public' and indexname='idx_venues_lat_lng'")"
if [ "$DRY_RUN" = "0" ] || [ "$IDX_PRE" = "0" ]; then
  echo "== Ensuring idx_venues_lat_lng (speeds up the ${RADIUS_M} m gate) =="
  "${PSQL[@]}" -c "CREATE INDEX IF NOT EXISTS idx_venues_lat_lng ON public.venues(lat, lng);"
fi
echo

if [ "$DRY_RUN" = "0" ]; then
  TS="$(date -u +%Y%m%dT%H%M%SZ)"
  WMFILE="$HERE/.geo_dedup_watermarks_${TS}.txt"
  printf 'target_host=%s\nradius_m=%s\nnew_cities_only=%s\nC0=%s\nV0=%s\nfiles=%s\n' \
    "${DB##*@}" "$RADIUS_M" "$NEW_CITIES_ONLY" "$C0" "$V0" "${FILES[*]}" > "$WMFILE"
  echo "== Rollback watermarks saved to: $WMFILE =="
  echo

  # Provenance ledger (migration 093): one import_runs row per live run;
  # inserted venues are stamped with it in the postflight, making rollback
  # an exact DELETE WHERE import_run_id = <id>.
  SOURCE_LABEL="osm_${TS}"
  RUN_ID="$("${PSQL[@]}" -tAc "
    insert into public.import_runs
      (source_label, files, radius_m, new_cities_only, city_watermark, venue_watermark)
    values
      ('${SOURCE_LABEL}', '${FILES[*]}', ${RADIUS_M},
       $([ "$NEW_CITIES_ONLY" != 0 ] && echo true || echo false), ${C0}, ${V0})
    returning id" | tr -d '[:space:]')"
  case "$RUN_ID" in *[!0-9]*|'') echo "!! could not create import_runs row (RUN_ID='$RUN_ID')"; exit 1;; esac
  echo "== import_runs ledger row: id=$RUN_ID  source=$SOURCE_LABEL =="
  echo
fi

# --- awk injector ----------------------------------------------------------
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
AWKP="$TMP/inject.awk"
cat > "$AWKP" <<'AWK'
BEGIN { injected = 0; joins = 0 }

# (optional) restrict venues to NEW cities (id > C0) — mirrors apply_new_cities_only.sh
/^JOIN cities c ON c\.country_code='[A-Z][A-Z]' AND c\.name=v\.city$/ {
  joins++
  if (NEWCITIES == "1") { print $0 " AND c.id > " C0 } else { print }
  next
}

# inject the geo gate immediately before each venue ON CONFLICT
/^ON CONFLICT \(name,city_id\) DO NOTHING;$/ {
  print "WHERE NOT EXISTS ("
  print "  SELECT 1 FROM public.venues e"
  print "  WHERE e.lat BETWEEN (v.lat)::double precision - " LATD
  print "                  AND (v.lat)::double precision + " LATD
  print "    AND e.lng BETWEEN (v.lng)::double precision - " LATD " / GREATEST(cos(radians((v.lat)::double precision)), 0.01)"
  print "                  AND (v.lng)::double precision + " LATD " / GREATEST(cos(radians((v.lat)::double precision)), 0.01)"
  print "    AND 6371000 * 2 * asin(sqrt("
  print "          power(sin(radians((e.lat - (v.lat)::double precision) / 2)), 2)"
  print "          + cos(radians((v.lat)::double precision)) * cos(radians(e.lat))"
  print "            * power(sin(radians((e.lng - (v.lng)::double precision) / 2)), 2)"
  print "        )) <= " RADIUS
  print ")"
  injected++
  print
  next
}

# dry-run: make the file persist nothing
/^COMMIT;$/ {
  if (DRYRUN == "1") { print "ROLLBACK;" } else { print }
  next
}

{ print }

END { print "JOINS=" joins " INJECTED=" injected > "/dev/stderr" }
AWK

# --- apply loop ------------------------------------------------------------
for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then echo "!! missing $f — skipping"; continue; fi
  exp_oc="$(grep -cE "^ON CONFLICT \(name,city_id\) DO NOTHING;$" "$f" || true)"
  exp_jn="$(grep -cE "^JOIN cities c ON c\.country_code='[A-Z][A-Z]' AND c\.name=v\.city$" "$f" || true)"
  out="$TMP/$f"

  awk -v RADIUS="$RADIUS_M" -v LATD="$LATD" -v C0="$C0" \
      -v NEWCITIES="$NEW_CITIES_ONLY" -v DRYRUN="$DRY_RUN" \
      -f "$AWKP" "$f" 2> "$TMP/err" > "$out"
  got_jn="$(sed -n 's/.*JOINS=\([0-9]*\).*/\1/p' "$TMP/err")"
  got_oc="$(sed -n 's/.*INJECTED=\([0-9]*\).*/\1/p' "$TMP/err")"

  # safety: structure must be exactly what we expect, else abort before touching the DB
  if [ "$exp_oc" = "0" ]; then
    echo "!! $f: found no venue inserts (ON CONFLICT (name,city_id)) — ABORTING (unexpected file shape)"
    exit 1
  fi
  if [ "$exp_oc" != "$got_oc" ] || [ "$exp_jn" != "$got_jn" ]; then
    echo "!! $f: structure mismatch (ON CONFLICT exp=$exp_oc got=$got_oc; JOIN exp=$exp_jn got=$got_jn) — ABORTING"
    exit 1
  fi

  printf '== %-7s  gates injected: %s%s\n' "$f" "$got_oc" "$([ "$DRY_RUN" != 0 ] && echo '   [DRY-RUN]')"
  "${PSQL[@]}" -f "$out"      # psql prints "INSERT 0 N" per statement = live row counts
done
echo

# --- postflight (live runs only) -------------------------------------------
if [ "$DRY_RUN" = "0" ]; then
  echo "== Postflight =="
  # Stamp provenance on this run's rows. submitted_by IS NULL excludes any
  # real user submission that landed mid-run; source='user' (the default)
  # guards against double-stamping on re-runs.
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
  echo "cities added : $cities_added"
  echo "venues added : $venues_added"
  echo
  echo "-- gate self-check: venues added THIS run that sit within ${RADIUS_M} m of a PRE-EXISTING venue (must be 0) --"
  bad="$("${PSQL[@]}" -tAc "
    select count(*) from venues n
    where n.id > $V0
      and exists (
        select 1 from venues e
        where e.id <= $V0
          and e.lat between n.lat - $LATD and n.lat + $LATD
          and e.lng between n.lng - $LATD / greatest(cos(radians(n.lat)),0.01)
                        and n.lng + $LATD / greatest(cos(radians(n.lat)),0.01)
          and 6371000 * 2 * asin(sqrt(
                power(sin(radians((e.lat - n.lat)/2)),2)
                + cos(radians(n.lat))*cos(radians(e.lat))*power(sin(radians((e.lng - n.lng)/2)),2)
              )) <= $RADIUS_M
      )")"
  echo "within-${RADIUS_M}m of pre-existing (must be 0): $bad"
  [ "$bad" = "0" ] || echo "!! WARNING: $bad added venue(s) within ${RADIUS_M} m of a pre-existing venue — investigate before trusting this run."
  echo
  echo "-- per country (this run) --"
  "${PSQL[@]}" -c "
    select co.code, co.name,
           count(distinct ci.id) filter (where ci.id > $C0) as new_cities,
           count(v.id)                                       as venues_added
    from venues v
    join cities ci  on ci.id = v.city_id
    join countries co on co.code = ci.country_code
    where v.id > $V0
    group by 1,2 order by venues_added desc;"
  echo
  echo "== Rollback (children before parents; exact via the provenance ledger) =="
  echo "  psql \"\$DB\" -c \"delete from venues where import_run_id = ${RUN_ID};\""
  echo "  psql \"\$DB\" -c \"delete from cities where id > $C0 and not exists (select 1 from venues v where v.city_id = cities.id);\""
fi

# --- dry-run cleanup: drop the index only if WE created it ------------------
if [ "$DRY_RUN" != "0" ] && [ "$IDX_PRE" = "0" ]; then
  "${PSQL[@]}" -c "DROP INDEX IF EXISTS public.idx_venues_lat_lng;" >/dev/null 2>&1 || true
fi

echo "Done."
