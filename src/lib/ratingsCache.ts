// F030: persistent cache for a player's rating so the chip/sparkline paint
// instantly on cold open. Mirrors matchesCache.
import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';
import { storage } from './mmkv';

const TTL_MS = 5 * 60 * 1000; // 5min

// --- celebration: remember the last rating the user has already seen ---
const BASE_RATING = 1200;
const seenKey = (userId: string) => `rating-seen:${userId}`;

export function getLastSeenRating(userId: string): number | null {
  return storage.getNumber(seenKey(userId)) ?? null;
}
export function setLastSeenRating(userId: string, rating: number): void {
  storage.set(seenKey(userId), rating);
}
/** Celebrate only when the rating has actually climbed since last viewed. */
export function shouldCelebrateRating(current: number | null | undefined, lastSeen: number | null): boolean {
  if (current == null) return false;
  return current > (lastSeen ?? BASE_RATING);
}

const key = (userId: string) => `rating:${userId}`;

export function loadCachedRating<T>(userId: string): CacheRead<T> | null {
  return cachedLoad<T>(key(userId), TTL_MS);
}
export function saveCachedRating<T>(userId: string, data: T): void {
  cachedSave(key(userId), data);
}
export function invalidateRatingCache(userId: string): void {
  cachedInvalidate(key(userId));
}
