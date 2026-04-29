// Caches the windowed play-history bundle (history + allCheckins +
// eventHours/eventVenues) keyed by (userId, sinceIso). Past entries are
// effectively immutable, so re-rendering them from cache is correct;
// invalidate when a checkin/checkout/logEventHours mutation lands.

import { cachedLoad, cachedSave, cachedInvalidate, removeCacheItemsByPrefix, type CacheRead } from './cacheUtils';

const TTL_MS = 6 * 60 * 60 * 1000;
const key = (userId: string, sinceIso: string | null) =>
  `playHistory:${userId}:${sinceIso ?? 'all'}`;

export type PlayHistoryBundle = {
  history: any[];
  allCheckins: any[];
  eventHours: any[];
  eventVenues: any[];
};

export function loadCachedPlayHistory(userId: string, sinceIso: string | null): CacheRead<PlayHistoryBundle> | null {
  return cachedLoad<PlayHistoryBundle>(key(userId, sinceIso), TTL_MS);
}
export function saveCachedPlayHistory(userId: string, sinceIso: string | null, bundle: PlayHistoryBundle): void {
  cachedSave(key(userId, sinceIso), bundle);
}
export function invalidatePlayHistoryCache(userId: string): void {
  cachedInvalidate(key(userId, null));
  // Other windows (per period+calMonthOffset) live under the same prefix.
  // Drop them all on mutation — the bundles are cheap to refetch.
  removeCacheItemsByPrefix(`playHistory:${userId}:`);
}
