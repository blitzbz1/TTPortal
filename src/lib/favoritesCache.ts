import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const TTL_MS = 12 * 60 * 60 * 1000; // 12h — invalidated explicitly on add/remove
const key = (userId: string) => `favorites:${userId}`;

export function loadCachedFavorites<T>(userId: string): CacheRead<T[]> | null {
  return cachedLoad<T[]>(key(userId), TTL_MS);
}

export function saveCachedFavorites<T>(userId: string, data: T[]): void {
  cachedSave(key(userId), data);
}

export function invalidateFavoritesCache(userId: string): void {
  cachedInvalidate(key(userId));
}
