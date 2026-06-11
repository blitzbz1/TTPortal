#!/usr/bin/env node
// 04-derive.mjs — derive venue rows from enriched.ndjson and emit idempotent per-country SQL.
// No external deps. Run AFTER 03-combine.sql: node 04-derive.mjs   (cwd = scripts/osm-import)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, 'data');
const OUT  = process.env.OSM_OUT || join(HERE, '..', '..', 'supabase', 'seeds', 'osm'); // override for dry runs
mkdirSync(OUT, { recursive: true });

const CITY_MAX_M = 30000;   // skip points whose nearest city is farther than this
const DUP_M      = 100;     // existing-venue precedence radius
const POI_MAX_M  = 150;     // max distance to trust a POI as the name source

// --- STAGING --------------------------------------------------------------
// Imported cities are inserted INACTIVE so applying the SQL does not "launch"
// thousands of live markets. active=false → the app's normalizeExpansionStatus
// treats the city as 'hidden' (kept out of the location picker / country list).
// The intended status is recorded so activation is a one-line UPDATE (see DEPLOYMENT.md).
// Venues stay approved=true (curated, not user submissions — approved=false would
// flood the unbounded admin moderation queue).
const CITY_ACTIVE = false;
const CITY_STATUS = 'community_review';

// --- country code -> English name (GeoNames countryInfo.txt) ----------------
const ccName = {};
for (const line of readFileSync(join(DATA, 'countryInfo.txt'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const c = line.split('\t');
  if (c[0] && c[4]) ccName[c[0]] = c[4];
}
const countryName = (cc) => ccName[cc] || cc;

// --- local-language descriptor by country (place name stays local) ----------
const DESCRIPTOR = {
  DE:'Tischtennis', AT:'Tischtennis', CH:'Tischtennis', LI:'Tischtennis',
  FR:'Tennis de table', MC:'Tennis de table', LU:'Tennis de table',
  BE:'Tafeltennis', NL:'Tafeltennis',
  IT:'Tennis da tavolo', SM:'Tennis da tavolo', VA:'Tennis da tavolo',
  ES:'Tenis de mesa', AD:'Tenis de mesa', PT:'Ténis de mesa',
  GB:'Table tennis', IE:'Table tennis', MT:'Table tennis',
  RO:'Masă de ping pong', MD:'Masă de ping pong',
  PL:'Tenis stołowy', CZ:'Stolní tenis', SK:'Stolný tenis', HU:'Asztalitenisz',
  DK:'Bordtennis', SE:'Bordtennis', NO:'Bordtennis', FI:'Pöytätennis', IS:'Borðtennis',
  EE:'Lauatennis', LV:'Galda teniss', LT:'Stalo tenisas',
  SI:'Namizni tenis', HR:'Stolni tenis', RS:'Stoni tenis', BA:'Stoni tenis', ME:'Stoni tenis',
  BG:'Тенис на маса', RU:'Настольный теннис', BY:'Настольный теннис', UA:'Настільний теніс',
  TR:'Masa tenisi', AL:'Tenis tavoline',
};
const descriptor = (cc) => DESCRIPTOR[cc] || 'Table tennis';

// A named containing land_use polygon is a good location name UNLESS its class reads poorly
// (farmland, forest, industrial, …). Blacklist beats whitelist here — captures schools, campsites,
// plazas, water parks, recreation grounds, etc. (arg_min(area) already picked the most specific one).
const BAD_LAND = new Set([
  'farmland','farmyard','forest','meadow','orchard','vineyard','grass','scrub','heath','wetland',
  'industrial','military','quarry','landfill','construction','brownfield','greenfield','railway',
  'cemetery','basin','reservoir','salt_pond','aquaculture','plant_nursery','garages','depot',
]);
const goodPark = (cls) => cls != null && !BAD_LAND.has(cls);

// --- city canonicalization (mirror of src/lib/cityCatalog.ts) ----------------
const cityKey = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const PIATRA = 'Piatra Neamț';
const PIATRA_KEY = cityKey(PIATRA);
const canonicalCity = (name) => { const t = String(name).trim(); return cityKey(t) === PIATRA_KEY ? PIATRA : t; };

// Common English exonyms → local endonym (keeps city names local + matches existing rows).
const EXONYM = {
  Bucharest:'București', Warsaw:'Warszawa', Lisbon:'Lisboa', Vienna:'Wien', Munich:'München',
  Cologne:'Köln', Nuremberg:'Nürnberg', Prague:'Praha', Rome:'Roma', Naples:'Napoli', Milan:'Milano',
  Turin:'Torino', Florence:'Firenze', Venice:'Venezia', Genoa:'Genova', Geneva:'Genève', Zurich:'Zürich',
  Brussels:'Bruxelles', Antwerp:'Antwerpen', 'The Hague':'Den Haag', Copenhagen:'København',
  Gothenburg:'Göteborg', Belgrade:'Beograd',
};
// GeoNames uses legacy cedilla forms for Romanian; the app uses comma-below. Normalize.
const fixRo = (s) => s.replace(/ş/g,'ș').replace(/Ş/g,'Ș').replace(/ţ/g,'ț').replace(/Ţ/g,'Ț');
function localizeCity(name, cc) {
  let n = String(name).trim();
  if (EXONYM[n]) n = EXONYM[n];
  if (cc === 'RO' || cc === 'MD') n = fixRo(n);
  return canonicalCity(n);
}

// --- SQL helpers -------------------------------------------------------------
const q       = (s) => `'${String(s).replace(/'/g, "''")}'`;
const qn      = (s) => (s == null || s === '') ? 'NULL' : q(s);
const num     = (n) => (n == null || !Number.isFinite(n)) ? 'NULL' : (Math.round(n * 1e7) / 1e7).toString();
const boolean = (b) => (b ? 'true' : 'false');
const arr     = (a) => (a && a.length) ? `ARRAY[${a.map(q).join(',')}]` : `ARRAY[]::text[]`;

// --- read enriched rows ------------------------------------------------------
const rows = readFileSync(join(DATA, 'enriched.ndjson'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);

const drops = { no_country: 0, no_city: 0, dup_existing: 0, no_name: 0, invalid: 0 };
const nameSrc = { osm: 0, park: 0, poi: 0, street: 0, land: 0 };
const venues = [];

const lc = (s) => (s == null ? '' : String(s).toLowerCase());
function freeAccess(r) {
  const fee = lc(r.tag_fee), acc = lc(r.tag_access);
  if (fee === 'no') return true;
  if (fee === 'yes') return false;
  if (['yes','permissive','customers','public','designated'].includes(acc)) return true;
  if (['private','no','permit','employees'].includes(acc)) return false;
  return true; // outdoor public tables default to free
}
function deriveName(r) {
  const d = descriptor(r.cc);
  if (r.osm_name)                                              { nameSrc.osm++;    return r.osm_name; }
  if (r.park_name && goodPark(r.park_class))                   { nameSrc.park++;   return `${d} ${r.park_name}`; }
  if (r.poi_name && r.poi_dist_m != null && r.poi_dist_m <= POI_MAX_M) { nameSrc.poi++; return `${d} ${r.poi_name}`; }
  if (r.street)                                               { nameSrc.street++; return `${d} ${r.street}`; }
  return null;
}
function deriveAddress(r) {
  const parts = [];
  if (r.street) parts.push(r.number ? `${r.street} ${r.number}` : r.street);
  else if (r.park_name && goodPark(r.park_class)) parts.push(r.park_name);
  else if (r.poi_name && r.poi_dist_m != null && r.poi_dist_m <= POI_MAX_M) parts.push(r.poi_name);
  if (r.city) parts.push(r.city);
  return parts.join(', ').trim() || r.city || null;
}

for (const r of rows) {
  if (!r.cc) { drops.no_country++; continue; }
  if (!r.city || r.city_dist_m == null || r.city_dist_m > CITY_MAX_M) { drops.no_city++; continue; }
  if (r.min_existing_m != null && r.min_existing_m < DUP_M) { drops.dup_existing++; continue; }
  const name = deriveName(r);
  if (!name) { drops.no_name++; continue; }
  const city = localizeCity(r.city, r.cc);
  const isRo = r.cc === 'RO' || r.cc === 'MD';
  const region = r.region ? (isRo ? fixRo(r.region) : r.region) : null;
  const county = (r.county || r.region) ? (isRo ? fixRo(r.county || r.region) : (r.county || r.region)) : null;
  const v = {
    osm_id: r.osm_id, cc: r.cc, name: name.trim(), type: 'parc_exterior',
    city, county, sector: null,
    address: deriveAddress({ ...r, city }), lat: r.lat, lng: r.lng,
    tables_count: 1, free_access: freeAccess(r),
    night_lighting: lc(r.tag_lit) === 'yes' || lc(r.tag_lit) === 'street_light',
    hours: r.tag_hours || null, description: r.tag_operator || null, tags: ['exterior'],
    approved: true, verified: false,
    city_lat: r.city_lat, city_lng: r.city_lng, region,
  };
  if (!v.name || !v.city || !v.address || !Number.isFinite(v.lat) || !Number.isFinite(v.lng)) { drops.invalid++; continue; }
  venues.push(v);
}

// --- collapse co-located same-name tables into one venue ----------------------
// Tables sharing (cc, city, name) within CLUSTER_M are the SAME physical venue: merge into one
// row whose tables_count is the cluster size. Same-name tables that are far apart stay separate
// venues (re-suffixed below). Mirrors the geometry used for existing-venue precedence.
const CLUSTER_M = DUP_M; // 100 m — "within this radius = same place"
function distM(a, b) {
  const rad = (d) => d * Math.PI / 180, R = 6371000;
  const dlat = rad(b.lat - a.lat), dlng = rad(b.lng - a.lng);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function singleLinkage(group, T) { // connected components under "<= T metres apart"
  const n = group.length, parent = [...Array(n).keys()];
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (distM(group[i], group[j]) <= T) parent[find(i)] = find(j);
  const m = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); (m.get(r) || m.set(r, []).get(r)).push(group[i]); }
  return [...m.values()];
}
const byKey = new Map();
for (const v of venues) {
  const k = `${v.cc} ${v.city} ${v.name}`;
  (byKey.get(k) || byKey.set(k, []).get(k)).push(v);
}
venues.forEach((v, i) => { v._idx = i; });        // preserve emission order across the collapse
let suffixed = 0, mergedVenues = 0;
const collapsed = [];
for (const group of byKey.values()) {
  // Tables far apart but sharing a name (street/park spanning a town, generic "Spielplatz",
  // a "Naturpark X" polygon) must NOT fuse: split each name-group into single-linkage clusters
  // and collapse only co-located ones. Distant siblings stay separate, re-suffixed ' (2)'…
  const subs = singleLinkage(group, CLUSTER_M)
    .sort((a, b) => Math.min(...a.map(x => x.osm_id)) - Math.min(...b.map(x => x.osm_id)));
  subs.forEach((sub, si) => {
    sub.sort((a, b) => a.osm_id - b.osm_id);
    const rep = sub[0];                            // representative carries the non-merged fields
    rep.tables_count   = sub.reduce((s, x) => s + x.tables_count, 0);
    rep.lat            = sub.reduce((s, x) => s + x.lat, 0) / sub.length;  // cluster centroid
    rep.lng            = sub.reduce((s, x) => s + x.lng, 0) / sub.length;
    rep.hours          = sub.map(x => x.hours).find(h => h != null) ?? null;
    rep.description    = sub.map(x => x.description).find(d => d != null) ?? null;
    rep.night_lighting = sub.some(x => x.night_lighting);
    if (sub.length > 1) mergedVenues++;
    if (si > 0) { rep.name = `${rep.name} (${si + 1})`; suffixed++; }
    collapsed.push(rep);
  });
}
collapsed.sort((a, b) => a._idx - b._idx);
venues.length = 0; venues.push(...collapsed);

// --- aggregate cities + countries --------------------------------------------
const cities = new Map();   // cc city -> {cc,name,country_name,region,county,lat,lng}
const countries = new Map();
for (const v of venues) {
  countries.set(v.cc, countryName(v.cc));
  const k = `${v.cc} ${v.city}`;
  if (!cities.has(k) && Number.isFinite(v.city_lat) && Number.isFinite(v.city_lng)) {
    cities.set(k, { cc: v.cc, name: v.city, country_name: countryName(v.cc),
      region: v.region || null, county: v.county || null, lat: v.city_lat, lng: v.city_lng });
  }
}

// --- emit per-country SQL ----------------------------------------------------
// wipe previous output
for (const f of readdirSync(OUT)) if (f.endsWith('.sql')) writeFileSync(join(OUT, f), '');
const ccs = [...countries.keys()].sort();
const perCountryCount = {};
const BATCH = 1000;

for (const cc of ccs) {
  const cv = venues.filter(v => v.cc === cc);
  const cc_cities = [...cities.values()].filter(c => c.cc === cc).sort((a,b)=>a.name.localeCompare(b.name));
  perCountryCount[cc] = { venues: cv.length, cities: cc_cities.length };
  const L = [];
  L.push(`-- ${cc} — ${countryName(cc)} — ${cv.length} venues, ${cc_cities.length} cities`);
  L.push(`-- Idempotent: safe to run multiple times. Source: OpenStreetMap via Overture Maps + GeoNames.`);
  L.push(`-- STAGED: cities active=false, expansion_status='${CITY_STATUS}' (hidden in-app until activated — see DEPLOYMENT.md). Venues approved=true.`);
  L.push(`BEGIN;`);
  L.push(`INSERT INTO countries (code,name,active) VALUES (${q(cc)},${q(countryName(cc))},true) ON CONFLICT (code) DO NOTHING;`);
  // cities
  L.push(`INSERT INTO cities (name,country_code,country_name,admin_area,county,lat,lng,zoom,active,expansion_status) VALUES`);
  L.push(cc_cities.map(c =>
    `  (${q(c.name)},${q(cc)},${q(c.country_name)},${qn(c.region)},${qn(c.county)},${num(c.lat)},${num(c.lng)},12,${boolean(CITY_ACTIVE)},${q(CITY_STATUS)})`
  ).join(',\n') + `\nON CONFLICT (country_code,name) DO NOTHING;`);
  // venues (batched)
  for (let i = 0; i < cv.length; i += BATCH) {
    const batch = cv.slice(i, i + BATCH);
    L.push(`INSERT INTO venues (name,type,city,city_id,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified,submitted_by)`);
    L.push(`SELECT v.name,v.type,v.city,c.id,v.county::text,v.sector::text,v.address,v.lat::double precision,v.lng::double precision,v.tables_count::int,v.free_access::boolean,v.night_lighting::boolean,v.hours::text,v.description::text,v.tags::text[],v.approved::boolean,v.verified::boolean,NULL`);
    L.push(`FROM (VALUES`);
    L.push(batch.map(v =>
      `  (${q(v.name)},'parc_exterior',${q(v.city)},${qn(v.county)},NULL,${q(v.address)},${num(v.lat)},${num(v.lng)},${v.tables_count},${boolean(v.free_access)},${boolean(v.night_lighting)},${qn(v.hours)},${qn(v.description)},${arr(v.tags)},true,false)`
    ).join(',\n'));
    L.push(`) AS v(name,type,city,county,sector,address,lat,lng,tables_count,free_access,night_lighting,hours,description,tags,approved,verified)`);
    L.push(`JOIN cities c ON c.country_code=${q(cc)} AND c.name=v.city`);
    L.push(`ON CONFLICT (name,city_id) DO NOTHING;`);
  }
  L.push(`COMMIT;`);
  writeFileSync(join(OUT, `${cc.toLowerCase()}.sql`), L.join('\n') + '\n');
}

// run_all.sql (psql relative includes)
writeFileSync(join(OUT, 'run_all.sql'),
  `-- Apply all country imports. Run from this dir: psql "$DB_URL" -f run_all.sql\n` +
  ccs.map(cc => `\\ir ${cc.toLowerCase()}.sql`).join('\n') + '\n');

// --- REPORT.md ---------------------------------------------------------------
const kept = venues.length;
const tablesRepresented = venues.reduce((s, v) => s + v.tables_count, 0); // = venue rows before collapse
const topCountries = ccs.map(cc => ({ cc, ...perCountryCount[cc] })).sort((a,b)=>b.venues-a.venues);
const sample = (cc, n=12) => venues.filter(v=>v.cc===cc).slice(0, n).map(v=>`  - ${v.name}  —  ${v.address}`).join('\n');
const rep = [];
rep.push(`# OSM → TTPortal venue import — REPORT`);
rep.push(``);
rep.push(`Source: tables.json (${rows.length} OSM points) → Overture Maps ${'`2026-05-20.0`'} + GeoNames.`);
rep.push(``);
rep.push(`## Totals`);
rep.push(`- Input points: **${rows.length}**`);
rep.push(`- **Venues emitted: ${kept}**  across **${cities.size} cities** / **${countries.size} countries**`);
rep.push(`- Tables represented (co-located same-name tables merged into one venue): ${tablesRepresented}`);
rep.push(`- Venues that merged ≥2 co-located tables: ${mergedVenues}`);
rep.push(`- Distant same-name venues kept separate (suffixed ' (2)'…): ${suffixed}`);
rep.push(``);
rep.push(`## Dropped (${rows.length - tablesRepresented})`);
rep.push(`| reason | count |`);
rep.push(`|---|---|`);
rep.push(`| within ${DUP_M} m of an existing venue (precedence) | ${drops.dup_existing} |`);
rep.push(`| no resolvable place/street name | ${drops.no_name} |`);
rep.push(`| no city within ${CITY_MAX_M/1000} km | ${drops.no_city} |`);
rep.push(`| no country | ${drops.no_country} |`);
rep.push(`| failed validation | ${drops.invalid} |`);
rep.push(``);
rep.push(`## Name source`);
rep.push(`| source | count |`);
rep.push(`|---|---|`);
rep.push(`| OSM own name | ${nameSrc.osm} |`);
rep.push(`| containing park/square | ${nameSrc.park} |`);
rep.push(`| nearby POI (≤${POI_MAX_M} m) | ${nameSrc.poi} |`);
rep.push(`| nearest street | ${nameSrc.street} |`);
rep.push(`| other named area | ${nameSrc.land} |`);
rep.push(``);
rep.push(`## Per country (venues / cities)`);
rep.push(`| cc | country | venues | cities |`);
rep.push(`|---|---|---|---|`);
for (const c of topCountries) rep.push(`| ${c.cc} | ${countryName(c.cc)} | ${c.venues} | ${c.cities} |`);
rep.push(``);
rep.push(`## Samples (top 5 countries)`);
for (const c of topCountries.slice(0,5)) { rep.push(``); rep.push(`### ${c.cc} — ${countryName(c.cc)}`); rep.push(sample(c.cc)); }
writeFileSync(join(OUT, 'REPORT.md'), rep.join('\n') + '\n');

console.log(`Emitted ${kept} venues / ${cities.size} cities / ${countries.size} countries → ${OUT}`);
console.log(`Dropped:`, drops, ` suffixed:`, suffixed);
console.log(`Name source:`, nameSrc);
