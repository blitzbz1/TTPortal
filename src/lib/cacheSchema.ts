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
// Stage 2: bumped to 2 for the tiered catalog row (get_cities_catalog_v2) — the
// row now carries a server-built `search_key`, and the cached set shrinks from
// the full ~10,330-row catalog to the venue-bearing/eager tier. Old v:1 envelopes
// (full catalog, no search_key) are treated as a miss → one since=null re-pull of
// the CITIES store only (venues/KV untouched — the Stage-0 footgun, DO-NOT #1).
export const CITIES_CACHE_SCHEMA_VERSION = 2;
// Stage 3: bumped to 2 for the slim 12-field venue row (get_venues_map_delta) —
// old 17-field cached scopes are treated as a miss and re-pulled from since=null.
export const VENUES_CACHE_SCHEMA_VERSION = 2;
export const KV_CACHE_SCHEMA_VERSION = 1;
