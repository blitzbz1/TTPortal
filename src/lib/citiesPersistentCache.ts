import { createMMKV } from 'react-native-mmkv';

const store = createMMKV({ id: 'cities-cache-v1' });
const KEY = 'cities';

export interface PersistedCity {
  id: number;
  name: string;
  county: string | null;
  lat: number | null;
  lng: number | null;
  zoom: number | null;
  venue_count: number | null;
  active: boolean | null;
  updated_at: string;
}

export interface CitiesCache {
  cities: PersistedCity[];
  syncedAt: string;
}

export function readCities(): CitiesCache | null {
  const raw = store.getString(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CitiesCache;
    if (!parsed || !Array.isArray(parsed.cities)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCities(cache: CitiesCache): void {
  store.set(KEY, JSON.stringify(cache));
}

export function applyCitiesDelta(
  upserts: PersistedCity[],
  tombstoneIds: number[],
  syncedAt: string,
): CitiesCache {
  const existing = readCities() ?? { cities: [], syncedAt: '' };
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
  merged.sort((a, b) => a.name.localeCompare(b.name, 'ro'));

  const next: CitiesCache = { cities: merged, syncedAt };
  writeCities(next);
  return next;
}
