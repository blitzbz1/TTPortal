// Thin freshness-aware helper on top of the SQLite-backed offline cache.
// Domain caches (events, favorites, friends, ...) build on this rather than
// reimplementing the load + age-check + save dance.

import {
  getCacheItem,
  setCacheItem,
  getCacheAge,
  removeCacheItem,
  removeCacheItemsByPrefix as _removeCacheItemsByPrefix,
} from './offline-cache';

export { CACHE_SCHEMA_VERSION } from './cacheSchema';

export const removeCacheItemsByPrefix = _removeCacheItemsByPrefix;

export type CacheRead<T> = { data: T; fresh: boolean };

export function cachedLoad<T>(key: string, ttlMs: number): CacheRead<T> | null {
  const data = getCacheItem<T>(key);
  if (data == null) return null;
  const age = getCacheAge(key);
  return { data, fresh: age != null && age < ttlMs };
}

export function cachedSave<T>(key: string, data: T): void {
  setCacheItem(key, data);
}

export function cachedInvalidate(key: string): void {
  removeCacheItem(key);
}

/**
 * Maps a `loadCached*` read into a react-query `initialDataUpdatedAt`: fresh
 * disk data counts as just-fetched (no network refetch within staleTime),
 * while stale disk data still hydrates instantly but is treated as ancient so
 * the query refetches in the background. Pair with `initialData` sourced from
 * the same read for the stale-while-revalidate pattern (see useEventsQuery).
 */
export function cachedUpdatedAt(cached: { fresh: boolean } | null | undefined): number | undefined {
  if (!cached) return undefined;
  return cached.fresh ? Date.now() - 1000 : 0;
}

/**
 * Invalidates BOTH caching systems for a domain in one call (T050): the
 * react-query key and the persistent domain cache. The two systems used to
 * be invalidated independently from different layers (query keys in hooks,
 * SQLite keys in services) and drifted. Use from mutation `onSettled`.
 */
export function invalidateDomain(
  queryClient: { invalidateQueries: (filter: { queryKey: readonly unknown[]; exact?: boolean }) => unknown },
  queryKey: readonly unknown[],
  domainCacheKey?: string,
): void {
  queryClient.invalidateQueries({ queryKey, exact: false });
  if (domainCacheKey) removeCacheItem(domainCacheKey);
}
