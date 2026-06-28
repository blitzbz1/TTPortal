import { createMMKV } from 'react-native-mmkv';
import { VENUES_CACHE_SCHEMA_VERSION } from './cacheSchema';

// Persistent on-device venue list, scoped by (city, type). Each scope holds:
//   - v: VENUES_CACHE_SCHEMA_VERSION at write time (mismatch ⇒ cache miss ⇒ the
//     delta client re-syncs from since=null — delta sync never backfills
//     shape changes on its own). This is the venues-only version: bumping it
//     re-pulls venue scopes without touching the cities or offline-KV caches.
//   - venues: full list as currently known to the device
//   - syncedAt: ISO timestamp passed back to the server on the next delta call
const store = createMMKV({ id: 'venues-cache-v2' });

// Stage 3: the slim 12-field map/list row from get_venues_map_delta. The five
// fields the old 17-field shape carried — city, city_id, approved, updated_at,
// created_at — earned nothing on the load path (city duplicates
// selectedCity.name; the rest are client-dead), so they are dropped to cut the
// per-city-switch parse / MMKV-stringify / GC. address STAYS (read by search).
export interface PersistedVenue {
  id: number;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  tables_count: number | null;
  condition: string | null;
  free_access: boolean | null;
  night_lighting: boolean | null;
  nets: boolean | null;
  verified: boolean | null;
}

export interface VenueScopeCache {
  v?: number;
  venues: PersistedVenue[];
  syncedAt: string;
}

function scopeKey(city?: string | null, type?: string | null): string {
  return `scope:${city ?? 'all'}:${type ?? 'all'}`;
}

export function readVenueScope(city?: string | null, type?: string | null): VenueScopeCache | null {
  const raw = store.getString(scopeKey(city, type));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as VenueScopeCache;
    if (!parsed || !Array.isArray(parsed.venues)) return null;
    // Schema mismatch ⇒ miss (pre-versioning envelopes have v undefined).
    if (parsed.v !== VENUES_CACHE_SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeVenueScope(
  city: string | null | undefined,
  type: string | null | undefined,
  cache: VenueScopeCache,
): void {
  store.set(scopeKey(city, type), JSON.stringify({ ...cache, v: VENUES_CACHE_SCHEMA_VERSION }));
}

export function applyVenuesDelta(
  city: string | null | undefined,
  type: string | null | undefined,
  upserts: PersistedVenue[],
  tombstoneIds: number[],
  syncedAt: string,
): VenueScopeCache {
  const existing = readVenueScope(city, type) ?? { venues: [], syncedAt: '' };
  const tombstones = new Set(tombstoneIds);
  const upsertById = new Map(upserts.map((v) => [v.id, v]));

  const merged: PersistedVenue[] = [];
  for (const v of existing.venues) {
    if (tombstones.has(v.id)) continue;
    if (upsertById.has(v.id)) continue;
    merged.push(v);
  }
  for (const v of upsertById.values()) {
    if (!tombstones.has(v.id)) merged.push(v);
  }

  const next: VenueScopeCache = { venues: merged, syncedAt };
  writeVenueScope(city, type, next);
  return next;
}

export function clearVenuesCache(): void {
  store.clearAll();
}
