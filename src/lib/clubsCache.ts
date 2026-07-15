// F040: persistent cache for the caller's club list, so the My Clubs screen
// paints instantly on cold open. Mirrors matchesCache.
import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const TTL_MS = 5 * 60 * 1000; // 5min

const key = (userId: string) => `clubs:${userId}:list`;

export function loadCachedClubs<T>(userId: string): CacheRead<T[]> | null {
  return cachedLoad<T[]>(key(userId), TTL_MS);
}
export function saveCachedClubs<T>(userId: string, data: T[]): void {
  cachedSave(key(userId), data);
}
export function invalidateClubsCache(userId: string): void {
  cachedInvalidate(key(userId));
}
