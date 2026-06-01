import { cachedLoad, cachedSave, type CacheRead } from './cacheUtils';

const TTL_MS = 60 * 1000; // 60s — same as the previous in-memory window
const key = (userId: string) => `feed:${userId}`;

export function loadCachedFeed<T>(userId: string): CacheRead<T[]> | null {
  return cachedLoad<T[]>(key(userId), TTL_MS);
}
export function saveCachedFeed<T>(userId: string, data: T[]): void {
  cachedSave(key(userId), data);
}
