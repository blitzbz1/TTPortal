/**
 * Per-domain cache-schema versions. Bump a domain's constant whenever the
 * SHAPE of *that domain's* persisted payload changes — readers treat a
 * version mismatch as a cache miss, which forces a full refetch (delta
 * clients fall back to since=null) instead of hydrating stale-shaped JSON.
 *
 * Each domain owns its OWN version so a bump for one never invalidates the
 * others. A single global constant used to gate all three at once, so any
 * one reshape self-inflicted: a 3.35 MB cities re-parse, an every-scope
 * venue re-pull, AND a full wipe of every offline-KV domain cache. Splitting
 * the constant is the prerequisite that lets later stages reshape cities
 * (Stage 2) or venues (Stage 3) in isolation.
 *
 * - `CITIES_CACHE_SCHEMA_VERSION` → the MMKV `cities-cache-v2` delta envelope.
 * - `VENUES_CACHE_SCHEMA_VERSION` → the MMKV `venues-cache-v2` scope envelopes.
 * - `KV_CACHE_SCHEMA_VERSION`     → the `offline-kv-cache` store (offline-cache
 *   wipes that store, and only that store, on mismatch).
 *
 * Lives in its own module so cacheUtils, offline-cache, and the MMKV delta
 * caches can import without a cycle.
 */
// IMPORTANT: a domain's version must only be bumped once its matching server RPC
// is DEPLOYED to prod — bumping first invalidates the offline caches AND forces a
// re-pull against an RPC that 404s, breaking that domain's load.
// - VENUES = 2: migration 138 (get_venues_map_delta, slim 12-field row) is
//   DEPLOYED (2026-06-28); the bump refreshes old 17-field cached scopes.
// - CITIES = 1: migration 139 (get_cities_catalog_v2) is NOT deployed (and the
//   tiering is measured MOOT, research §8), so the client keeps calling the
//   deployed get_cities_delta and keeps its v:1 caches valid. If 139 ever ships,
//   switch citiesDelta's RPC name and bump CITIES here.
export const CITIES_CACHE_SCHEMA_VERSION = 1;
export const VENUES_CACHE_SCHEMA_VERSION = 2;
export const KV_CACHE_SCHEMA_VERSION = 1;
