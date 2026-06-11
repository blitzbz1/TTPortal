/**
 * Bump this whenever the SHAPE of any persisted cache payload changes
 * (PersistedVenue/PersistedCity fields, domain-cache bundles, …). Readers
 * treat a version mismatch as a cache miss, which forces a full refetch
 * (delta clients fall back to since=null) instead of hydrating
 * stale-shaped JSON. Used by the SQLite KV store (offline-cache wipes on
 * mismatch) and the MMKV delta caches (per-envelope `v`).
 *
 * Lives in its own module so both cacheUtils and offline-cache can import
 * it without a cycle.
 */
export const CACHE_SCHEMA_VERSION = 1;
