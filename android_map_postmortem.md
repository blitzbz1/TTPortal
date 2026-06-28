# Android Map Postmortem & Map-Provider Research

_Last updated: 2026-06-24_

Investigation into the Android map performance issues (pin freeze, cold-load
slowness, "Switch City" modal freeze), the fixes applied, and research into
whether to switch/consolidate the map provider.

---

## TL;DR

- **Many-pins map freeze** (the originally reported "app crashes on Android"):
  **root-caused and FIXED + verified.** Cause was one native view per venue
  marker with no clustering; a dense city (Berlin = 1,054 pins) pinned the JS
  thread until the app froze. Fixed with an Android-only GPU-clustered MapLibre
  GeoJSON layer.
- **"Switch City" modal freeze:** **root-caused and FIXED.** There was **no true
  infinite loop** (a multi-agent + adversarial re-investigation confirmed every
  effect in `LocationProvider`/`LocationSelector` is guarded and React-Query
  structural sharing keeps `cityRows` stable). The "never-settles" freeze was a
  **heavy O(10k) per-open burst** dominated by **ICU `localeCompare` re-instantiating
  a collator per call** while sorting the ~10k-city catalog, plus an **un-ported
  O(n×m) `countriesWithCities` in `LocationWelcome`**, plus a **redundant full
  catalog re-pull on every picker open** — all amplified by the degraded emulator.
  Fixed with byte-identical shared perf changes (reused `Intl.Collator`,
  precomputed capital lookup) + an **Android-only** skip of the forced
  refresh-on-open. **This is NOT a map-provider issue.**
- **Map provider:** **don't switch _away_ from MapLibre — consolidate _onto_
  it.** `@maplibre/maplibre-react-native` is the best (and effectively only)
  open-source, token-free, cross-platform option, and it already powers Android.
  The real problem is the architecture: a `react-native-maps`-API shim fanning
  out to **three different backends** (MapLibre on Android, **proprietary Apple
  Maps on iOS**, Leaflet on web).

---

## 1. Current architecture

| Surface | Backend | Open source? |
|---|---|---|
| Android | `@maplibre/maplibre-react-native` v11.0.1 (+ OpenFreeMap tiles) via a `react-native-maps`-API shim (`src/shims/react-native-maps.android.js`, wired in `metro.config.js`) | ✅ MapLibre (MIT/BSD) |
| iOS | **real `react-native-maps` → Apple Maps** | ❌ proprietary |
| Web | Leaflet shim (`src/shims/react-native-maps.web.js`) | ✅ |
| Reverse geocoding | **Nominatim + Photon** (OpenStreetMap) — `src/hooks/useAddressPicker.ts`, `src/lib/addressSearch.ts`, `src/screens/AddVenueScreen.tsx` | ✅ |

Relevant deps: `@maplibre/maplibre-react-native ^11.0.1`, `react-native-maps 1.20.1`, `leaflet ^1.9.4`.

The app uses a single `react-native-maps` API surface (`<MapView>`, `<Marker>`,
`<Callout>`) and resolves it per-platform. The draggable-pin → address flow
(`AddressPickerField` / `useAddressPicker` / `AddressPicker/AddressPickerMap*`)
already works through `<Marker draggable onDragEnd>` → Nominatim.

---

## 2. Issues & root-cause analysis

### Issue #1 — Map freezes with many pins  ✅ FIXED & VERIFIED

**Symptom.** After selecting a dense city, the app rendered one frame then went
100% unresponsive to touch; process pinned at **~130–140% CPU** with the JS/UI
thread wedged. Reproduced on the emulator with **Berlin = 1,054 venues**.

**Root cause.** `src/components/VenueMarkers.tsx` rendered **one `<Marker>` per
venue with no clustering** (clustering had been removed earlier). On Android the
`react-native-maps` shim turns each non-draggable `<Marker>` into a MapLibre
native view (`MLMarker`), so a dense city mounted 1,000+ live native views and
re-projected them every frame. MapLibre's own guidance ranks point rendering:
**GeoJSON + Circle/Symbol layers (GPU) ≫ PointAnnotation ≫ Marker/MarkerView** —
the app was using the worst option. iOS is unaffected because Apple Maps
(`MKMapView`) handles thousands of annotations natively.

**Fix.** Android-only **GPU-clustered GeoJSON layer**:
- `src/components/VenueClusterLayer.android.tsx` — `GeoJSONSource` with
  `cluster` (native supercluster) + `<Layer type="circle">` (cluster bubbles +
  individual dots) + `<Layer type="symbol">` (cluster counts) + tap-to-expand
  (`getClusterExpansionZoom` → camera). Pin signals (condition colour, friend
  ring, open-play halo, live count) are data-driven style.
- `src/components/VenueClusterLayer.tsx` — no-op stub so iOS/web don't bundle
  MapLibre.
- `src/screens/MapViewScreen.tsx` — `Platform.OS === 'android'` gate:
  clustered layer on Android, rich `<VenueMarkers>` on iOS (unchanged).

**Two bugs found while implementing the fix (both fixed):**
1. **Glyph 404 → CPU retry loop.** The `SymbolLayer` defaulted to the
   `Open Sans Regular, Arial Unicode MS Regular` font stack, which **404s** on
   the OpenFreeMap glyphs endpoint → MapLibre retried forever, *also* pinning
   CPU. Fixed by setting `text-font: ['Noto Sans Regular']` (the stack the base
   style serves).
2. **Tap-to-expand did nothing.** `onPress` is a bubbling event, so the tapped
   feature is under **`event.nativeEvent.features`**, not `event.features`.

**Verification (emulator, Berlin 1,054 pins).** Steady-state CPU **0.0%** (was
130–140%), responsive, clusters render with counts, tap-a-cluster zooms in and
splits it. en + ro both fine. A multi-agent diff review confirmed **no
regression** to the iOS/web paths.

---

### Issue #2 — Cold-load JS/GC spike  🟡 CHARACTERIZED (no separate fix)

**Symptom.** Loading a city's data **cold** (cache miss) spikes the JS thread
and GC for tens of seconds before settling to idle; on the emulator this looked
like a freeze (≈90s for the map; longer when the env was degraded).

**Findings.**
- **Not a render storm** — `MapViewScreen` rendered ~5×, not thousands.
- **JS + GC bound** — the hot threads were `mqt_v_js` (JS) plus
  `HeapTaskDaemon` (GC): heavy allocation while processing the city's data
  (venues + the 10k-city catalog) and the first map render.
- **Heavily emulator-amplified.** The emulator runs a slow software Hermes with
  no hardware GPU (`-gpu swiftshader_indirect`). The same work is very likely
  much milder on real hardware.
- It is **not** the pin-count bug (Issue #1) and not city-specific.

**Update (2026-06-24) — measured on-device; it's a DEV-build artifact.** A
release APK was built (debug-signed) and its cold start compared to the dev client
on the same emulator/catalog:

| | Dev (debug) | Release |
|---|---|---|
| JS thread (`mqt_v_js`) busy | ~7s at 88–100% | ~2–3s |
| Time to first frame (`Displayed`) | **+13s** | **+4s** |
| Cold-start screen | **black ~3.3s → ~10s** | **brand green throughout, no black** |

The "black screen on launch" is the **JS thread pinned during cold mount** (mostly
Hermes evaluating ~4,700 unoptimised dev modules — no GC thrash in logcat, just
solid CPU) which misses the Android-12 splash timeout (~3.3s); the system removes
the splash and the React host surface shows **black** until the first JS frame.
In **release** the JS thread frees up in ~2–3s, so the native splash covers the
whole startup and **there is no black screen**. → For production users this is a
non-issue; the dev black is dev-only.

Note: an `AppTheme` `android:windowBackground` override was tried to recolour the
gap and **reverted** — a red-background isolation test proved the gap stays black
regardless (the `postSplashScreenTheme` switch doesn't re-apply `windowBackground`
to the live window, and/or the RN/Fabric host surface paints black over it). The
only real levers are (a) reduce cold-load JS so the first frame lands inside the
splash window (release already does), or (b) a deeper native change (custom splash
view that outlives the system timeout / set the React root-view background). Both
are dev-experience-only.

### Venue-data fetch cost (measured against prod Supabase, 2026-06-24)

| RPC | Time | Payload | Rows |
|---|---|---|---|
| `get_venues_delta` full, dense city (Berlin, `since=null`) | 0.8–1.6s | 453 KB | 1,054 |
| `get_cities_delta` full (catalog) | 1.0–1.9s | **3.35 MB** | 10,330 |
| `get_venues_delta` warm delta | ~0.85s | 85 B | 0 |

Longest single venue fetch = the **full `get_venues_delta` for a dense city on cold
start** (server query + 453 KB transfer + on-device `JSON.parse`/MMKV write). The
**3.35 MB cities catalog** is the heaviest payload overall and its on-device
`JSON.parse` is the biggest contributor to the cold-mount JS spike. Even an empty
delta costs **~0.85s** of pure round-trip latency, and the map fires several
per-city RPCs (venues + live counts + amenities + coaching + open-play + unvisited
+ friend presence), so that latency is paid repeatedly.

---

### Issue #3 — "Switch City" modal freeze  ✅ FIXED (no loop; it was heavy O(10k) work)

**Symptom.** After selecting a city (e.g. Berlin), reopening the city switcher
freezes — JS thread pins at **~92–100%** and **never settles** while the picker
is shown; it stops only when the picker unmounts. Same code path freezes the
onboarding picker. **This is app-side catalog code, not the map.**

**What was found & fixed:**

- **`countriesWithCities` was O(n×m).** In `src/components/LocationSelector.tsx`
  it computed `activeCountries.filter(c => activeCities.some(...))` =
  **44 countries × ~10,330 cities ≈ 450,000 comparisons per render**, plus a
  locale-aware sort. **Fixed** → Set-based **O(n+m)** membership. (Confirmed as
  a root-cause-level hotspot by a multi-agent investigation.)
- **`refreshCatalog` identity stability** (`src/hooks/queries/useCitiesQuery.ts`)
  — it depended on `query.data` while *calling* `setQueryData`, a textbook
  identity-churn loop pattern. **Fixed** (deps → `[queryClient]`, read via
  `getQueryData`). _Note: instrumentation later showed `refreshCatalog` is **not**
  the active loop during the freeze, but the change is a correct improvement._
- **`Intl.DisplayNames` caching** (`src/lib/countryLabels.ts`) —
  `getIntlRegionName` rebuilt a `new Intl.DisplayNames` on **every call**; the
  country list built hundreds per render (very slow on Android Hermes). **Fixed**
  (cached per locale).
- Reverted a redundant `refetchOnWindowFocus: false` on the cities query — the
  global `QueryClient` (`src/lib/queryClient.ts`) already sets it false.

**RESOLUTION — there was no remaining loop.** A second, multi-agent +
adversarial re-investigation reached high consensus: **no setState→render→setState
cycle exists** (both `LocationProvider` effects and both picker effects are guarded
and self-correct; React-Query v5 structural sharing returns the previous `cityRows`
reference when the catalog content is unchanged, so `activeCities`/`selectedCity` do
**not** churn between idle renders). The earlier "0 `refreshCatalog` calls during the
freeze" reading is consistent with the stale-JS-chunk caveat and does not change the
conclusion. The freeze was **heavy O(10k) work per picker open**, dominated on Hermes
by **ICU `localeCompare`**, which re-instantiates a collator on every call (especially
with an explicit locale). One open fired several full ~10k `localeCompare` sorts:

- `mergeExpansionCityWave` (≈240k calls), `cleanCityCatalog` (≈120k, runs in both the
  `queryFn` and the on-open `refreshCatalog`), `applyCitiesDelta`, and
  `getRecommendedCities` (sorts ~10k then slices to 10).
- `isCapitalCity` re-normalized (NFD + regex) ~10k city names **and** the 44 capital
  constants on every `getRecommendedCities` run.
- `LocationWelcome` still ran the **O(n×m) `countriesWithCities`** (the hotspot that
  had only been fixed in `LocationSelector`).
- `refreshCatalog` did a **full `since=null` re-pull + 2 sorts + `JSON.stringify(10k)`
  + MMKV write + structural-sharing deep-walk on every open** — the single heaviest
  per-open burst. The degraded emulator stretched all of this into an apparent freeze.

**Fixes applied (Android-only effect; iOS/web behaviour byte-identical):**
1. New `src/lib/collation.ts` — reused `Intl.Collator`s. Every hot-path
   `localeCompare` over the ~10k catalog now uses a collator constructed once.
   ECMA-402 guarantees identical ordering, so iOS/web output is unchanged (proven by
   `src/lib/__tests__/collation.test.ts`). Applied in `locationHelpers`
   (`mergeExpansionCityWave`, `getCountriesFromCities`, `getRecommendedCities`),
   `cityCatalog`, `citiesPersistentCache`, and both pickers' search tiebreaks.
2. `locationHelpers.isCapitalCity` — precomputed `NORMALIZED_CAPITAL_KEYS` set +
   cached per-name normalization (one normalize per city, byte-identical boolean).
3. `LocationWelcome.countriesWithCities` — ported the Set-based **O(n+m)** fix.
4. **Android-only gate** (`Platform.OS === 'android'`) skipping the forced
   refresh-on-open in **both** pickers; the cities query's `refetchOnMount` +
   5-min `staleTime` keep the catalog fresh. iOS/web keep the forced refresh.

**Verification:** `npm run typecheck`, `npm run lint` (0 errors), the full Jest suite
(**1431 tests pass**), and `npx expo export --platform web` (exit 0) are all green;
new tests pin the collator↔`localeCompare` equivalence and the Android-only skip.
On-device profiling on real hardware is still the gold standard but was not required
to land these (the costs are deterministic and the changes are behaviour-neutral off
Android).

---

## 3. Why this was hard to validate (tooling notes)

The on-device validation was repeatedly blocked by the local toolchain, not the
code. For anyone reproducing:
- The emulator (`ttportal_a16`, Android 16 / API 36, `-gpu swiftshader_indirect`)
  **crashed ~6 times** over the session and became **memory-starved** (host
  pressure), which inflates every CPU reading and stretches cold-loads to
  90–225s.
- The dev client **served stale cached JS chunks**: edits to non-component hook
  modules (e.g. `useCitiesQuery.ts`) didn't reach the running app on relaunch;
  instrumentation logs never appeared. A full **`npx expo run:android` rebuild**
  was required to reliably load such edits.
- Net effect: single measurements were untrustworthy (taps missed, logs absent,
  "loop" indistinguishable from "slow cold-load"). **Use a real device + a
  profiler** for the remaining Issue #3 work.

---

## 4. Map-provider research

### Verdict: keep MapLibre; consolidate the whole stack onto it

For an **open-source, token-free, 1000+-pins, draggable-pin-to-address** use
case, `@maplibre/maplibre-react-native` is the best and effectively **only**
viable cross-platform-native option — and it already powers Android.

| Library | Open source / token-free? | 1000+ markers | New-Arch / Expo | Verdict |
|---|---|---|---|---|
| **MapLibre RN v11** | ✅ MIT (BSD core), no key, bring-your-own tiles | ✅ GeoJSON + native clustering (GPU) | ✅ (v11 is New-Arch-only) | **use this** |
| @rnmapbox/maps | ❌ dropped the token-free MapLibre flavor in v10 → Mapbox token + usage fees | ✅ | ✅ | avoid |
| react-native-maps (current iOS leg) | ❌ Apple/Google tiles; **mandatory billable Google key** on Android | ❌ 1 native view/marker; chokes past ~100–1000 | ✅ | avoid |
| expo-maps | ❌ Google/Apple tiles; **alpha**; no built-in clustering | ❌ | ✅ (dev build) | avoid |

**Requirements check (MapLibre):**
- **Many pins:** `GeoJSONSource` (renamed from `ShapeSource` in v11) +
  `cluster`/`clusterRadius`/`clusterMinPoints` + `<Layer type="circle"|"symbol">`
  — GPU, one native view, handles thousands. _(Already implemented for Android —
  see `VenueClusterLayer.android.tsx`.)_
- **Draggable pin → address:** `MarkerView` (renamed from `PointAnnotation` in
  v11) `draggable` + `onDragEnd` → existing **Nominatim** reverse-geocode. The
  old Android drag bug (maplibre-react-native **#1134**) is **closed/fixed**.

### Reverse geocoding (already open-source)
- **Nominatim** for the pin (most accurate reverse lookup, structured `address{}`
  the app already parses) + **Photon** for typeahead (Nominatim's public API
  forbids client-side autocomplete).
- ⚠️ **Get off the public `nominatim.openstreetmap.org` for production.** Its
  usage policy is strict: **1 req/s**, mandatory result caching, mandatory custom
  `User-Agent`, no client autocomplete, no bulk/grid reverse. Use a managed
  OSS-data host (Geocode.earth / MapTiler / Stadia) or **self-host**
  Nominatim + Photon.

### Tiles / style
- Keep **OpenFreeMap** short-term; the glyph 404 was a font-stack issue (already
  fixed in the cluster layer with `Noto Sans Regular`).
- For production reliability + offline: **self-hosted Protomaps PMTiles** — ship
  per-city/per-country `.pmtiles` extracts (maps cleanly onto the 10k-city
  model) plus self-hosted glyphs/sprites on cheap static storage (S3 / R2 /
  Supabase Storage). No API key, single origin, permanently eliminates the 404.

### Migration / architecture (honest)
- The **provider is not the problem** — the **3-backend shim with iOS on
  proprietary Apple Maps** is. The worst freezes (Issue #3) are app-side catalog
  work and are **provider-independent**; a map swap will not fix them.
- Consolidating iOS onto MapLibre (dropping `react-native-maps`/Apple Maps) is a
  real migration; sequence it after the live bugs.
- Bump `@maplibre/maplibre-react-native` **11.0.1 → 11.3.5** when consolidating
  (API renames: `ShapeSource`→`GeoJSONSource`, `PointAnnotation`→`MarkerView`,
  per-type `*Layer` → unified `<Layer type/paint/layout>`). Expo SDK 54 already
  satisfies its peer deps (RN 0.81 / React 19.1).

---

## 5. Recommended roadmap

1. **Done.** Land the Android clustering fix (Issue #1) — verified.
2. **Done.** Issue #3 fully resolved: reused `Intl.Collator` across the ~10k-city
   sorts, precomputed capital lookup, ported the O(n+m) `countriesWithCities` to
   `LocationWelcome`, and Android-gated the redundant refresh-on-open. The earlier
   `countriesWithCities`(LocationSelector)/`refreshCatalog`/`Intl` partial fixes are
   subsumed here.
3. **Optional follow-up.** Confirm the win with a real-device Hermes flame graph
   (the deterministic costs were removed code-side; this is verification, not a fix).
4. **Soon (architecture).** Consolidate **iOS onto MapLibre**; use the
   GeoJSON + clustering layer on all platforms; bump to v11.3.5.
5. **Production hardening.** Self-hosted **Protomaps PMTiles** tiles + glyphs;
   move reverse geocoding **off the public Nominatim**.

---

## 6. Files touched (this investigation)

| File | Change | Status |
|---|---|---|
| `src/components/VenueClusterLayer.android.tsx` | new — Android GPU clustered layer | ✅ verified |
| `src/components/VenueClusterLayer.tsx` | new — iOS/web stub | ✅ |
| `src/screens/MapViewScreen.tsx` | Platform gate + `handleClusterPress` | ✅ verified |
| `src/lib/collation.ts` | new — reused `Intl.Collator`s (byte-identical to `localeCompare`) | ✅ landed |
| `src/lib/locationHelpers.ts` | collator sorts + precomputed `NORMALIZED_CAPITAL_KEYS` + cached name normalize | ✅ landed |
| `src/lib/cityCatalog.ts` | `cleanCityCatalog` sort → reused `Intl.Collator('ro')` | ✅ landed |
| `src/lib/citiesPersistentCache.ts` | `applyCitiesDelta` sort → reused `Intl.Collator('ro')` | ✅ landed |
| `src/components/LocationSelector.tsx` | `countriesWithCities` → Set-based O(n+m); **Android-only** skip of refresh-on-open; collator search tiebreak | ✅ landed |
| `src/components/LocationWelcome.tsx` | ported O(n+m) `countriesWithCities`; **Android-only** skip of refresh-on-open; collator search tiebreaks | ✅ landed |
| `src/hooks/queries/useCitiesQuery.ts` | `refreshCatalog` identity stability | ✅ landed |
| `src/lib/countryLabels.ts` | cache `Intl.DisplayNames` per locale | ✅ landed |
| `src/lib/__tests__/collation.test.ts` | new — pins collator↔`localeCompare` equivalence | ✅ landed |
| `src/components/__tests__/LocationSelector.test.tsx` | new test — Android skips refresh-on-open | ✅ landed |
| `src/components/VenueMarkers.tsx` | unchanged (iOS path) | — |

---

## 7. Sources

- MapLibre RN: <https://maplibre.org/maplibre-react-native/> · v11 migration
  <https://maplibre.org/maplibre-react-native/docs/setup/migrations/v11/> ·
  releases <https://github.com/maplibre/maplibre-react-native/releases> ·
  draggable bug <https://github.com/maplibre/maplibre-react-native/issues/1134>
- rnmapbox MapLibre-flavor removal (v10): <https://github.com/rnmapbox/maps>
- MapLibre large-data guidance:
  <https://maplibre.org/maplibre-gl-js/docs/guides/large-data/>
- Protomaps PMTiles: <https://protomaps.com/docs/pmtiles>
- Nominatim reverse API + usage policy:
  <https://nominatim.org/release-docs/latest/api/Reverse/> ·
  <https://operations.osmfoundation.org/policies/nominatim/>
