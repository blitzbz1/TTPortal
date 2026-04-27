import { createMMKV } from 'react-native-mmkv';

// Persistent on-device venue list, scoped by (city, type). Each scope holds:
//   - venues: full list as currently known to the device
//   - syncedAt: ISO timestamp passed back to the server on the next delta call
const store = createMMKV({ id: 'venues-cache-v1' });

export interface PersistedVenue {
  id: number;
  name: string;
  type: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  tables_count: number | null;
  condition: string | null;
  free_access: boolean | null;
  night_lighting: boolean | null;
  nets: boolean | null;
  verified: boolean | null;
  approved: boolean | null;
  updated_at: string;
  created_at: string;
}

export interface VenueScopeCache {
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
  store.set(scopeKey(city, type), JSON.stringify(cache));
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
