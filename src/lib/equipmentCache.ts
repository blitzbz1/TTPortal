import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const TTL_MS = 24 * 60 * 60 * 1000; // 24h — invalidated on save
const historyKey = (userId: string, limit: number) => `equipment:${userId}:history:${limit}`;

export function loadCachedEquipmentHistory<T>(userId: string, limit: number): CacheRead<T[]> | null {
  return cachedLoad<T[]>(historyKey(userId, limit), TTL_MS);
}
export function saveCachedEquipmentHistory<T>(userId: string, limit: number, data: T[]): void {
  cachedSave(historyKey(userId, limit), data);
}
export function invalidateEquipmentCache(userId: string): void {
  // We may have multiple limit-keys; remove via prefix would be nicer, but the
  // common case is the same single limit being reused — keep it simple.
  for (const limit of [4, 10, 20]) cachedInvalidate(historyKey(userId, limit));
}
