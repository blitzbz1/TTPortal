import { createMMKV } from 'react-native-mmkv';
import { CITIES_CACHE_SCHEMA_VERSION } from './cacheSchema';
import { compareRo } from './collation';
import { cleanCityCatalog } from './cityCatalog';
import { traceSegmentOnce } from './launchTrace';

const store = createMMKV({ id: 'cities-cache-v2' });
const KEY = 'cities';

export interface PersistedCity {
  id: number;
  name: string;
  county: string | null;
  country_code?: string | null;
  country_name?: string | null;
  admin_area?: string | null;
  local_area?: string | null;
  lat: number | null;
  lng: number | null;
  zoom: number | null;
  venue_count: number | null;
  active: boolean | null;
  expansion_status?: string | null;
  updated_at: string;
  // Stage 2 (T046): server-built ascii search key (folded name + admin_area +
  // local_area + county + country_name) shipped on every tier row by
  // get_cities_catalog_v2 / search_cities, so the switcher's substring filter has
  // a consistent diacritic-folded multi-field key. Optional: 063-shaped rows and
  // the client-only EXPANSION_CITY_WAVE entries omit it.
  search_key?: string | null;
}

export interface CitiesCache {
  v?: number;
  cities: PersistedCity[];
  syncedAt: string;
}

// T022: parse + clean memos. The cold mount reads the cities cache from several
// places (initialData, queryFn, every activeCities consumer); without
// memoization each re-parses the 3.35 MB blob and re-runs the compareRo sort.
// readCities now parses at most once per distinct stored string, and
// getCleanedCities cleans at most once per parsed-cache identity. Both are
// invalidated whenever the cache is written or cleared.
let lastRaw: string | null = null;
let lastResult: CitiesCache | null = null;
let cleanedFor: CitiesCache | null = null;
let cleanedMemo: PersistedCity[] | undefined;

function invalidateCitiesMemo(): void {
  lastRaw = null;
  lastResult = null;
  cleanedFor = null;
  cleanedMemo = undefined;
}

export function readCities(): CitiesCache | null {
  const raw = store.getString(KEY);
  if (!raw) return null;
  // T022: memo hit — the stored string is unchanged since the last parse, so
  // skip the 3.35 MB JSON.parse and return the previously validated result.
  if (raw === lastRaw) return lastResult;
  let result: CitiesCache | null = null;
  try {
    // T003 (Stage M): time the cold-mount parse in isolation. Once-only so the
    // high-frequency warm calls stay overhead-free; the first call (cold start)
    // is the one we want to measure.
    const parsed = traceSegmentOnce('cities: JSON.parse', () => JSON.parse(raw) as CitiesCache);
    // Valid only as an array payload at the current schema version (a mismatch
    // ⇒ miss ⇒ a full delta re-sync from since=null).
    if (parsed && Array.isArray(parsed.cities) && parsed.v === CITIES_CACHE_SCHEMA_VERSION) {
      result = parsed;
    }
  } catch {
    result = null;
  }
  lastRaw = raw;
  lastResult = result;
  return result;
}

export function writeCities(cache: CitiesCache): void {
  store.set(KEY, JSON.stringify({ ...cache, v: CITIES_CACHE_SCHEMA_VERSION }));
  invalidateCitiesMemo();
}

/**
 * The cleaned + compareRo-sorted catalog for the current cache, memoized on the
 * parsed cache's identity so `initialData` and the queryFn no-change path (T021)
 * share a single clean/sort. `undefined` when there is no cache (matches
 * useCitiesQuery's initialData contract). Memo invalidates on write/clear.
 */
export function getCleanedCities(): PersistedCity[] | undefined {
  const cache = readCities();
  if (!cache) return undefined;
  if (cache === cleanedFor && cleanedMemo) return cleanedMemo;
  cleanedMemo = cleanCityCatalog(cache.cities);
  cleanedFor = cache;
  return cleanedMemo;
}

// T054 / §8.7 — offline-upgrade migrator decision: we deliberately did NOT ship
// an in-place old-shape→tier-shape client migrator. The pre-Stage-2 cache held
// the full ~10,330-row catalog WITHOUT the server-built `search_key`; a migrator
// could filter rows to the tier predicate but cannot synthesize `search_key`, so
// the long-tail merge (T050) would be keyless. The CITIES_CACHE_SCHEMA_VERSION
// 1→2 bump instead forces ONE since=null re-pull of the authoritative tier (with
// search_key) on upgrade — offline users keep showing their persisted
// selectedCity (Stage 1.5) and re-pull the catalog on their next online sync.
// Break introduced at CITIES_CACHE_SCHEMA_VERSION = 2.
export function applyCitiesDelta(
  upserts: PersistedCity[],
  tombstoneIds: number[],
  syncedAt: string,
  base?: CitiesCache | null,
): CitiesCache {
  // T020: the hot queryFn path passes the cache it already read, so the merge
  // skips a redundant parse. refreshCatalog (the since=null full re-pull) passes
  // no base — its prior cache is being wholesale replaced, so the readCities
  // fallback is correct there.
  const existing = base ?? readCities() ?? { cities: [], syncedAt: '' };
  const tombstones = new Set(tombstoneIds);
  const upsertById = new Map(upserts.map((c) => [c.id, c]));

  const merged: PersistedCity[] = [];
  for (const c of existing.cities) {
    if (tombstones.has(c.id)) continue;
    if (upsertById.has(c.id)) continue;
    merged.push(c);
  }
  for (const c of upsertById.values()) {
    if (!tombstones.has(c.id)) merged.push(c);
  }
  merged.sort((a, b) => compareRo(a.name, b.name));

  const next: CitiesCache = { cities: merged, syncedAt };
  writeCities(next);
  return next;
}

export function clearCitiesCache(): void {
  store.clearAll();
  invalidateCitiesMemo();
}
