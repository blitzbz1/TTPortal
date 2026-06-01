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
