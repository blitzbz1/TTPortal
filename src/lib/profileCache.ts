import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const PROFILE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const STATS_TTL_MS = 30 * 60 * 1000; // 30min

const profileKey = (userId: string) => `profile:${userId}:meta`;
const statsKey = (userId: string) => `profile:${userId}:stats`;

export function loadCachedProfile<T>(userId: string): CacheRead<T> | null {
  return cachedLoad<T>(profileKey(userId), PROFILE_TTL_MS);
}
export function saveCachedProfile<T>(userId: string, data: T): void {
  cachedSave(profileKey(userId), data);
}
export function invalidateProfileCache(userId: string): void {
  cachedInvalidate(profileKey(userId));
}

export function loadCachedProfileStats<T>(userId: string): CacheRead<T> | null {
  return cachedLoad<T>(statsKey(userId), STATS_TTL_MS);
}
export function saveCachedProfileStats<T>(userId: string, data: T): void {
  cachedSave(statsKey(userId), data);
}
export function invalidateProfileStatsCache(userId: string): void {
  cachedInvalidate(statsKey(userId));
}
