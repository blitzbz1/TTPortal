// F042: persistent cache for a venue's recent moments, so the strip paints
// instantly on cold open. Mirrors venueBoardCache / matchesCache.
import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const TTL_MS = 5 * 60 * 1000; // 5min

const key = (venueId: number, userId: string) => `checkin-moments:${venueId}:${userId}:list`;

export function loadCachedCheckinMoments<T>(venueId: number, userId: string): CacheRead<T[]> | null {
  return cachedLoad<T[]>(key(venueId, userId), TTL_MS);
}
export function saveCachedCheckinMoments<T>(venueId: number, userId: string, data: T[]): void {
  cachedSave(key(venueId, userId), data);
}
export function invalidateCheckinMomentsCache(venueId: number, userId: string): void {
  cachedInvalidate(key(venueId, userId));
}
