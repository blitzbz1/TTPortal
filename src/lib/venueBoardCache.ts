// F016: persistent cache for a venue's board, so it paints instantly on cold
// open. Mirrors matchesCache / leaderboardCache.
import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const TTL_MS = 5 * 60 * 1000; // 5min

const key = (venueId: number) => `venue-board:${venueId}:list`;

export function loadCachedVenueBoard<T>(venueId: number): CacheRead<T[]> | null {
  return cachedLoad<T[]>(key(venueId), TTL_MS);
}
export function saveCachedVenueBoard<T>(venueId: number, data: T[]): void {
  cachedSave(key(venueId), data);
}
export function invalidateVenueBoardCache(venueId: number): void {
  cachedInvalidate(key(venueId));
}
