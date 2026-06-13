// F002: persistent cache for a player's confirmed match history, so the
// Matches row paints instantly on cold open. Mirrors leaderboardCache.
import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const TTL_MS = 5 * 60 * 1000; // 5min

const key = (userId: string) => `matches:${userId}:list`;

export function loadCachedMatches<T>(userId: string): CacheRead<T[]> | null {
  return cachedLoad<T[]>(key(userId), TTL_MS);
}
export function saveCachedMatches<T>(userId: string, data: T[]): void {
  cachedSave(key(userId), data);
}
export function invalidateMatchesCache(userId: string): void {
  cachedInvalidate(key(userId));
}
