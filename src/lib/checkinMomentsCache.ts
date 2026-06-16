// F042: persistent cache for a venue's recent moments, so the strip paints
// instantly on cold open. Mirrors venueBoardCache / matchesCache.
import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const TTL_MS = 5 * 60 * 1000; // 5min

const key = (venueId: number) => `checkin-moments:${venueId}:list`;

export function loadCachedCheckinMoments<T>(venueId: number): CacheRead<T[]> | null {
  return cachedLoad<T[]>(key(venueId), TTL_MS);
}
export function saveCachedCheckinMoments<T>(venueId: number, data: T[]): void {
  cachedSave(key(venueId), data);
}
export function invalidateCheckinMomentsCache(venueId: number): void {
  cachedInvalidate(key(venueId));
}
