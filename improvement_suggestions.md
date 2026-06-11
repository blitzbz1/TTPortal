# TTPortal — Improvement & Optimization Suggestions

**Date:** 2026-06-10 · **Analyzed at:** commit `9a48d1e` on `001-user-auth` (~340 TS files / ~60k LOC, 98 Supabase migrations)

**Method:** Multi-agent deep analysis across 8 dimensions (architecture, performance, security, database, testing/CI, offline resilience, UX/i18n/a11y, dependencies/build). Every finding below was independently re-verified against the current code by an adversarial reviewer; of 73 raw findings, 2 were refuted and dropped. Items already planned in `improvements.md` (all 19 UI/UX items shipped), `mspec.md`, `monitoring.md`, or `appstore_requirements.md` are deliberately **not** repeated here — except where the existing plan turned out to be stale (flagged inline).

Tags: `impact/effort` — e.g. `high/low` = high impact, low effort (do these first).

---

## Top 10 priorities

| # | Finding | Area | Tag |
|---|---------|------|-----|
| 1 | Any user can make themselves admin via PostgREST (`profiles.is_admin`) | Security | `high/low` |
| 2 | SECURITY DEFINER RPCs trust client-supplied user IDs (full location-history leak) | Security | `high/low` |
| 3 | Live check-in locations of all users readable by any authenticated account | Security | `high/medium` |
| 4 | All users' email addresses harvestable from `profiles` | Security | `high/medium` |
| 5 | CI has zero quality gates and HEAD ships with 2 failing tests | CI | `high/low` |
| 6 | Migration chain not replayable; prod schema has drifted from the repo | Database | `high/medium` |
| 7 | Android release builds are debug-signed with versionCode 1 | Build | `high/medium` |
| 8 | React Query never wired to NetInfo/AppState — offline recovery is a no-op | Offline | `high/low` |
| 9 | Map renders ~1000 unclustered markers in large cities (clustering silently regressed) | Performance | `high/medium` |
| 10 | Venues/events cannot be shared as openable links | UX/Growth | `high/medium` |

---

## 1. Security & Privacy

### 1.1 Privilege escalation: any user can set their own `is_admin` / `is_moderator` `high/low`
The only UPDATE policy on `profiles` is own-row (`auth.uid() = id`) with no column restriction (`supabase/migrations/002_profiles_rls.sql:14-19`), and Supabase grants `authenticated` UPDATE on all columns. Any logged-in user can `PATCH /rest/v1/profiles?id=eq.<own-id>` with `{"is_admin": true}` — unlocking every admin RPC, rate-limit bypass, venue delete, and `admin_search_users` (all user emails). Migration 081's header comment only considers setting *another* user's flag, never your own.

**Fix:** Add a `BEFORE UPDATE` trigger on `profiles` that raises unless `is_admin`/`is_moderator`/`pending_deletion_at` are unchanged or the caller is admin — or `REVOKE UPDATE (is_admin, is_moderator) ON public.profiles FROM authenticated, anon` and route role changes exclusively through the existing `admin_set_user_moderator` SECURITY DEFINER RPC. Add a regression test that a normal JWT PATCH of `is_admin` is rejected.

### 1.2 SECURITY DEFINER RPCs trust client-supplied user IDs `high/low`
Three deployed RPCs take the acting identity as a parameter instead of using `auth.uid()`:
- `get_friend_feed(p_friend_ids uuid[])` (`052_friend_feed_rpc.sql`) returns the **complete historical check-in/review stream for any array of user IDs** with no friendship verification — defeating the RLS that limits strangers to active check-ins only. User UUIDs are freely harvestable from public `event_participants`/`reviews` reads.
- `get_venue_detail(p_venue_id, p_user_id)` (`044_venue_detail_bundle.sql`) leaks `is_favorited` and `user_active_checkin` for an arbitrary user — granted to `anon`.
- `get_friends_at_venue(p_venue_id, p_user_id)` enumerates an arbitrary user's friends at a venue — granted to `anon`.

**Fix:** In all three, derive identity from `auth.uid()` server-side; `get_friend_feed` should compute the caller's accepted friendships itself and ignore `p_friend_ids`. Ship as one migration plus matching client changes (`src/services/feed.ts`, `src/hooks/queries/useVenueDetailQuery.ts`).

### 1.3 Real-time location of all users leaks to any authenticated account `high/medium`
`checkins` policy `'Active checkins are readable' USING (ended_at > now())` (`004_rls_policies.sql:63-65`) has no ownership/friendship scoping — any logged-in user can enumerate the live location of **every** checked-in user. The client only queries by venue or friend list, but RLS doesn't bound a malicious client. This is a stalking-grade privacy leak for a location app.

**Fix:** Scope the SELECT policy to own rows + accepted friends; expose anonymous per-venue counts through a SECURITY DEFINER RPC for the "who's here now" surface. (Pairs with the user-facing privacy controls gap in §9.5.)

### 1.4 Every authenticated user can harvest all email addresses `high/medium`
`profiles` SELECT is `USING (true)` for `authenticated` (`002_profiles_rls.sql:8-12`) and the table contains `email` (and `pending_deletion_at`). One query scrapes the entire user base's emails — GDPR-relevant PII exposure and a spam seed list.

**Fix:** Move `email` to a self-only surface: either a separate table, or revoke column SELECT and serve public fields (id, name, username, avatar, city) through a view; self email comes from `auth.getUser()`.

### 1.5 Storage bucket policies not in source control; daily image cap bypassable `medium/medium`
No migration defines `storage.objects` RLS for `venue-photos`; the 10-image/day cap is enforced only by the client calling `record_image_upload()` *before* uploading (`080_venue_change_request_photo.sql` admits "Storage uploads have no DB trigger hook"). A malicious client skips the RPC and uploads unlimited images to arbitrary venue paths.

**Fix:** Commit storage RLS as a migration (path-scoped INSERT, owner check, size limits); enforce the cap server-side via a signed-upload Edge Function or a policy that counts recent objects.

### 1.6 Review and condition-vote spam is unbounded `medium/low`
Neither `reviews` nor `condition_votes` has a `UNIQUE(user_id, venue_id)` constraint or a rate-limit trigger (047's triggers cover only venues/events/checkins). One user can insert thousands of reviews for a venue, skewing `venue_stats.avg_rating`, the reviews leaderboard, and the crowd-sourced condition color.

**Fix:** Add the unique constraints, switch services to upsert (edit-in-place), and seed `rate_limit_config` rows + BEFORE INSERT triggers for both tables.

### 1.7 Private/friends event participant lists are world-readable `medium/low`
Migration 058 made `events` visibility-aware, but `event_participants` still has `SELECT USING (true)` with no role restriction (`004_rls_policies.sql:111-113`) — anyone, including anonymous, can enumerate attendees of a private event.

**Fix:** Replace with a policy that mirrors the parent event's visibility predicate (EXISTS subquery against `events`) or self-rows.

### 1.8 Open catalog inserts and other hardening gaps `medium/medium`
- `cities`/`countries` INSERT policies are `WITH CHECK (true)` for any authenticated user (`034`, `069`) — anyone can pollute the shared location catalog that delta-syncs to every client. Replace with validating `find_or_create_city/country` SECURITY DEFINER RPCs (dedupe, normalize, optionally pending-review).
- `amatur_cache` write policy is `FOR ALL USING(true)` with **no `TO` clause**, so it applies to everyone, not `service_role` as the comment claims (`022_amatur_cache.sql`) — cache poisoning / HTML injection into the AmaTur feed. Drop the policy (service_role bypasses RLS anyway).
- Older SECURITY DEFINER functions (`handle_new_user`, `refresh_stats`, the 009 notification triggers, `send_event_invites`) run without `SET search_path` — add `SET search_path = public, pg_temp` to match the convention already used in 073/078/080/081.

---

## 2. Database & Backend

### 2.1 Migration chain is not replayable from scratch `high/medium`
A fresh `supabase db reset` fails at least twice: migration 026 depends on `public.challenges` objects that only exist in `supabase/challenge-system/` (outside the chain), and 062 was retro-edited after running in prod (uses `country_code` + an index that only appear in 063 — its own comment admits this). Eight `.txt` files sit in `migrations/` that the CLI silently ignores; `066b` and `068` contain real DDL/data repairs that exist **only** as `.txt`. The restore runbook works around all this with pg_dump — which only works while a current backup exists.

**Fix:** Make "`supabase db reset` succeeds" a CI gate. Fold the challenge-system SQL into the chain, repair or squash 062–067 into a baseline, convert the `.txt`-only repairs to real migrations, and delete the duplicates.

### 2.2 Prod schema has drifted from the repo `high/medium`
Confirmed prod-only objects: the 2026-05-30 prod dump contains `public.check_ins` and `public.messages` tables no repo migration creates (vestigial, documented in 056 comments). `073`/`074` each exist as diverging `.sql`/`.txt` twins with behaviorally different versions of `admin_get_venues_in_viewport` — no record of which version prod runs. `full_migration.sql` covers only migrations 000–017 and `run_migrations.ps1` only 000–010, yet `TECHNICAL.md` documents both as the migration procedure. Related dead code: `src/services/reviews.ts:42` calls `rpc('flag_review')`, which exists **nowhere** (neither repo nor prod) — `flagReview` is exported but never imported; 072's report flow supersedes it. Delete it.

**Fix:** Diff a prod dump against a clean chain replay; back-port a migration for every prod-only object or drop it. Delete/deprecate `full_migration.sql` and `run_migrations.ps1` (update TECHNICAL.md). Keep one canonical file per migration. Add a scheduled CI job re-running the dump-vs-replay diff.

### 2.3 Every review write (and profile rename!) synchronously refreshes all four materialized views `medium/medium`
`refresh_stats()` refreshes `venue_stats` + 3 leaderboard views and is wired into AFTER triggers on `reviews` (028) and on `profiles.full_name` updates (018). `venue_stats` is a full aggregate over **all** venues; with the OSM import heading to ~33k venues, every review submission recomputes global aggregates inside the user's request, and concurrent writers serialize on the matview lock.

**Fix:** Move `refresh_stats` to a pg_cron job (2–5 min staleness is fine for ratings/leaderboards), or maintain a plain `venue_stats_live` table with incremental per-row triggers and keep matviews cron-refreshed for leaderboards only.

### 2.4 No spatial type/index strategy `medium/medium`
Venues store raw `lat`/`lng` doubles; the only geo index is a composite b-tree (effectively bounding only lat). The 50 m import dedup re-implements haversine **twice** in awk inside `apply_with_geo_dedup.sh`; viewport queries are plain `BETWEEN` scans. Distance-centric features (near-me, mspec catchment analytics) will keep copying this fragile math.

**Fix:** `CREATE EXTENSION postgis`; add a generated `geom geography(Point,4326)` column + GIST index; replace the import gate with `ST_DWithin`, viewport queries with `ST_MakeEnvelope && geom`, and expose a `get_venues_near(lat,lng,radius)` RPC.

### 2.5 Production data operations run from untracked scripts `medium/low`
The OSM import/rollback tooling (`apply_with_geo_dedup.sh`, `apply_new_cities_only.sh`, `fix_imported_venues_nets.sql`, the watermark dot-file, the wien seeds) is untracked — the only record of what hit prod on 2026-06-08 is on this machine. Rollback relies on `id > <watermark> AND submitted_by IS NULL`, which would **delete a real user's venue** submitted mid-import.

**Fix:** Commit the scripts. Add `venues.source` + an `import_runs` table (run id, file, counts) so imported rows carry `import_run_id` and rollback becomes an exact `DELETE WHERE import_run_id = X`. Move `tables.json`/csv intermediates out of the repo root.

### 2.6 Notification copy is hardcoded Romanian inside DB triggers `medium/medium`
All notification titles/bodies (in-app rows and push payloads) are Romanian string literals inside trigger functions (`055`, `009`), persisted into `notifications.title/body` — a German user joining a Vienna event gets Romanian pushes, and the client can't re-localize stored text. `profiles.lang` exists but is never consulted.

**Fix:** Persist type + params in the existing `data` JSONB and render inbox rows client-side from i18n keys; for push, add a `notification_templates(type, lang, title, body)` table keyed by recipient `profiles.lang` (or compose pushes in an Edge Function sharing the app's locale JSON).

### 2.7 Dual city identity on venues with no consistency mechanism `medium/low`
Every venue stores both `city TEXT NOT NULL` (legacy) and `city_id` FK with nothing keeping them in sync; RPCs filter on either independently, and repairs must update both by hand. With 10k+ cities across 44 countries, duplicate names make the text column ambiguous; desync is invisible because the values are usually equal.

**Fix:** Make `city_id` the source of truth: a BEFORE INSERT/UPDATE trigger that derives `city` from `cities.name`, a one-time repair UPDATE, then retire the `p_city` text filter path from `get_venues_delta`.

### 2.8 (See also §1) RLS findings above are equally "database" work
Items 1.1–1.8 all land as migrations; sequence them with 2.1/2.2 so the chain stays replayable.

---

## 3. Testing & CI/CD

### 3.1 CI has zero quality gates — and HEAD currently has 2 failing tests `high/low`
The only workflow (`deploy.yml`) builds and deploys web to GitHub Pages on every push to `001-user-auth` with no lint/typecheck/test step, using `npm install` instead of `npm ci`. Right now `npx jest` at HEAD fails 2 tests in `src/__tests__/auth-edge-cases.test.tsx` — broken by commit `9a48d1e` (social-auth feature flag) whose error copy still suggests Google/Apple sign-in. The full 866-test suite takes ~5.3s; a gate is essentially free.

**Fix:** Fix the two tests (make the duplicate-email copy flag-aware in `auth-utils.ts:37`). Add a `ci` job (`npm ci` → typecheck → lint → `jest --ci`) and make deploy `needs: ci`. Replace `npm install` with `npm ci`. Also: merge to `main` and make it the deploy branch — the de-facto trunk being a feature branch breaks PR/Pages assumptions (`deploy.yml:4` literally says "# Change this to match your current branch").

### 3.2 Zero tests for 98 migrations, RLS, triggers, and Edge Functions `high/high`
No pgTAP, no `supabase/tests`, and the service unit tests mock the whole supabase chain (argument-shape testing only). The DB layer caused the only production incident (realtime egress), and nothing would catch a recurrence before the planned Grafana exporter exists.

**Fix:** Add a `db-test` CI job: `supabase start` → `supabase db reset` (gates broken chains alone), then a small pgTAP suite for the highest-value invariants: (a) `notifications` not in `supabase_realtime` publication (postmortem regression test); (b) anon cannot SELECT others' checkins/profiles; (c) `handle_new_user` creates a profile; (d) `get_venues_delta` watermark semantics. Add `deno test` for `amatur-proxy` HTML parsing.

### 3.3 Maestro E2E suite is broken, hardcodes prod credentials, and never runs `high/high`
Flow 01 asserts the Google/Apple buttons that are now feature-flagged off — the suite fails at launch and has rotted since 2026-03-27. Flows tap hardcoded Romanian strings and a literal venue, and `helpers/login.yaml` commits live credentials (`andrei@test.com`/`test1234`) that write real check-ins to prod.

**Fix:** Repair flow 01; switch taps to testIDs + fixed launch locale; point E2E at a local `supabase start` stack with seeded data and env-injected credentials; add flows for post-March features (create/join event, challenge cooldown, change requests); run a smoke subset nightly in CI.

### 3.4 11 of 27 service modules untested — including compliance-critical ones `high/medium`
Untested: `account.ts` (30-day deletion — App Store compliance), `moderation.ts` (UGC reports/blocks — also compliance), `notifications.ts`, `pushTokens.ts`, `favorites.ts`, `leaderboard.ts`, `conditions.ts`, `equipment.ts`, and all three delta-sync clients (a regression there silently corrupts every user's cached venue list). Each existing test also re-declares its own ~25-line supabase mock.

**Fix:** Extract a shared `createQueryChain` test util, then add tests in that priority order — delta-sync watermark/merge semantics first.

### 3.5 Global react-query mock makes cache/optimistic logic structurally untestable `medium/medium`
`jest.setup.js:213-318` replaces useQuery/useMutation with approximations and a noop QueryClient — so `useFavoritesQuery`'s optimistic update/rollback executes against no-ops in every test; a wrong query key or broken rollback can never fail a test.

**Fix:** Add `src/hooks/queries/__tests__/` using `jest.requireActual` + a real QueryClient via `renderHook`; first targets: `useFavoritesQuery` optimistic/rollback, `useVenuesQuery`/`useVenueDetailQuery` key correctness. Longer term, migrate screen tests to a `renderWithProviders` util.

### 3.6 Offline write queue has zero tests `medium/low`
`offlineQueue.ts` (dedup, corruption fallback) and the `OfflineQueueProvider` flush loop (retention on handler error, reentrancy guard, NetInfo-transition trigger) only execute on flaky networks — exactly where manual testing never goes. The MMKV mock in jest.setup makes unit-testing trivial.

### 3.7 Coverage is effectively unmeasured `medium/low`
`coverage/lcov.info` is a stale single-file artifact from March; `jest.config.js` has no `collectCoverageFrom`, so untested modules produce no coverage rows at all — blind spots are invisible. Add `collectCoverageFrom`/`json-summary`, run coverage in CI, and start with directory-scoped thresholds on `src/services` and `src/lib`.

### 3.8 EAS builds are fully manual `medium/low`
`eas.json` has no development profile, no iOS config, no `autoIncrement`; no workflow runs `eas build`. Add a development profile, `autoIncrement: true` on production, per-profile env, and a tag-triggered build workflow gated on CI. (See §8.1 — this is currently moot until signing is fixed.)

---

## 4. Offline & Resilience

### 4.1 React Query is never wired to NetInfo/AppState `high/low`
TanStack Query v5 on RN always reports "online" unless `onlineManager.setEventListener` is wired to NetInfo (and `focusManager` to AppState). No such wiring exists — so `refetchOnReconnect: true` never fires on native, offline queries burn their retries against a dead socket and surface errors, and mutations never pause. This is a ~10-line fix in `src/lib/queryClient.ts` that improves every screen at once.

### 4.2 Offline queue never flushes on cold start or foreground `high/low`
`flush()` is only called on an observed offline→online transition within the same session (`OfflineQueueProvider.tsx:54-69`). The queue persists in MMKV, so offline changes followed by an app kill are queued forever — and the next refetch visibly reverts the user's optimistic action. Flush on mount when pending>0 and online, on AppState active, and after enqueue while online.

### 4.3 Replay handlers are mount-scoped; favorites only replay while FavoritesScreen is open `high/medium`
Handlers register in component `useEffect`s; `flush()` skips entries with no handler. A favorite toggled offline won't replay once the user navigates away (the common case). Move handlers to a static module-level registry (entityType → service fn) imported by the provider — this also fixes the latent bug where two consumers of one entityType clobber each other's registry entry on unmount.

### 4.4 Check-ins, reviews, and event joins made offline are simply lost `high/medium`
The queue covers exactly two entity types (favorite, notification read). Core actions fail with a generic Alert and drop the data — and gyms/basements are exactly where signal dies. Check-ins are the foundation of the planned B2B analytics; silently dropped ones corrupt the key metric. Tier it: (1) offline-specific messaging via `useOfflineQueue().isOnline`; (2) queue check-ins with original timestamps (the service already accepts explicit timestamps) and replay via a root-registered handler.

### 4.5 Venue detail dead-ends offline; its cache layer is dead code `high/medium`
`useVenueDetailQuery` is memory-only; on failure the screen renders a bare `notFound` text — wrong message, no retry, no back. Meanwhile `src/lib/venueDetailCache.ts` implements exactly the intended SQLite cache but its save/load functions are **never called** (only its invalidators are — invalidations against a permanently empty cache). Wire the cache into the queryFn fallback, distinguish network-error from genuinely-missing, and disable write actions when serving cache.

### 4.6 Sign-out leaks the previous user's data; failed queue entries retry forever `medium/medium`
Nothing clears per-user persisted state on sign-out: the SQLite cache (events, play history, profile) stays readable by the next account on the device, and the previous user's queued ops replay under the new session (failing RLS forever — there's no retry cap, TTL, or dead-letter). Hook `SIGNED_OUT` in SessionProvider to clear queue + per-user caches + queryClient; add an attempts counter and dead-letter to flush.

### 4.7 Persistent caches have no schema versioning `medium/low`
Delta-sync means a shape change to `PersistedVenue` never backfills old rows (rows only re-sync when server `updated_at` changes), and the SQLite KV cache hydrates stale-shaped JSON unguarded. Add a `CACHE_SCHEMA_VERSION` inside each persisted envelope; mismatch ⇒ cache miss ⇒ full refetch. Centralize in `cacheUtils.ts`.

### 4.8 Staleness indicators are broken `medium/low`
`MapViewScreen.tsx:107` is literally `const fromCache = false;` so the offline banner (which improvements.md 4.8 marks DONE) can never render. And EventSchedulingScreen replaces a *visible cached list* with a full-screen error when a background refetch fails. Wire `fromCache` to reality, only show the events error state when there's nothing to show, and consider a small global offline banner in the tabs layout.

---

## 5. Architecture & Code Quality

### 5.1 Three competing data-access patterns; the react-query layer is half-adopted `high/high`
The blessed pattern (react-query hook + persistent-cache hydration, e.g. `useLeaderboardQuery`) is used by ~6 screens; 7 screens hand-roll the identical `loadCached → setState → fetch → saveCached` dance; 8 more call services directly with no cache at all. Fully-written hooks `useFriendsQuery`/`usePendingFriendRequestsQuery`/`useProfileQuery` have **zero consumers** — FriendsScreen reimplements exactly what they do. Two invalidation systems (domain caches in services vs query keys in hooks) must be kept in sync by hand and already drift (see 5.2).

**Fix:** Standardize on the `useLeaderboardQuery` pattern and migrate screen-by-screen, starting with FriendsScreen (its hook already exists — just move the requester/addressee normalization into it). Unify invalidation behind one `invalidateDomain(qc, key)` helper.

### 5.2 VenueDetail's favorite toggle bypasses the mutation hook `medium/low`
`handleToggleFavorite` calls services directly and never invalidates `['favorites', userId]` — a favorite toggled from venue detail doesn't appear on the Favorites screen for up to 5 minutes, and silently loses the offline-queue behavior the hook implements. One-screen fix; also audit check-in for the same bypass.

### 5.3 Untyped Supabase client → 209 `any` occurrences `high/medium`
`createClient` lacks the `<Database>` generic; compensations are a hand-written 267-line `src/types/database.ts` (vs 98 migrations), `useState<any[]>` piles, and `.returns<T>()` casts. Run `supabase gen types typescript` into `src/types/supabase.ts`, type the client, re-export legacy names as aliases, regenerate in CI, and turn on `no-explicit-any` as warn to stop growth.

### 5.4 `AdminModerationScreen` is a 1661-line god-file `medium/medium`
Five admin domains + moderator management + a full venue-edit modal in one component with 57 `useState` hooks; its ~22-field venue-edit state duplicates AddVenueScreen's form. Split into per-tab files; extract a shared `VenueFormFields` + `useVenueForm` used by AddVenueScreen, the admin modal, and the change-request modal.

### 5.5 typedRoutes enabled but 51 navigation calls are `as any` casts `medium/low`
Every dynamic navigation uses template-string hrefs cast with `as any` — disabling compile-time route checking exactly where it matters. Replace with the typed object form (`router.push({ pathname: '/(protected)/event/[eventId]', params: {...} })`) and add a lint rule banning the cast.

### 5.6 `Alert.alert` is known-broken on web but used at 82 call sites `medium/medium`
A comment in AdminModerationScreen admits button callbacks don't fire on react-native-web — but the workaround is local; confirm-style dialogs elsewhere silently do nothing on the shipped web target. Create `lib/dialogs.ts` (`showAlert`, `showConfirm → Promise<boolean>`; native Alert / web window.confirm), codemod the call sites, lint-ban direct Alert imports.

### 5.7 ~1.5–2k lines of dead code `medium/low`
Unrouted: the entire activity-feed chain (screen + hook + service + cache — improvements.md 4.1 claims it shipped; it isn't mounted anywhere). Duplicate mocks: `screens/ForgotPasswordScreen.tsx` (static Romanian mock shadowing the real `app/forgot-password.tsx`), `SignupLoginScreen`, `SplashScreen`. Unused: `ShareCard`, `HeaderProfileIcon`, `ProfilePopover`, `lib/perf.ts`; `favoritesCache`'s load/save are never called. Route the feed or delete the chain; delete the rest; add `knip`/`ts-prune` to CI. (Several feature suggestions in `features_suggestions.md` resurrect ShareCard and the feed deliberately.)

### 5.8 `AddressPickerField` platform fork duplicates ~480 lines `medium/medium`
The `.tsx` and `.ios.tsx` variants share ~480 lines of geocoding/search/state logic and have already drifted. Extract a `useAddressPicker` hook + shared `SuggestionsList`; keep only ~100–150 lines of map rendering platform-specific.

### 5.9 Four screens implemented inside `app/` route files `low/low`
`sign-in.tsx` (776 lines), `create-event.tsx` (680), `reset-password.tsx` (556), `forgot-password.tsx` (290) break the 5-line-wrapper convention the other 20+ routes follow — this is what let the dead ForgotPasswordScreen duplicate go unnoticed. Mechanical move to `src/screens/`.

### 5.10 Challenges domain split across four homes `low/low`
`lib/challenges.ts`, `lib/badgeChallenges.ts`, `services/challenges.ts`, and `features/challenges/*` (the only `features/` folder — an abandoned target architecture). Finish the features/ migration for challenges and document the pattern in CLAUDE.md, or dissolve it; don't leave both.

---

## 6. Performance

### 6.1 Map renders every venue as an unclustered marker — clustering silently regressed `high/medium`
`improvements.md` 4.3 marks clustering DONE, but **no file imports `react-native-map-clustering` anymore** (dropped in a rewrite; the dep and its jest mock remain). Vienna already has ~300 venues in scope; the staged Berlin import is 951 in one city — on Android each marker is a live interactive RN view through the MapLibre shim. Guaranteed jank.

**Fix:** The clustering lib can't work through the Android/web shims anyway. Implement clustering app-side with `supercluster` (memoized index, recompute visible clusters in `onRegionChangeComplete` — the shim already translates it), or use MapLibre's native cluster source on Android. Minimum viable: cap rendered markers to the viewport bbox. Either way, remove the dead dep and correct improvements.md.

### 6.2 Every search keystroke re-renders the entire map screen `medium/low`
`searchQuery` lives at screen root; each keystroke reconciles all markers + the list + the sheet (the debounce only stabilizes the filtered array identity). Extract a memoized `VenueMarkers` component (markers arguably shouldn't filter on search text at all — only the list needs it), move the TextInput into a child, derive friend-presence values with `useMemo` instead of the current useEffect→useState copies.

### 6.3 City switch remounts the native MapView via `key` prop `medium/low`
`key={`map-${selectedCity?.id}`}` tears down and recreates the native map (full tile reload) on every city change, while the `animateToRegion` effect right above it already handles the transition correctly. Remove the key.

### 6.4 Events tab: unvirtualized ScrollView with hand-rolled infinite scroll `medium/medium`
`events.map(...)` in a plain ScrollView; the past tab appends pages into one ever-growing array (100+ heavy cards mounted simultaneously); manual `onScroll` re-implements `onEndReached`. Convert to FlashList (already a dep; LeaderboardsScreen shows the pattern); same for Favorites/PlayHistory/Friends if lists exceed ~30 rows.

### 6.5 Events tab force-refetches on every focus and over-fetches `medium/low`
`useFocusEffect → fetchEvents(true)` bypasses the screen's own 60s cache on every Map↔Events toggle; the query is `select('*')` plus an **uncapped** `event_participants(...profiles(...))` embed — an event with 60 participants ships 60 profile rows to draw 5 avatar initials. Pass `force=false` on focus (or migrate to a `useEventsQuery` hook), select explicit columns, cap the embed with `.limit(6, { referencedTable: ... })` + a count aggregate.

### 6.6 Condition-vote photos are broken: local URI stored in DB `medium/low`
ConditionVotingScreen writes the device-local picker URI straight into `condition_votes.photo_url` — never uploaded, dead `file://` path no other device can render. Mirror the change-request flow (`prepareImageForUpload` → rate-limit RPC → Storage upload → public URL). Until then, hide the photo button — it's silently filling the column with useless data.

### 6.7 MapLibre native framework ships in the iOS binary but is unreachable there `medium/low`
Metro resolves the MapLibre shim only on Android, yet the pod autolinks into every IPA (multi-MB dead weight; it's in `Podfile.lock`). Add `'@maplibre/maplibre-react-native': { platforms: { ios: null } }` to `react-native.config.js` (the reciprocal of what's already done for react-native-maps on Android) and verify via Podfile.lock + IPA size delta.

### 6.8 All 8 locale JSONs (~670KB) parse at startup `low/medium`
Eight static imports in I18nProvider; exactly one locale (plus en fallback) is ever read. Keep `en` static; lazy-require the other seven (the selected language is known synchronously from MMKV, so no fallback flash); dynamic `import()` on web for split chunks.

### 6.9 Entering animations re-trigger on list-row remounts `low/low`
`FadeInDown.delay(index*60)` re-runs every time a clipped/recycled row remounts during scroll — rows visibly pop blank then fade. Gate the stagger to the initial reveal; remove entering animations from FlashList rows entirely (recycling makes the semantics wrong).

### 6.10 Synchronous SQLite on the JS thread in the tab-switch path `low/medium`
`offline-cache.ts` uses `openDatabaseSync`/`getFirstSync`; events/friends/profile caches do sync disk reads + JSON parse exactly during tab-switch interactions. Migrate these KV caches to MMKV (the venues path already shows the pattern; mechanical swap behind the same signatures) or switch to the async SQLite API.

---

## 7. UX, i18n & Accessibility

### 7.1 Create-event screen is hardcoded Romanian `high/medium`
~25 hardcoded Romanian strings (title, placeholders, alerts, recurrence options) plus a hardcoded `'ro-RO'` date locale — in a core flow, for an 8-locale app. The file already imports `useI18n` and uses `t()` for visibility options, so it's a partial migration. Extract to en.json keys, translate, use `getDateLocale(lang)` (already imported). Same `'ro-RO'` fix in PlayerProfileScreen's invite picker.

### 7.2 Venues/events can't be shared as openable links `high/medium`
Venue "share" sends name+address text with no URL; events have **no** share action; nothing generates `ttportal://` or web links; no associatedDomains/intentFilters exist — for an app whose mission is sharing where you play, shared content is a dead end. Build `lib/shareLinks.ts` producing web-app URLs, add share to EventDetail, configure universal/app links (dovetails with the planned ttportal.org DNS work). The web build already renders `/venue/[id]` publicly, so links work for non-users immediately.

### 7.3 Push taps drop the eventId; cold-start taps are lost entirely `high/low`
The push tap handler reads only `data.screen` (the inbox already builds `?eventId=` correctly — extract and share that logic); there is no `getLastNotificationResponseAsync` handling, so a push tapped while the app is killed — the most common case — lands on the home tab. Also migration 012 writes `event_id` (snake_case) which no handler reads.

### 7.4 Sign-up discards `returnTo` `medium/low`
Login resumes the interrupted action via `sanitizeRoute(returnTo)`; signup replaces to `/onboarding` without forwarding it, and onboarding always exits to the map. The highest-intent moment in the funnel (anonymous user tries to check in, registers on the spot) ends with the user dropped on the map having to re-find the venue. Thread the param through onboarding's `finish()`.

### 7.5 No plural rules in the i18n system `medium/medium`
`s()` does flat `{0}` substitution; English renders "1 cities", and Polish/Czech (3–4 plural forms) are wrong for most counts — unfixable by translation review because the format can't express plurals. Add an `sn(key, count)` variant using `Intl.PluralRules` (Hermes-supported) resolving `key_one/key_few/key_many/key_other`; migrate the ~10 count keys.

### 7.6 Light-theme `textFaint` fails WCAG at ~2.6:1 in ~140 places `medium/low`
`#9ca39a` on white — below the 3:1 large-text floor, used for 40 input placeholders, 10px inactive tab labels, timestamps. Dark theme passes; this is light-theme-only. One-line token fix (~`#6b736a` ≈ 4.6:1), or split into `textFaint` (decoration) + `textSubtle` (readable text).

### 7.7 Icon-only controls and custom sheets are invisible to screen readers `medium/medium`
Notification bell (no label, badge count unannounced), fullscreen-viewer close, and `DraggableSheet`'s drag handle — the **only** way to resize the venue list — has no accessibility props at all, so VoiceOver users can never expand it. Add labels/roles; give the sheet `accessibilityRole="adjustable"` with increment/decrement actions mapped to snap points; sweep the four prop-less modals.

### 7.8 Map pins encode condition by color only `medium/low`
Good/degraded is a green/red pair — invisible to ~8% of men in a male-skewed sport — and custom markers announce nothing to assistive tech. Add marker accessibility labels (name/type/condition are already computed), enrich list-row labels so the sheet is a complete non-visual alternative, and add a redundant visual cue (glyph or ring pattern) per condition tier.

### 7.9 Unsupported device locales fall back to Romanian `medium/low`
`DEFAULT_LANG = 'ro'`: Hungarian/Dutch/Portuguese/etc. users get a fully Romanian first launch in a 12-country app. Fall back to `en`, or to `ro` only when the device region is RO.

### 7.10 Challenges tab and EventDetail have no refresh mechanism `low/low`
Eight screens establish pull-to-refresh as the convention; these two load only in mount-time `useEffect` — and since the postmortem removed realtime in favor of fetch-on-focus, they have *neither* mechanism. Add RefreshControl + `useFocusEffect`.

---

## 8. Dependencies, Build & Release

### 8.1 Android release builds are debug-signed with versionCode 1 `high/medium`
The only release path (`scripts/build-android.ps1` → prebuild → `assembleRelease`) produces an APK signed with the **debug keystore** (`signingConfig signingConfigs.debug` in the generated gradle) at `versionCode 1` — unuploadable to Play, trivially spoofable, sideload upgrades break across build machines, and Play would reject every build after the first. The distributed alpha APK was verified to be debug-signed. Since `/android` is gitignored, manual gradle fixes are wiped by the next prebuild. `appstore_requirements.md` 7.1 only lists "EAS submit config" — it misses that release signing doesn't exist at all.

**Fix (preferred):** Move release builds to EAS (`eas credentials` keystore, `appVersionSource: remote`, `autoIncrement`), matching the CNG/gitignored-native-dirs decision. Otherwise create a release keystore injected via a config plugin + env vars, and stamp `android.versionCode` from app.json.

### 8.2 No OTA updates while distribution is manual APK sideloading `high/medium`
`expo-updates` is entirely absent. Nearly all churn is JS/TS — every fix could ship OTA in minutes instead of a fresh 164MB APK pass-around; post-store-launch, every i18n tweak otherwise requires full review. Install expo-updates, set `runtimeVersion: { policy: "appVersion" }`, add channels to eas.json. (Depends on 8.3 — the version field must actually be maintained.)

### 8.3 No version source of truth `medium/low`
package.json and app.json both say 1.0.0 (never bumped) while the shipped artifact is `v0.0.7-alpha` — an identity that exists only in a hand-renamed filename; the binary reports 1.0.0. User bug reports can't be correlated to commits. Make `app.json` `expo.version` canonical, set the real version, add `android.versionCode`/`ios.buildNumber`, have the build script read it.

### 8.4 `react-native-map-clustering` is a dead dependency `medium/low`
Zero imports (see 6.1); the dep + jest mock remain and improvements.md misstates the feature as DONE. Uninstall; decide clustering deliberately per 6.1.

### 8.5 The only CI workflow deploys to prod Pages from the feature branch `high/low`
Covered in 3.1 — listed here because it's also a release-process problem: deploy runs even for supabase-only or docs-only changes, and `main` rots. Add `paths-ignore`, gate on CI, move to main.

### 8.6 Web map loads Leaflet from unpkg at runtime, no SRI, no fallback `medium/low`
The web shim injects leaflet@1.9.4 JS/CSS from unpkg with no integrity hashes and a resolve-only promise (load errors never surface) — a supply-chain trust point and single point of failure for the default tab, while the marketing site already consumes leaflet properly via npm. Bundle it (`import L from 'leaflet'`) or add SRI + fallback CDN.

### 8.7 Repo hygiene `medium/low`
A 164MB APK (over GitHub's 100MB push limit — one accidental `git add .` bricks pushes), a 3MB `tables.json`, a screenshot, and scattered ops notes sit in root; `.idea/`, `*.apk`, `supabase/.temp/` aren't gitignored; the dead pre-app static site (`index.html` + `js/` + `css/`) is still tracked; and `.gitignore`'s blanket `scripts/` rule makes the build tooling **silently uncommittable** (same trap hit the OSM apply scripts — see 2.5). Fix .gitignore precisely, move notes to `docs/`, delete the legacy site, commit the ops scripts.

### 8.8 `@types/jest` 30 paired with jest 29 `low/low`
Types track an API the runtime doesn't have. Downgrade to `^29.5.x` until jest-expo supports 30.

---

## 9. Operational & strategic gaps (cross-cutting)

These came from a final completeness review; several overlap with the monitoring plan — flagged where so.

1. **No crash reporting.** No Sentry/Crashlytics anywhere; the only ErrorBoundary renders locally without reporting. Native crashes in the sideloaded alpha are invisible (Grafana covers Edge Functions/synthetics only). Sentry is already planned as monitoring Phase 1 — it should be pulled forward ahead of store launch; it's the single highest-value observability item for a mobile app.
2. **No product analytics funnel.** `trackProductEvent → logger.track` (Grafana) exists for a handful of events, but there's no feature-usage funnel or retention instrumentation — which undercuts both prioritization and the B2B premise (the analytics you plan to sell venues need collection plumbing that doesn't exist yet).
3. **GDPR right-of-access/portability is missing** for an EU app storing location history. Deletion exists; export does not (the "Your Data" settings section with a download-my-data button is specced in mspec §11 but unimplemented), and no migration ever purges old check-ins — indefinite location-history retention with no documented policy. Add export + a retention window (or documented justification) before scale.
4. **Backups are a single stale laptop-local snapshot** (`backups/2026-05-30`, git-ignored, 11 days old at analysis time) with a good runbook but no schedule, no offsite copy, no PITR on the free plan. A scheduled GitHub Action running `supabase db dump` to encrypted storage would close this cheaply.
5. **No user-facing privacy controls.** No check-in visibility setting, no "invisible mode" — and findings 1.2/1.3 show presence already leaks more than intended. Any of the social features on the roadmap (and in `features_suggestions.md`) will expand exposure; build the visibility-preference primitive first.
6. **Support/feedback discoverability.** In-app feedback exists (header chat button → admin inbox with replies) but there's no entry in Settings and no support email/page link — and App Store review expects a support path (the ttportal.org/support page is already on the appstore remaining list). Add a Settings row pointing at the existing feedback modal + support contact.
7. **No notification preference center.** One toggle exists (friend check-ins); everything else (event updates, reviews, reminders) is all-or-nothing at the OS level — a retention and ePrivacy weak spot that gets worse with every new trigger. Add per-category toggles consulted by the trigger fan-out.
8. **No cost/egress guardrail despite a real incident.** The 6.22GB realtime overage happened with 3–4 users; current Grafana alerts cover edge errors/uptime only. The daily egress check with day-over-day alerting is already specced (monitoring Phase 5) — implement it before the OSM import multiplies data volume.
9. **Auth email production-readiness unverified.** `supabase/config.toml` shows no SMTP config, suggesting password resets ride Supabase's default ~2-emails/hour sender — a launch blocker at any real signup volume. Verify the cloud setting; configure a real SMTP provider before launch.
10. **Trust & safety won't scale with planned social features.** Report/block exists, but there's no automated content filtering, no abuse audit trail, and moderation lives in one 1661-line screen. Fine today; inadequate if DMs/photo moments/venue boards ship (see features doc — each proposal there includes its moderation hooks for this reason).

---

## Suggested sequencing

1. **Week 1 — stop the bleeding (all `high/low`):** 1.1, 1.2, 3.1 (CI gate + fix 2 tests), 4.1, 4.2, 7.3, 8.5. Each is roughly a day or less.
2. **Next — security/privacy batch as one migration series:** 1.3–1.8, with the pgTAP harness from 3.2 landing alongside so RLS changes get regression tests.
3. **Then — restore-correctness:** 2.1, 2.2, 2.5 (one focused effort: replayable chain + drift diff + committed ops scripts), and 8.1–8.3 (signing/versioning/OTA) before any store submission.
4. **Ongoing — architecture and performance debt:** 5.1/5.3 as a rolling screen-by-screen migration; 6.1 (clustering) before the Berlin-scale imports go live; 7.1/7.2 before marketing outside Romania.
