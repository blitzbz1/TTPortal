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
// NOTE (2026-06-28): these stay at 1 — DELIBERATELY NOT bumped — until the
// matching server RPCs are actually deployed to PROD. Migrations 138
// (get_venues_map_delta) and 139 (get_cities_catalog_v2) are committed but NOT on
// prod, so the client must keep calling the deployed get_cities_delta /
// get_venues_delta and keep its existing v:1 caches valid (no re-pull). Bumping
// these BEFORE the migrations deploy invalidates the offline caches AND forces a
// re-pull against an RPC that 404s → cities + venues both fail to load.
// WHEN DEPLOYING: deploy the migration to prod, switch the service RPC name
// (src/services/citiesDelta.ts / venuesDelta.ts), THEN bump the matching version
// here so old-shape caches are refreshed. (Stage 2 cities tiering is measured
// MOOT — see research §8 — so 139 may stay undeployed; Stage 3 venue slim is a
// real ~39% win, so 138 is the one worth deploying.)
export const CITIES_CACHE_SCHEMA_VERSION = 1;
export const VENUES_CACHE_SCHEMA_VERSION = 1;
export const KV_CACHE_SCHEMA_VERSION = 1;
