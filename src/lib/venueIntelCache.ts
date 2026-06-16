// On-device venue-intelligence cache (F010/F011/F012/F014). Persists the whole
// best-effort intel bundle (busyness, free tables, amenities, regulars) per
// venue so re-opening a venue renders the last-known intel instantly and only
// refetches once the 10-min window lapses — or after a free-tables / regulars
// mutation explicitly invalidates it (invalidateVenueIntelCache). The live
// "now" count is therefore last-known between refreshes, which is acceptable
// for a decorative, non-blocking signal.
import { cachedLoad, cachedSave, cachedInvalidate, type CacheRead } from './cacheUtils';

const TTL_MS = 10 * 60 * 1000;

const key = (venueId: number) => `venue-intel:${venueId}`;

export function loadCachedVenueIntel<T>(venueId: number): CacheRead<T> | null {
  return cachedLoad<T>(key(venueId), TTL_MS);
}

export function saveCachedVenueIntel<T>(venueId: number, data: T): void {
  cachedSave(key(venueId), data);
}

/** Drop the persisted bundle so the next read can't hydrate stale intel
 *  (call alongside the react-query invalidation after a report/regulars change). */
export function invalidateVenueIntelCache(venueId: number): void {
  cachedInvalidate(key(venueId));
}
