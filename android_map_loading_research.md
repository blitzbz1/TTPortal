# Android Map / Venue-List Load-Cost Research — Final Synthesis

_Date: 2026-06-27 · Project: TTPortal_

**Goal:** drastically cut the map/venue-list load cost on the device (Android / Galaxy A51
especially) — main-thread JS CPU (`JSON.parse` + clean + sort), peak heap, GC, cold-start
wall-clock — **without** crippling Supabase Postgres/PostgREST.

**Constraint:** migrations 000–099 are FROZEN; new schema ships as 138+. Stay inside the
existing `{upserts, tombstone_ids, synced_at}` delta envelope + MMKV caches + MapLibre
clusterer.

**Method:** 6 candidate solution families, each independently proposed, then adversarially
verified across 3 lenses (mobile-perf / server-cost / stack-feasibility), scored by a
3-judge panel, synthesized, and stress-tested by a completeness critic (29 agents total).

---

## 1. TL;DR — the clear winner

**Ship the `catalog` family (a tiered, venue-bearing eager cities set + on-demand long-tail
search) as the structural core** — but gate it behind a one-hour measurement and pair it with
an off-critical-path **deferral** of the catalog parse. Everything else is either a
complement (`mapPayload`, `bootstrap`), a deferred server-scale layer (`edgeCache`), or a
trap to avoid (`transport` full-columnar, `storage`-as-cities-fix).

The recommended program, in order:

| Stage | What | Effort | Migration / files |
|---|---|---|---|
| **0** | Split the global `CACHE_SCHEMA_VERSION` per-domain | S | `cacheSchema.ts`, both persistent caches, `offline-cache.ts` (no migration) |
| **1** | Collapse the redundant 3× cities parse/clean/sort | S | `useCitiesQuery.ts`, `citiesPersistentCache.ts` (no migration) |
| **1.5** | **Defer the catalog off the synchronous mount path** (boot hydrates 1 row, not 10k) | S/M | `LocationProvider.tsx`, `useCitiesQuery.ts` (no migration) |
| **2** | **Catalog tiering + `search_cities`** ← the winner | L | `138_cities_tiered_catalog.sql` + LocationProvider/cityCatalog/selectors |
| **3** | Slim the venue map delta (simple field-drop) | M | `139_venues_map_delta.sql` + venuesPersistentCache/MapViewScreen |
| 4 (opt) | Map-bootstrap: fold static + persist live overlays | L | `140_map_bootstrap.sql` + mapBootstrap service/hook |
| 5 (deferred) | Edge/CDN artifacts for the static base layers | L | `141_catalog_artifacts.sql` + `build-catalog` edge fn |

> **Measure before Stage 2.** The entire ~7× / ~88–94% headline rests on the tier being
> ~1,500 rows. Given the broad staged OSM import history, `venue_count > 0` may already
> cover several thousand cities. Run the count query in §8 first; if the tier is large,
> **Stage 1.5 deferral becomes primary** and tiering becomes a secondary refinement.

---

## 2. Verified baseline (what actually happens today, with file refs)

**Cities catalog — the #1 cost.** `LocationProvider` is mounted **once** at app root
(`src/app/_layout.tsx`), so the cities catalog hydrates on each cold start. On that path
`useCitiesQuery` (`src/hooks/queries/useCitiesQuery.ts`) parses the 3.35 MB / ~10,330-row
blob **three times** for a near-empty warm delta:

- `initialData` → `readCities()` (parse #1) → `cleanCityCatalog` (10k× `cityKey` NFD+regex + `compareRo` sort)
- `queryFn` → `readCities()` (parse #2) → `applyCitiesDelta(...)` → internal `readCities()` (parse #3) + merge + `compareRo` sort + `writeCities` (3.35 MB `JSON.stringify`) → `cleanCityCatalog` again

`LocationProvider.activeCities` then runs a full 10k `toLocationCity` map + `.filter` +
`mergeExpansionCityWave` (Map dedup + collator sort, `src/lib/locationHelpers.ts`) on every
`cityRows` change. `activeCities` is consumed **whole** by `getCountriesFromCities`, the
`citiesForSelectedCountry` filter, and `selectedCity = activeCities.find(id)` — so the win
must come from the **row count**, not lazy field materialization.

**Cache-version blast radius.** `CACHE_SCHEMA_VERSION` is a single global constant
(`src/lib/cacheSchema.ts`) consumed by `offline-cache.ts` (which does `store.clearAll()` on
mismatch, wiping ~18 domain caches) **plus** both MMKV catalog caches. Any naive bump
self-inflicts the 3.35 MB cities re-parse + every-venue-scope re-pull + a full domain-cache
wipe — the exact cost this effort targets.

**Venues — the map IS the list.** `MapViewScreen` feeds the GPU cluster pins **and** the
bottom-sheet list/search from the same `useVenuesQuery` array. Confirmed field reads:
`v.address` (search), `v.city` (badge + search), `v.tables_count`, `v.type`, `v.verified`,
`v.free_access`, `v.condition`, plus name/lat/lng. `PersistedVenue` has 17 fields; only
`city_id`, `created_at`, `updated_at`, `approved` are verified-dead (`city` is replaceable by
`selectedCity.name`). **`address` is used and not derivable — it stays.**

**`zoom` / `admin_area` are load-bearing.** `getMapRegionForCity(selectedCity)` uses
`city.zoom` for the initial region and `animateToRegion`; `AddVenueScreen` uses
`selectedCity.admin_area` as the venue `state` field. Keep them in the eager payload; only
`country_name` is safely derivable from `country_code`.

**RPC shapes (mig 063).** `get_cities_delta`: **no `ORDER BY`**, 14 cols,
`jsonb_agg(to_jsonb(rec))` — so any per-column columnar build has no deterministic tie order
(a corruption hazard since OSM imports share `updated_at`). `get_venues_delta`:
`ORDER BY (v->>'updated_at') DESC`, 17 cols.

**7-way map fan-out.** `useVenuesQuery` + `useFriendPresenceQuery` (sequential
getFriendIds→reads) + `useLiveVenueCountsQuery` + `useOpenPlayCountsQuery` +
`useCityVenueAmenitiesQuery` + `useCoachingVenueIdsQuery(selectedCityName)` (**TEXT-keyed**)
+ `useUnvisitedVenuesQuery(user, selectedCityName)` (**TEXT-keyed**). No combined bootstrap;
overlays 2–7 are react-query in-memory only (no MMKV persistence).

**Transport reality.** `src/lib/supabase.ts` uses default fetch; OkHttp (Android) and
NSURLSession (iOS) auto-negotiate gzip and inflate transparently. The 3.35 MB / 453 KB are
**decompressed** sizes; the wire is already ~0.4–0.6 MB / ~65–90 KB. **`JSON.parse` runs on
the decompressed string regardless — the wire is not the bottleneck, parse is.**

---

## 3. Why `catalog` wins, against each alternative

The brief's primary axis is **on-device CPU/memory on the load path**; server is a
constraint. The dominant load-path cost is the cities catalog (§2). Only `catalog` attacks it
at the root.

- **vs `storage` (expo-sqlite):** Same cities cost from the persistence angle and a genuine
  off-heap-memory win, **but redundant with the winner** — needs the *same* `activeCities`
  refactor, does **not** remove the first-install / `since=null` 3.35 MB parse (supabase-js
  parses the RPC body before the client sees it), does **not** scale to 100k (still ships all
  rows on cold sync), reverses the documented T047 MMKV decision, re-adds a web fork. *Pick
  catalog; do not ship both.*
- **vs `edgeCache` (CDN artifacts):** The server-safety star — collapses per-user cold
  `jsonb_agg` to once-per-build — but its **client** CPU win is ~half catalog's and largely a
  subset, it carries the highest ops surface, the cold-boot MMKV re-parse remains, and the
  **monolithic cities artifact re-hashes on any venue approval** (mig 070 bumps
  `cities.updated_at`), regressing vs the granular delta during OSM import waves. Optimizes
  the *constraint*, not the *goal*. *Defer; compose UNDER catalog (serve the tier artifact).*
- **vs `transport` (columnar over the full 10k):** On JIT-less Hermes the mandatory userland
  reassembly loop (~10,330 × ~14 property writes) re-adds the object construction native
  `JSON.parse` does in C++ for free; net ~0–30 ms (a wash, possibly negative). Two of three
  lenses rated it weak. *Subsumed — columnar only on the small tier, if at all.*
- **vs `mapPayload`:** Not a competitor — the orthogonal **venues-path** complement. Runner-up
  co-ship, not an alternative.
- **vs `bootstrap`:** A latency/round-trip proposal; cold parse is unchanged-to-worse
  (folding amenities/has_coach grows the heavy venue parse). Value is warm-revisit latency.
  *Optional phase-4.*

Two of three judges ranked `catalog` #1 (impact-first, pragmatic-roi); the server-safety
judge ranked `edgeCache` #1 but conceded the cities CDN artifact should *be* catalog's tier —
catalog defines the **what**, edgeCache is a later **how/where**.

---

## 4. Full ranking (standalone leverage on the stated goal)

> Ordinal = leverage on the CPU/memory axis. **Ship-disposition differs** when families are
> redundant vs complementary — see the roadmap.

1. **catalog — WINNER (viable, all 3 lenses).** ~7× row cut kills the #1 cold-mount rock at
   the root (~88–94% / ~430–830 ms A51; 3.35 MB → ~105–210 KB); only cities fix bounded at
   100k. *Ship as core.*
2. **mapPayload (viable, all 3 lenses).** Simple field-drop (keep address/city/tables_count)
   → ~25–45% less venue parse/MMKV/GC per city-switch, low risk. *Co-ship; skip int/bit
   packing + viewport.*
3. **storage (viable but redundant).** Real off-heap memory + warm-launch CPU win, but
   redundant with the winner, no first-install/100k fix, reverses T047. *Do not ship
   alongside catalog.*
4. **edgeCache (viable but defer).** Server-scale star; client CPU ~half catalog's and a
   subset; highest ops surface; artifact re-hashes on any venue approval. *Defer; compose
   under catalog.*
5. **bootstrap (weak on CPU / viable on latency).** 9→2 round-trips + instant warm dots, but
   ~0 CPU/memory. *Optional phase-4.*
6. **transport (weak, 2 of 3 lenses).** Full-catalog columnar self-cancels on Hermes; folded
   into the winner's tier. *Subsumed.*

---

## 5. Staged roadmap (quick wins → structural → optional → deferred)

### Stage 0 — Split the global cache-schema version _(S, no migration)_
Replace `CACHE_SCHEMA_VERSION` with `CITIES_CACHE_SCHEMA_VERSION` /
`VENUES_CACHE_SCHEMA_VERSION` / `KV_CACHE_SCHEMA_VERSION`; each reader checks only its own.
**Why:** the verified 3-store footgun (§2). Without this, every later stage self-inflicts the
3.35 MB cities re-parse + a full domain-cache wipe.
_Touches:_ `src/lib/cacheSchema.ts`, `src/lib/citiesPersistentCache.ts`,
`src/lib/venuesPersistentCache.ts`, `src/lib/offline-cache.ts`.

### Stage 1 — Collapse the redundant cities hydrate _(S, no migration)_
Pass the already-read cache into `applyCitiesDelta` (kill its internal 3rd `readCities`);
short-circuit merge+stringify+sort+clean on an empty delta (the common warm case); dedupe
`cleanCityCatalog` between `initialData` and `queryFn` (persist or memoize the cleaned/sorted
form).
**Why:** removes 2 of 3 full parses + the 3.35 MB stringify + a redundant sort/clean for a
~85 B warm delta; SQLite-free, helps first-install, compounds with tiering.
_Touches:_ `src/hooks/queries/useCitiesQuery.ts`, `src/lib/citiesPersistentCache.ts`.

### Stage 1.5 — Defer the catalog off the synchronous mount path _(S/M, no migration)_ ← critic addition
Persist the resolved `selectedCity` object so boot needs **zero** catalog parse; hydrate only
that 1 row synchronously at mount, and build `activeCities` lazily on switcher-open via
`InteractionManager.runAfterInteractions` (or post-first-paint). Decouple `locationReady` from
`cityRowsCount` (today `locationReady = !isLoading || cityRowsCount > 0` gates the **whole app
tree** on the catalog parse).
**Why:** this is the highest-certainty, lowest-risk, migration-free cold-start **wall-clock**
lever — and it **de-risks the whole bet**: even if the Stage-2 tier turns out large, boot
parses ~1 row instead of ~1,500. Verified absent today (no `InteractionManager` /
`runAfterInteractions` / `lazy(` / `Suspense` in `src/`; `initialData` runs synchronously
inside the root-level `LocationProvider`). Best sequenced with — or folded into — the Stage-2
`LocationProvider` refactor.
_Touches:_ `src/contexts/LocationProvider.tsx`, `src/hooks/queries/useCitiesQuery.ts`.

### Stage 2 — Catalog tiering + long-tail search _(L, migration 138)_ ← THE WINNER
- `get_cities_catalog_v2(p_since)` returns ONLY the tier:
  `venue_count > 0 OR expansion_status IN ('launch_ready','community_review','coming_soon')`
  (~1,500 rows — **measure first, §8**), with the **full switcher projection KEPT** (id, name,
  lat, lng, **zoom**, venue_count, country_code, **admin_area**, + a server-built ascii search
  key). `country_name` is derived client-side from `country_code`.
- `search_cities(p_query, p_limit)` over a generated `name_norm` **prefix btree** (works at
  ≥2 chars; matches the switcher's startsWith ranking), debounced ~250 ms, fired only when
  in-tier matches are insufficient. **Concatenate admin_area/local_area/county/country into
  `name_norm`** to preserve the switcher's current multi-field recall (§8.4).
- Build all output in ONE aggregate pass over a single `row_number() OVER (ORDER BY …, id)`
  CTE (no per-column `ORDER BY` — avoids the alignment-corruption + redundant-sort traps).
- Emit a **fell-out-of-tier** tombstone branch; add a **single-row fallback** in
  LocationProvider for a saved `selectedCity` not in the tier; preserve the 9 hardcoded
  `EXPANSION_CITY_WAVE` negative-id client cities and the Piatra-Neamț merge.

**Why:** ~7× fewer rows feed every 10k pass (`toLocationCity`, `mergeExpansionCityWave`,
`cleanCityCatalog`, both sorts), reclaiming ~430–830 ms A51 JS (~88–94%) and cutting cold
cities 3.35 MB → ~105–210 KB raw; the only cities fix bounded at 100k; also drops the heaviest
server query ~10–14×.
_Touches:_ `138_cities_tiered_catalog.sql` (RPCs + `name_norm` index + grants + pgTAP),
`src/lib/citiesPersistentCache.ts`, `src/lib/cityCatalog.ts`,
`src/contexts/LocationProvider.tsx`, `src/components/LocationSelector.tsx`,
`src/components/LocationWelcome.tsx`, `src/hooks/queries/useCitiesQuery.ts`
(+ `useCitySearchQuery`), `src/services/citiesDelta.ts`, `src/types/supabase.ts`.

### Stage 3 — Slim venue map delta (simple variant) _(M, migration 139)_
`get_venues_map_delta` (or a v2 RPC) drops the verified-dead `city_id`, `created_at`,
`updated_at`, `approved` + the duplicated `city` (read `selectedCity.name` for badge/search).
**KEEP** name, address, lat, lng, tables_count, condition, type, verified, free_access. Add
`ORDER BY id` for a stable default list order; keep enum strings + bool flags (no int/bit
packing). Rides the venues-only cache version from Stage 0.
**Why:** ~25–30% smaller venue payload, ~35–45% less parse/MMKV-stringify/GC per cold
city-switch.
_Touches:_ `139_venues_map_delta.sql`, `src/lib/venuesPersistentCache.ts`,
`src/services/venuesDelta.ts`, `src/hooks/queries/useVenuesQuery.ts`,
`src/screens/MapViewScreen.tsx`, `src/types/supabase.ts`.

### Stage 4 — (Optional) Hybrid map-bootstrap _(L, migration 140)_
Keep the venue delta as its own persisted call; add
`get_city_live_overlays(p_city_id, p_since)` returning live_counts + open_play + unvisited
(user-scoped) + friends in one round-trip; fold amenities (already a venues column) into the
venue rows; re-key coaching/unvisited from city NAME(TEXT) → `city_id` (099-style TEXT compat
shim); persist the live-overlay envelope per `city_id` with a `writtenAt` staleness stamp;
add a coach→`venues.updated_at` trigger if `has_coach` is folded.
**Why:** cold map-open 9 → 2 round-trips (~0.3–0.8 s LTE, ~1–2.5 s 3G) and warm revisits
paint last-known dots instantly. Latency/warm win, not CPU — ship after the rocks.
_Touches:_ `140_map_bootstrap.sql`, `src/services/mapBootstrap.ts`,
`src/hooks/queries/useMapBootstrapQuery.ts`, `src/lib/mapOverlayCache.ts`,
`src/screens/MapViewScreen.tsx`.

### Stage 5 — (Deferred) Edge/CDN artifacts _(L, migration 141 + edge fn)_
A service-role `build-catalog` edge function + pg_cron safety-net + a **debounced per-city
dirty-flag** pg_net trigger materialize the Stage-2 tier and Stage-3 slim venue sets as
content-hashed immutable Storage objects behind a manifest; clients hash-skip to 0 DB work.
RPCs remain as the offline/error fallback behind a flag.
**Why:** the server-scale lever — defer until cold-aggregation CPU/egress binds; composes
under catalog.
_Touches:_ `141_catalog_artifacts.sql`, `supabase/functions/build-catalog/index.ts`,
`src/services/catalogArtifact.ts`, `src/services/venueArtifact.ts`, `useCitiesQuery.ts`,
`useVenuesQuery.ts`.

---

## 6. DO NOT DO (traps verified against the dossier + repo)

1. **Do NOT bump the global `CACHE_SCHEMA_VERSION`** — `offline-cache.ts` `store.clearAll()`
   + cities + every venue scope re-pull. Split per-domain first.
2. **Do NOT ship full-catalog columnar JSON** (transport) — the Hermes reassembly loop nets
   ~0–30 ms, possibly negative. Columnar only on the small tier.
3. **Do NOT use MessagePack/CBOR/CSV/NDJSON** — JIT-less Hermes makes userland decoders lose
   to native `JSON.parse`; gzip already removes wire redundancy.
4. **Do NOT chase gzip/brotli** — already negotiated transparently; parse runs on the
   decompressed string; brotli on RN forces a JS decoder. Wire is not the bottleneck.
5. **Do NOT drop `zoom`/`admin_area` from the cities tier** — zoom drives
   `getMapRegionForCity`; admin_area is the AddVenueScreen `state` field. Only `country_name`
   is derivable.
6. **Do NOT slim venues to "map columns only"** — the map IS the list (address, city,
   tables_count are read by the sheet/search). Drop only
   `city_id`/`created_at`/`updated_at`/`approved` (city → `selectedCity.name`); address stays.
7. **Do NOT int/bit-pack venue enums/flags** — ~0 gzip-wire gain, adds a CASE↔lookup drift
   surface + a per-row decode that re-blocks the JS thread + pollutes `venueLabels.ts`. Keep
   strings + bools.
8. **Do NOT build any columnar/tier RPC with per-column `ORDER BY`** — non-deterministic tie
   order (OSM imports share `updated_at`) silently misaligns arrays; build all columns in ONE
   aggregate over a single `row_number()`-ordered CTE.
9. **Do NOT adopt expo-sqlite as the cities fix** — doesn't remove the first-install parse,
   doesn't scale to 100k, needs the same refactor, reverses T047, re-adds a web fork.
10. **Do NOT build the CDN pipeline yet** — the monolithic cities artifact re-hashes on any
    venue approval (mig 070); defer and compose under catalog.
11. **Do NOT implement viewport/bbox as a replacement for the city venue delta** — saves
    ~nothing at city-default zoom and breaks the whole-scope invariant the GPU clusterer
    relies on. Additive zoomed-in path only.
12. **Do NOT fold `has_coach` without a coach→`venues.updated_at` trigger**, and **do NOT
    fold per-user `unvisited` into shared rows / a city_id-only cache** (cross-user leakage on
    a shared device).
13. **Do NOT gate `search_cities` at <3 chars on a pg_trgm GIN index** — trigrams need ≥3
    chars; use a `name_norm` prefix btree, and always debounce + min-length.

---

## 7. Combined expected impact (core program = Stages 0–3, incl. 1.5)

| Metric (Galaxy A51, cold, authenticated, map landing) | Today | After Stages 0–3 | + Stage 4 |
|---|---|---|---|
| Cities cold-mount JS (parse + clean + sort + materialize) | ~500–900 ms | **~30–70 ms (~88–94% cut, ~430–830 ms reclaimed)** | — |
| Cities cold payload (raw / gzip wire) | 3.35 MB / ~0.5 MB | **~105–210 KB / ~20–35 KB** | — |
| Cities cold server `jsonb_agg` | ~1.0–1.9 s | **~0.1–0.2 s (~10–14×)** | — |
| Venue cold (Berlin) raw / parse | 453 KB / ~8–15 ms | **~330–360 KB / ~5–10 ms (~25–45%)** | — |
| Peak cities transient/resident heap | ~10–15 MB | **~1–2 MB** | — |
| Map-open round-trips | 9 (2 waves) | 9 (unchanged) | **2 (~0.3–0.8 s LTE / ~1–2.5 s 3G)** |
| Warm city-revisit overlays | ~0.85–1.5 s, refetch | same | **instant last-known dots, 0 network** |
| Upgrade re-pull | 3.35 MB + every scope + 18 caches wiped | **~105 KB tier only; venues/domain caches untouched** | same |

> **Stage 3 — measured (2026-06-27, prod-parity container, 120 synthetic venues):** the
> "Venue cold raw" row above is now measured, not estimated. `get_venues_delta` (17-col) =
> **49,081 B** vs `get_venues_map_delta` (12-col) = **30,001 B** → a **~38.9%** raw-payload cut
> — above the ~25–30% estimate, because the dropped pair of ISO `created_at`/`updated_at`
> timestamps + the duplicated `city` weigh more per row than estimated. Parse / MMKV-stringify
> / GC scale with payload size, so the per-city-switch CPU win tracks the same band.

**Cold-start framing:** this removes the #1 of the three named cold rocks (the cities
parse/clean/sort). It does NOT touch the auth `getSession` gate or the 26-screen barrel eval,
so 10–15 s → ~10–14 s from this alone, compounding when those two are addressed separately.

**City-switch:** venue-bearing cities still hydrate instantly offline from MMKV; the only new
cost is a debounced ~200–400 ms indexed search round-trip when a user types a zero-venue
long-tail city (which renders an empty map today anyway).

**Server:** the heaviest query gets ~10–14× cheaper on the (rare) cold path; the upgrade herd
is net-lighter; a bounded/indexed/debounced `search_cities` QPS is **added** on the long-tail
path (free today, fully client-side); slim venues is neutral-to-slightly-lower per pull. Net
steady-state server cost is roughly flat — **no DB-crippling cost**. (The 10–14× win is the
cold/cache-miss path, not the aggregate steady state.)

> All ms/byte figures are **adversarially-corrected estimates**, gated on the unverified
> ~1,500 tier size and unmeasured A51 Hermes throughput. Treat §8 as a hard prerequisite.

---

## 8. Open questions / measurement plan (do these BEFORE committing Stage 2's L effort)

> **§8 DECISION — MEASURED 2026-06-27 (prod, anon PostgREST counts). GATE RESOLVED:
> Stage 1.5 deferral is the PRIMARY lever; Stage 2 tiering is NOT a row-cut win on
> current data — it is forward-looking infrastructure only.**
> The headline ~7× / ~88–94% row cut **does not materialize**. Measured prod:
> total cities **10,334**, `venue_count > 0` **10,319**, `active & not hidden` **10,330**,
> **eager TIER = 10,318**. The tier is **99.85% of the catalog** — the predicate removes only
> ~16 rows, a **~1.0016× cut, not ~7×**. Boot still parses ~10,318 rows, so the cities
> cold-mount JS/heap/`jsonb_agg` wins attributed to tiering in §1/§5/§7 are **≈0** today.
> Switching the eager RPC `get_cities_delta`(10,330) → `get_cities_catalog_v2`(10,318) +
> the `v1→v2` cache bump even costs every user a one-time ~3.34 MB `since=null` re-pull on
> upgrade for a 12-row reduction. **The real, already-shipped cold-start win is Stage 1.5**
> (boot resolves 1 persisted row instead of parsing the catalog synchronously). Stage 2's
> `name_norm` index + `search_cities` + out-of-tier fallback are correct, tested, and harmless,
> and earn their keep only **if/when** the catalog grows a large zero-venue long tail (the
> "bounded at 100k" case) — on today's data they are near-dormant (almost nothing is outside
> the tier to search or fall back to). Re-scope: treat Stage 2 as future-proofing, not a
> measured cold-start lever; the cold-start program rides Stage 1.5 + the auth/barrel work.
>
> **T005 SYNTHESIS (T001 tier + T004 emulator segments).** The measured cities cold-mount is
> dominated NOT by the parse (~14–34 ms) or the clean-sort (~94 ms) but by the **activeCities
> materialize ~1,926 ms** (`toLocationCity` ×10,330 + `mergeExpansionCityWave`'s per-row
> `toLocaleLowerCase('ro')` + `Intl.Collator` sort; see §8.2). Since the tier ≈ the whole
> catalog (§8.1), **tiering reclaims ≈0 ms of that materialize** (`measured × (1 − 10318/10334)`
> ≈ negligible). Stage 1.5 already moves the materialize off the `appReady` gate (it runs at
> +2191 ms, after appReady at +265 ms) — that is the realized cold-start win. **GATE LIFTED,
> re-pointed:** Stage 2 ships as harmless future-proofing infra (NOT a measured win); the next
> real lever is **making the materialize cheaper** (memoize `toLocationCity` / the wave merge,
> drop the per-row locale-lowercase, lazy per-country build) — a new workstream independent of
> tiering. The §7 table's tiering ms/byte wins are **retracted for current data.**

1. **Pin the tier size (load-bearing).** On prod:
   `SELECT count(*) FROM cities WHERE active AND expansion_status <> 'hidden' AND (venue_count > 0 OR expansion_status IN ('launch_ready','community_review','coming_soon'));`
   The whole ~7× headline assumes ~1,500. Given the broad staged OSM import history, this may
   already be several thousand — if so, **Stage 1.5 deferral becomes the primary lever** and
   tiering a secondary refinement.
   > **MEASURED (2026-06-27, prod anon PostgREST):** TIER = **10,318** of **10,334** total
   > (`venue_count > 0` alone = 10,319). Row-cut ratio **~1.0016×**, not ~7×. **Tier ≫ 1,500 →
   > the §8.1 gate flips: Stage 1.5 deferral = PRIMARY, Stage 2 tiering = secondary/dormant
   > infrastructure.** Reclaimable-ms from tiering ≈ `measured_segment_ms × (1 − 10318/10334)`
   > ≈ **negligible**. The OSM import (project_osm_venue_import) populated `venue_count > 0` for
   > essentially the whole catalog, invalidating the "most cities are zero-venue / ship lazily"
   > premise the tiering win rested on.
2. **Measure the real A51 baseline.** `src/lib/launchTrace.ts` exists (self-described as
   temporary iOS-sim instrumentation) — capture cities `JSON.parse` vs `cleanCityCatalog`
   sort vs `toLocationCity`/`mergeExpansionCityWave` **on a real Galaxy A51 release build**
   (not the emulator) to replace estimates with measured figures, and to settle whether parse
   or the ~133k-comparison collator sort dominates.
   > **MEASURED (2026-06-27, Android EMULATOR `ttportal_a16` arm64, RELEASE APK, prod data
   > ~10,330 cities, warm MMKV cache, `adb logcat`).** ⚠️ Emulator (Apple-silicon host), NOT an
   > A51 — absolute ms are optimistic vs the A51; the **relative dominance** is representative.
   > First a tooling fix was required: `launchTrace.emit` used `console.log`, which
   > `babel-preset-expo` **strips in release**, so a release cold start emitted nothing to
   > logcat — switched to `console.info` (survives the strip; the app's own `logger.ts` uses
   > info/warn/error for this reason). Warm cold-start timeline:
   >
   > | segment | Δ (emulator) |
   > |---|---|
   > | `cities: JSON.parse` (3.35 MB) | **~14–34 ms** |
   > | `cities: cleanCityCatalog sort` (NFD `cityKey` + `compareRo` over ~10,330) | **~94 ms** |
   > | `cities: toLocationCity + mergeExpansionCityWave` (materialize) | **~1,926 ms** |
   >
   > **§8.2 ANSWERED — and it's a surprise:** neither `JSON.parse` nor the clean-sort dominates;
   > the **activeCities materialize dominates by ~20×**. The cost is the 10,330× `toLocationCity`
   > map + `mergeExpansionCityWave`'s per-row `name.toLocaleLowerCase('ro')` (locale-aware, slow on
   > Hermes/no-JIT) + its `Intl.Collator` sort over ~10,339 elements (~133k ICU comparisons). The
   > research debated "parse vs collator-sort"; the real rock is the **materialize's** locale-lower
   > + collator sort, not the parse and not the `cleanCityCatalog` sort. Boot phases: `00 js-eval`
   > 0ms → `30 first commit` 62ms → `40 session resolved` 264ms → **`60 appReady` 265ms** →
   > materialize 2191ms → `70 splash visible` 2639ms. **Stage 1.5 deferral is visible and working:**
   > the 1.9 s materialize runs AFTER `appReady` (it no longer gates the splash-hide), but it still
   > occupies the JS thread and pushes "app visible" to ~2.6 s — so the materialize cost is the next
   > real lever, and **tiering can't touch it (tier = the whole catalog, §8.1).** The actionable win
   > is to make the materialize cheaper (memoize `toLocationCity`/the wave merge, drop the per-row
   > locale-lowercase, lazy-build per selected country) — a NEW workstream, separate from tiering.
   >
   > **OPTIMIZED + RE-MEASURED (2026-06-28, same emulator/protocol).** Two ICU eliminations in
   > `mergeExpansionCityWave`/`compareCityByCountryThenName` (`src/lib/locationHelpers.ts`): (1)
   > `getCityKey` `name.toLocaleLowerCase('ro')` → `toLowerCase()` (identical output for Latin +
   > Romanian text — no special lowercasing rules — but skips the per-call ICU locale path, ×10,339);
   > (2) the sort's per-comparison `compareDefault(country_code)` (Intl.Collator) → a plain ASCII
   > compare on the 2-letter uppercase code (byte-identical collation, ~133k ICU calls removed). Name
   > keeps `compareRo` so the visible order is unchanged (locked by a `mergeExpansionCityWave`
   > ordering guardrail test). Result: **`cities: toLocationCity+mergeWave` 1,926 ms → ~157 ms (~12×,
   > ~1.77 s of JS-thread time reclaimed).** End-to-end "app visible" only improved ~180 ms (2,639 →
   > 2,460 ms) — and the REASON is the key end-to-end finding below.
   >
   > **CORRECTED END-TO-END FINDING — the ~1.9 s `appReady`→"app visible" gap is NOT MapLibre and
   > NOT loading; it is a DELIBERATE BRANDED SPLASH.** `_layout.tsx` renders
   > `<AnimatedSplash isReady={appReady} onComplete=…/>`; `AnimatedSplash.tsx` holds a hard
   > **`MIN_DISPLAY_MS = 1100 + 720 + 120 = 1,940 ms`** floor (`setTimeout`→`minTimePassed`) then a
   > `FADE_OUT_MS = 380 ms` fade, firing `onComplete` only when `isReady && minTimePassed`. The
   > animation runs on **react-native-reanimated (UI thread)**, immune to JS-thread blocking. So the
   > **app is functionally ready at `appReady` ~565 ms** (fonts + session); the rest is the
   > intentional ~1.94 s + 0.38 s logo intro, and the cities materialize ran ENTIRELY hidden behind
   > it.
   >
   > **What this means for the materialize optimization (honest):** on THIS emulator the materialize
   > (1,926 ms) finished just within the 1,940 ms splash floor, so cutting it to 157 ms is
   > ~invisible here. **But on the target A51 (slower CPU) the unoptimized materialize would EXCEED
   > the 1,940 ms floor** → the reanimated splash lifts on schedule but reveals a JS-thread-FROZEN
   > app for the overflow (A51-materialize − 1,940 ms). The optimization (→157 ms, far under the
   > floor) guarantees the app is responsive the instant the splash lifts on ANY device — the real,
   > device-targeted win, even though it's masked on the fast emulator.
   >
   > **Actual perceived-launch lever = `MIN_DISPLAY_MS` itself** (a PRODUCT/branding decision, not a
   > perf bug): ready at ~565 ms but floored at 1,940 ms ⇒ ~1.4 s is deliberate brand time. Lowering
   > it (e.g. 1,940→800 ms) is the single biggest perceived-launch win available — but it's a design
   > choice, the owner's call, not a code fix. (Secondary JS item: `cleanCityCatalog` ~100–200 ms —
   > its per-row NFD `cityKey` is now memoized.)
3. **Search index choice.** `name_norm` prefix btree (≥2 chars, prefix, lighter at 100k) vs
   pg_trgm GIN (≥3 chars, infix). Prefer the btree — it matches the switcher's startsWith
   ranking.
   > **MEASURED (2026-06-27, docker tt_prodsim, 50k synthetic cities, `EXPLAIN (ANALYZE,
   > BUFFERS)`):** prefix btree — 2-char `name_norm LIKE 'ab%'` → Bitmap Index Scan on
   > `idx_cities_name_norm_prefix`, **0.086 ms**; 3-char `'abc%'` → Index Scan, **0.018 ms**. With
   > BOTH a prefix btree and a trgm GIN present, the planner picks the **btree** for a 2-char
   > prefix (0.099 ms). Index size: btree **4.4 MB** vs trgm GIN **6.3 MB** (~30% smaller →
   > lighter at 100k). **Recommendation confirmed: prefix btree, min-length 2.** (This validates
   > the migration-139 design as shipped.)
4. **`search_cities` recall.** Today in-tier search matches name + country label +
   country_name + admin_area + local_area + county. A name-only `name_norm` regresses
   secondary-field matches — concatenate those fields into `name_norm` server-side.
   > **MEASURED (2026-06-27, same harness) — the btree-vs-infix tension is real:** a 2-char
   > **infix** `name_norm LIKE '%ab%'` on the trgm GIN **degrades to a Seq Scan, 6.0 ms** (rows
   > removed by filter 44,400) — confirming DO-NOT #13. A 3-char infix `'%abc%'` uses the GIN
   > (0.177 ms). **Conclusion:** true server-side multi-field *infix* recall would need the trgm
   > GIN AND a ≥3-char floor — exactly what #13 forbids. As shipped, `name_norm` IS the
   > concatenation of name+admin_area+local_area+county+country_name, but `search_cities` matches
   > a left-anchored **name prefix** (name leads `name_norm`); the multi-field *substring* recall
   > is preserved **client-side** via the `search_key` the tier ships (the existing
   > `getCitySearchText().includes()` filter over the cached rows). This is the correct trade for
   > the dominant long-tail query (typing a city name) without a trgm index.
5. **`EXPANSION_CITY_WAVE` / single-row fallback edge case.** A persisted negative client-only
   `selectedCityId` would make the single-row server fetch return nothing → wrong-city/null
   flicker at boot. Verify the fallback handles negative ids.
6. **`expansion_status` "eager" set.** Confirm the enum literals are exhaustive for "should be
   eager" (no other status like a `live` that also needs to ship eagerly).
   > **MEASURED (2026-06-27, prod) — T002 histogram:** `active` **10,330**, `researching` **4**,
   > and `launch_ready` / `community_review` / `coming_soon` / `hidden` **all 0** (sum 10,334 =
   > total, so **no unknown literal** falls through `normalizeExpansionStatus`'s `active` default).
   > Two consequences: (a) the eager `IN`-list (`launch_ready`,`community_review`,`coming_soon`)
   > matches **zero** prod rows, so it contributes nothing — the tier is defined entirely by
   > `venue_count > 0 AND active(bool) AND not-hidden` = **10,318**. (b) The ~16-row non-tier gap
   > = the **4 `researching`** rows (which are `active(bool)=false`, so excluded by `active=true`)
   > + ~**12** `active`-status, not-hidden, `venue_count=0` cities (status `active` is not in the
   > eager `IN`-list, so they drop out). The eager set is exhaustive and correct against prod, but
   > **moot** at this data distribution — virtually every city has venues and ships eagerly.
7. **In-place client cache migrator.** Consider a row↔new-shape migrator so the cities reshape
   doesn't force an offline-breaking `since=null` re-pull on upgrade for offline users.
8. **Stage-4 HTTP/2 reality.** Profile from an A51 whether the 6 overlay calls truly
   multiplex over one connection (then consolidation mostly saves per-request overhead) — sets
   whether the LTE win is ~0.3 s or ~0.8 s.
9. **Explicitly out of scope (do not re-propose):** HTTP/3/QUIC is not a controllable lever in
   RN fetch; barrel-eval-lazy-import of the catalog module chain is a separate cold-start
   workstream tracked under the Android cold-start effort.

---

## 9. Appendix — per-family adversarial verdict summary

| Family | Mobile-perf lens | Server lens | Integration lens | Net |
|---|---|---|---|---|
| **catalog** | viable | viable | viable | **Winner — ~88–94% cities parse cut; row reduction is the gzip-immune lever** |
| **mapPayload** | viable | viable | viable | Co-ship simple variant; ~25–45% venue parse; map IS the list |
| **storage** | viable | viable | viable | Redundant with catalog; off-heap memory only; no first-install/100k fix |
| **edgeCache** | weak | viable | viable | Server-scale star; client CPU ~half catalog; defer + compose under catalog |
| **bootstrap** | weak | viable | viable | Latency/warm win, ~0 CPU; optional phase-4; needs hybrid split |
| **transport** | weak | viable | weak | Self-cancels on Hermes; subsumed into catalog's tier |

**Judge panel:** impact-first → `catalog` (runner-up `storage`); server-safety-first →
`edgeCache` (runner-up `catalog`, conceding the CDN artifact should *be* catalog's tier);
pragmatic-roi → `catalog` (runner-up `mapPayload`).

**Completeness critic:** agrees `catalog` is the right family, but flags that the single
highest-ROI *individual item* is the missing **deferral** lever (now Stage 1.5), and that the
~1,500 tier size + A51 reclaim figures are **unverified** and must be measured before
committing (now §8.1–8.2). Strongest program = catalog tiering **plus** off-critical-path
deferral.

**Bottom line:** Stage 0 + Stage 1 + Stage 1.5 + **catalog** + **mapPayload-simple** is the
drastic-win-per-effort program. It eliminates the dominant Android cold-mount JS spike,
lightens city-switch, and makes the server's heaviest query cheaper — entirely inside the
existing delta/MMKV/MapLibre architecture, with no server-crippling cost. `bootstrap` is an
optional latency layer; `edgeCache` is the eventual server-scale layer that serves catalog's
artifacts; `transport` and `storage`-as-cities-fix are traps.
