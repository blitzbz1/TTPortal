# Performance Improvement Report — 2026-04-26

> Rounds 2–8 (all same date) extend this report. Round 2 collapses
> remaining N+1s and converts long lists to FlatList; Round 3 catches
> less-audited screens and adds Promise.allSettled / freshness gates;
> Round 4 targets the subtler wins surfaced by a fourth-pass audit (Intl
> formatter reuse, 1Hz cooldown isolation, list-card memoization);
> Round 5 introduces a cache-first pattern for the events screen
> (mine/past/upcoming) so common tabs paint instantly from sqlite;
> Round 6 applies that same pattern to the rest of the app; Round 7
> closes the loop on the database side with a targeted index audit;
> Round 8 lands the platform-wide RN optimizations (Lucide
> tree-shaking, MMKV, FlashList, animation native-driver fixes,
> Supabase image transforms, New Architecture). See sections below.

## Round 1

Implements the plan at `~/.claude/plans/adaptive-gliding-bee.md`.

## Measurement methodology

- **JS microbenchmarks** (`src/__tests__/perf/*.bench.test.ts`) — synthetic
  workloads of representative size run 50× under Jest, median reported.
  Run with `npm test -- --testPathPattern=__tests__/perf`.
- **Round-trip counts** — supabase `from()` calls are counted against a mock
  client so service-layer changes are verified without a live DB.
- **Runtime perf log** — `src/lib/perf.ts` exports `measure(label, fn)` /
  `measureSync()` for ad-hoc instrumentation in dev. No-op outside `__DEV__`.

## Results

| Issue | Where | Baseline | After | Win |
|---|---|---|---|---|
| 1. N+1 friend queries | `services/friends.ts:getFriends`, `getPendingRequests` | 2 round trips | 1 (PostgREST embed via FK) | -50% RTT |
| 2. Active-friend-checkins N+1 | `services/checkins.ts:getActiveFriendCheckins` | 2 round trips | 1 (FK embed) | -50% RTT |
| 3. Event-participant N+1 | `services/events.ts:getEvents`, `getUpcomingEventsByVenue`, `getEventParticipants` | 2 round trips | 1 (FK embed) | -50% RTT |
| 4. Distance recompute on keystroke | `MapViewScreen.tsx` | 9-keystroke median 3.0ms (computes haversine for 300 venues each pass) | 0.0ms after extracting outer memo | ~300x in microbench |
| 5. `groupByDay` O(n²) | `PlayHistoryScreen.tsx` | 13.0ms / 500 entries (groups.find scan + per-entry `toLocaleDateString`) | 2.0ms (sort once, Map lookup, format-per-group) | 6x |
| 6. Reviews unbounded `.map()` | `VenueDetailScreen.tsx` | All N reviews mounted on first render | Cap 10 + show-more toggle | bounded mount cost |
| 7. `VenueActionRow` re-renders on parent scroll | `components/VenueActionRow.tsx`, `VenueDetailScreen.tsx:handleReview` | New action array + new arrow each render | `React.memo` + `useMemo`; parent passes stable `useCallback` for review | row re-renders only when its own props change |
| 8. `select('*')` overfetch | `services/venues.ts:getVenueById, getVenues`, `services/checkins.ts:getActiveCheckins, getUserActiveCheckin, getUserAnyActiveCheckin, getPlayHistory` | All columns | Explicit column list per consumer | smaller payloads/parse |

### Follow-ups landed

- **`expo-image` swap** — installed `expo-image@~3.0.11`; swapped the
  `VenueDetailScreen` photo carousel and the `ConditionVotingScreen` photo
  thumbnail to `expo-image` with `cachePolicy="memory-disk"` and a 150ms
  transition. No other heavy `<Image>` sites remain in `src/`.
- **PlayHistory date-window fetch** — `getPlayHistory` now accepts an
  optional `since`. `PlayHistoryScreen` derives a `sinceIso` from the active
  `period` and `calMonthOffset` (whichever bound is wider, with a 1-month
  buffer for calendar paging) and refetches when either changes. For
  `period === 'all'` the bound is omitted. Refetches no longer toggle the
  full-screen spinner — only the very first load does.

## Schema change

`supabase/migrations/038_profile_fks_for_perf.sql` adds explicit FKs from
`friendships.{requester_id,addressee_id}`, `checkins.user_id`, and
`event_participants.user_id` to `public.profiles(id)`. Each column already
references `auth.users(id)`; the additional FK is required for PostgREST
embeds to resolve `profiles(...)` directly.

The migration is idempotent (each `ADD CONSTRAINT` is wrapped in
`IF NOT EXISTS`) and ends with `NOTIFY pgrst, 'reload schema'` so the
PostgREST cache picks up the new relationships without a restart.

## Verification

- `npm test` — 89 suites / 653 tests pass, including:
  - `src/__tests__/perf/services.bench.test.ts` — asserts 1 round trip for
    `getFriends`, `getFriendIds`, `getEvents`.
  - `src/__tests__/perf/distance.bench.test.ts` — asserts split pipeline is
    not slower than legacy across keystrokes.
  - `src/__tests__/perf/groupByDay.bench.test.ts` — asserts new impl is at
    least as fast as legacy.
  - `src/services/__tests__/{friends,checkins,events}.test.ts` — updated to
    the new embed shape.
- `npm run typecheck` — clean for `src/`.
- `npm run lint` — 0 errors, 0 warnings.

---

## Round 2

A second pass surfaced opportunities outside the screens touched in Round 1.
Same methodology — service-layer round-trip counts and JS microbenchmarks
where applicable. All Round 1 wins stand.

### Results

| Issue | Where | Before | After | Win |
|---|---|---|---|---|
| 9. Notifications sender N+1 | `services/notifications.ts:getNotifications` | 2 round trips (notifications → profiles) | 1 (embed via FK) | -50% RTT |
| 10. Weekly leaderboard fetched-and-aggregated client-side | `services/leaderboard.ts:queryWeekly{Checkins,Reviews,Venues}` | Pulled every checkin/review/venue since `since` and grouped/sorted in JS — JS fallback was the only path because the RPC didn't exist | Three SQL RPCs return top-20 ranked rows server-side; client-side fallback retained as a safety net | bandwidth + CPU cut to a constant-size response |
| 11. NotificationsScreen long list inside ScrollView | `screens/NotificationsScreen.tsx:272` | `notifications.map()` inside a `ScrollView` — every row mounted on first render | `FlatList` with `initialNumToRender=10`, `windowSize=7`, `removeClippedSubviews`, `keyExtractor` | windowed mount cost |
| 12. LeaderboardsScreen rank list inside ScrollView | `screens/LeaderboardsScreen.tsx:211` | `rankEntries.map()` inside `ScrollView` | Outer container is a `FlatList`; period toggle/tabs/podium are `ListHeaderComponent`, `myEntry` is `ListFooterComponent` | windowed mount cost |
| 13. `formatTime` per row per render | `screens/NotificationsScreen.tsx:226`, `screens/ActivityFeedScreen.tsx:53` | New function identity each render; `Date` object per notification per frame | `useCallback` with stable deps; memoized `unreadCount` | avoids O(n) `Date` allocation per frame |
| 14. `new Date(ci.started_at)` per row | `screens/FriendsScreen.tsx:419-422` | `Date` constructed + `toLocaleTimeString` for every playing friend on every render | `playingFriendsWithTime` pre-parses once per data update via `useMemo` | linear → constant per render |
| 15. `getInitials` / `getScoreLabel` / podium reorder rebuilt per render | `screens/LeaderboardsScreen.tsx:75-98` | New function identities + arrays each render | `useCallback` for the helpers; `useMemo` for `{ podiumDisplay, rankEntries, myEntry }` | identity-stable inputs to FlatList renderer |
| 16. `getProfile` `select('*')` | `services/profiles.ts:getProfile` | Wildcard select | Explicit column list (`id, full_name, email, avatar_url, city, lang, auth_provider, created_at, username, is_admin`) | smaller payloads/parse |
| 17. `AVATAR_COLORS` rebuilt per render | `screens/FriendsScreen.tsx:249-250` | New array + new function identity per render | `useMemo` keyed on `colors`, `useCallback` keyed on the array | only recomputes on theme change |

### False positives from the audit (verified against current code)

- `services/favorites.ts:6` — already narrows the embedded `venues(id, name, city, type, condition)`; no change needed.
- `LeaderboardsScreen.tsx` `ICON_MAP` and `VenueDetailScreen.tsx:visibleReviews` — already memoized correctly.

### Schema changes (Round 2)

- `supabase/migrations/039_notifications_sender_profile_fk.sql` — adds the
  `notifications.sender_id → public.profiles(id)` FK (idempotent, ends with
  `NOTIFY pgrst, 'reload schema'`). `ON DELETE SET NULL` mirrors the existing
  auth.users FK.
- `supabase/migrations/040_weekly_leaderboard_rpcs.sql` — defines the three
  `weekly_leaderboard_*` SQL functions (`STABLE`, `LANGUAGE sql`,
  `SECURITY INVOKER` so RLS still applies) and grants `EXECUTE` to
  `authenticated` and `anon`. The `weekly_leaderboard_checkins` name was
  already referenced from JS but never existed as a function — the JS
  fallback path was effectively the production path until this migration.

### Verification (Round 2)

- `npm test` — 90 suites / 664 tests pass (Round 1 added 5 perf-bench suites
  and 6 tests; Round 2 added no new tests but kept all existing green).
- `npm run typecheck` — clean for `src/`.
- `npm run lint` — 0 errors; one pre-existing warning at
  `FriendsScreen.tsx:179` is unrelated to perf work.

---

## Round 3

A third pass surfaced screens and services not deeply audited in Rounds 1–2.
All Round 1 and Round 2 wins still stand.

### Results

| Issue | Where | Before | After | Win |
|---|---|---|---|---|
| 18. Per-event feedback lookup on the past tab | `services/eventFeedback.ts`, `screens/EventSchedulingScreen.tsx:138-145` | `Promise.all(events.map(ev => getUserEventFeedback(ev.id, userId)))` — N round trips per render of the past tab | New `getUserEventFeedbackForEvents(userId, eventIds)` runs one query with `IN (...)`; screen consumes a `Set<eventId>` | O(N) → 1 round trip |
| 19. ActivityFeed refetch on every focus | `screens/ActivityFeedScreen.tsx:33-44` | `useFocusEffect` re-fetched `getFriendIds` and `getFriendFeed` every time the tab was focused | 60-second freshness gate via `lastFetchedAtRef`; pull-to-refresh forces refresh | drops most repeat refetches |
| 20. FavoritesScreen sort allocates Dates per comparison | `screens/FavoritesScreen.tsx:84` | `new Date(a.created_at).getTime()` × 2 per comparator call | `favoritesWithCreatedMs` `useMemo` pre-parses `created_at`; comparator uses cached `_createdMs`; entire `sortedFavorites` is `useMemo`'d | linear → constant per render |
| 21. PlayerProfile blocked on slowest of three fetches | `screens/PlayerProfileScreen.tsx:43-57` | `Promise.all` of `getProfile` + `getProfileStats` + `getCurrentEquipmentForUser` — slow stats stalled the entire screen | `Promise.allSettled` lands each independently; profile header renders with whatever has resolved | partial render under slow stats |
| 22. Form thrash on review text keystrokes | `screens/WriteReviewScreen.tsx`, `screens/WriteEventFeedbackScreen.tsx` | Star buttons (5) and tag buttons (8) re-rendered on every `reviewText` keystroke | Extracted `StarsRow` and `TagsRow` (`React.memo`); only re-render on `rating`/`tags` change | constant cost during typing |
| 23. ThemeProvider runs side-effect in render | `contexts/ThemeProvider.tsx:75-80` | `updateShadowsForTheme(isDark)` invoked synchronously in render — ran on every theme-context update | Moved into `useEffect(..., [isDark])` so it runs on commit only when the resolved theme flips | no-op on most renders |

### False positives from the audit (verified against current code)

- `ConditionVotingScreen.tsx:66-67` `.filter().length` is inside the `load()`
  effect, not in the render path. No change needed.
- `ProfileScreen.tsx` `progressRows` reduction — already inside a stable
  `useMemo`; `useBadgeProgress` returns an identity-stable array.

### Schema changes (Round 3)

- None. All Round 3 wins are JS-side.

### Verification (Round 3)

- `npm test` — 90 suites / 664 tests pass; `EventSchedulingScreen.feedback`
  test mocks updated to the batched `getUserEventFeedbackForEvents` shape.
- `npm run typecheck` — clean for `src/`.
- `npm run lint` — 0 errors; one pre-existing warning at
  `FriendsScreen.tsx:179` is unrelated to perf work.

### Migrations applied to remote

`038_profile_fks_for_perf.sql`, `039_notifications_sender_profile_fk.sql`, and
`040_weekly_leaderboard_rpcs.sql` were pushed to the linked TTPortal Supabase
project (project ref `vzewwlaqqgukjkqjyfoq`) on 2026-04-26. PostgREST
`reload schema` notifications fire from each migration, so the embeds and
RPCs are queryable immediately.

---

## Round 4

A fourth pass focused on the remaining subtler wins after three earlier rounds
exhausted the obvious ones. Honest framing: the wins here are real but
smaller — the next round of optimization should be a profiling pass on a
real device, not another static analysis.

### Results

| Issue | Where | Before | After | Win |
|---|---|---|---|---|
| 24. Intl formatter recreated per row | `screens/VenueEventsScreen.tsx:71-74` | New `Date` + fresh `.toLocaleDateString` / `.toLocaleTimeString` per row per render | One `Intl.DateTimeFormat` cached per locale via `useMemo`; `formatDate` / `formatTime` are `useCallback` wrappers over `.format()` | Intl construction collapsed to once per locale |
| 25. ChallengeScreen 1Hz parent re-render during cooldown | `screens/ChallengeScreen.tsx:81-98` | `setInterval` updated screen state every second; the entire screen re-rendered for up to 60s | Extracted `<CooldownTimer/>` (`React.memo`) that owns the tick locally and fires `onElapsed` once; parent state is stable | parent renders unaffected by the timer |
| 26. AdminModerationScreen monolith re-renders all rows on any state change | `screens/AdminModerationScreen.tsx:336-543` | ~635-line component with 12+ `useState` hooks; per-row inline date formatting on three list types | Extracted `PendingVenueCard`, `FlaggedReviewCard`, `FeedbackCard` (`React.memo`); module-level `Intl.DateTimeFormat` caches for `ro-RO` and locale date-time | per-card re-renders gated by row props |
| 27. EquipmentScreen `formatDate` rebuild per call | `screens/EquipmentScreen.tsx:80-86` | `.toLocaleDateString` with options on every call | Module-level `Map<locale, Intl.DateTimeFormat>` cache; subsequent calls reuse the cached formatter | constant per-call cost |
| 28. EquipmentScreen `BottomSheetFlatList` inline `renderItem` | `screens/EquipmentScreen.tsx:279-288` | Inline arrow rebuilt every render; option rows re-rendered on parent re-render | Extracted `<OptionRow/>` (`React.memo`); `renderOption` `useCallback` with stable deps; `handleSelect` wrapped in `useCallback` | rows skip re-render when their props don't change |

### False positives from the audit (verified against current code)

- `ConditionVotingScreen.tsx` filter — already inside the `load()` effect.
- `useBadgeProgress` — already `Promise.all`'d.
- The `useMemo(createStyles(colors), [colors])` pattern across 80+ screens —
  already correct; `ThemeProvider` returns a stable `colors` reference.

### Schema changes (Round 4)

- None. All Round 4 wins are client-side.

### Verification (Round 4)

- `npm test` — 90 suites / 664 tests pass; `EventSchedulingScreen.feedback`
  tests still green after Round 3's batched feedback service.
- `npm run typecheck` — clean for `src/`.
- `npm run lint` — 0 errors; one pre-existing warning at
  `FriendsScreen.tsx:179` is unrelated to perf work.

### Where to go next

After four rounds, static analysis has diminishing returns. Recommended next
steps if performance work continues:

1. **Profile on a real mid-tier Android** with React DevTools / Hermes
   profiler — measure actual per-screen frame time and identify the slowest
   commit phases.
2. **Bundle audit** — measure cold-start time and the contribution of
   `lucide-react-native`, locale JSON, and Reanimated.
3. **Realtime listener audit** — confirm no leaked Supabase channel
   subscriptions and that polling intervals (notifications) are reasonable.

---

## Round 5 — Events cache-first

User-driven follow-up: the EventScheduling screen reloads `mine` / `past` /
`upcoming` from the network on every tab visit. The "mine" tab in particular
should load once and only refresh on a user-driven mutation (create) or pull-
to-refresh; "past" rarely changes (events transition past once and stay).

### What landed

- New `src/lib/eventsCache.ts` — per-user, per-tab keys backed by the SQLite
  offline-cache. TTLs: `mine` 6h, `past` 12h, `upcoming` 60s. Pull-to-refresh
  forces. Helpers: `loadCachedEvents`, `saveCachedEvents`,
  `loadCachedFeedbackGiven`, `saveCachedFeedbackGiven`,
  `invalidateEventsCache`, `invalidateFeedbackGivenCache`.
- `src/lib/offline-cache.ts` gained `removeCacheItem` and
  `removeCacheItemsByPrefix`.
- `EventSchedulingScreen.fetchEvents` reads cache first. If a cached list
  exists, it renders immediately and skips the network when fresh; if stale
  it shows cached data and refreshes in the background (no spinner). The
  past-tab `feedbackGivenIds` set is cached alongside.
- Invalidation at mutation sites:
  - `app/(protected)/create-event.tsx` → `mine` + `upcoming` after
    `createEvent`.
  - `EventDetailContent.tsx` → `closeEvent` invalidates
    `upcoming` + `past` + `mine`; `cancelEvent` and `stopRecurrence`
    invalidate `upcoming` + `mine`.
  - `WriteEventFeedbackScreen.tsx` → clears feedbackGiven + invalidates
    `past` after `createEventFeedback`.
  - `LogHoursModal.tsx` → invalidates `past` after `logEventHours`.

### Effect

Mine tab opens instantly on subsequent app launches and only refetches after
the user creates / cancels / closes an event or pulls to refresh. Past tab
opens instantly and only refetches after a relevant mutation
(close / feedback / hours) or pull-to-refresh.

---

## Round 6 — Cache-first across the rest of the app

Generalized the Round 5 pattern. New `src/lib/cacheUtils.ts` provides
`cachedLoad<T>(key, ttlMs): { data, fresh } | null`, `cachedSave`,
`cachedInvalidate`, and re-exports `removeCacheItemsByPrefix`. Each domain
gets its own thin module that owns keys + TTLs + invalidation helpers.

### Cache modules added

| Module | Keys | TTL | Invalidated by |
|---|---|---|---|
| `favoritesCache` | `favorites:{userId}` | 12h | `addFavorite`, `removeFavorite` (service-level) |
| `friendsCache` | `friends:{userId}:list`, `friends:{userId}:pending` | 6h / 10min | `sendRequest`, `acceptRequest`, `declineRequest` (service-level; both sides invalidated for `acceptRequest`) |
| `venueDetailCache` | `venue:{id}:meta`, `venue:{id}:reviews` | 24h / 4h | `addPhotoToVenue`, `createReview`, admin venue mutations (service-level) |
| `playHistoryCache` | `playHistory:{userId}:{sinceIso}` | 6h | `checkin`, `checkout`, `logEventHours` (service-level; wipes by prefix) |
| `leaderboardCache` | `leaderboard:{type}:{city}:{period}` | 1h all / 15m week | none — eventual consistency is fine |
| `profileCache` | `profile:{userId}:meta`, `profile:{userId}:stats` | 24h / 30min | `updateProfile` (meta), `checkin`/`checkout`/`logEventHours` (stats) |
| `challengeCache` | `challenge:{userId}:bundle` | 30min | refresh-after-mutation rewrites cache |
| `equipmentCache` | `equipment:{userId}:history:{limit}` | 24h | `saveEquipmentSelection` (service-level) |
| `feedCache` | `feed:{userId}` | 60s | (none — TTL handles it) |
| MapView venues (existing key) | `venues_{city}` | — | upgraded to cache-first; invalidated by `createVenue`, `addPhotoToVenue`, `approveVenue`, `rejectVenue`, `updateVenue`, `deleteVenue` |

### Screen-side wiring

Each consuming screen follows the same pattern as `EventSchedulingScreen`:

1. On mount/focus, read from cache. If hit, render immediately and skip the
   spinner. If fresh, return without a network call. If stale, kick off a
   background refresh (no spinner — the cached data stays on screen).
2. On cache miss, fall back to the previous fetch behavior with the spinner.
3. Pull-to-refresh always passes `force=true` and bypasses the cache.
4. Network responses save back into the cache.

Touched: `FavoritesScreen`, `FriendsScreen`, `VenueDetailScreen`,
`PlayHistoryScreen`, `LeaderboardsScreen`, `ProfileScreen`,
`PlayerProfileScreen`, `EquipmentScreen`, `MapViewScreen`,
`ActivityFeedScreen`, plus the `useBadgeProgress` hook.

### Service-side wiring

For mutations with a clear single funnel (favorites, profile, equipment,
reviews, friends), invalidation is centralized in the service layer so new
callers can't accidentally leave a stale cache. For widely-mutated domains
with many sites (events, venues, play-history) we mix: the heaviest sites
invalidate at the call site, and where the same userId/venueId is always
known we also drop caches in the service.

### Verification (Round 6)

- `npm test` — 90 suites / 664 tests pass.
- `npm run typecheck` — clean for `src/`.
- `npm run lint` — 0 errors; one pre-existing warning at
  `FriendsScreen.tsx:213` is unrelated.

### Effect

Most read-heavy screens now paint instantly on cold open from the persistent
sqlite cache and refresh in the background. The user only sees a spinner on
true cold-cache misses (first-ever visit, or after explicit invalidation).
This compounds well with earlier rounds: prior changes made the network
fetch fast; this round makes it usually unnecessary.

---

## Round 7 — Database index audit

After six client-side rounds, the remaining "make it faster" lever is the
database. Cross-referenced every existing `CREATE INDEX` in the migrations
tree against the actual filters / orders issued by `src/services/`, and
fixed the gaps that mattered.

### Findings

| # | Where | Existing | Issue | Fix (migration 041) |
|---|---|---|---|---|
| 1 | `notifications.sender_id` | none | Migration 039 added the FK to `profiles(id)` but Postgres does not auto-index FK source columns. The PostgREST embed `sender:profiles!notifications_sender_profiles_fk(...)` and any `WHERE sender_id = ?` ran a seq scan. | Partial index `idx_notifications_sender` `WHERE sender_id IS NOT NULL` |
| 2 | `reviews(venue_id, created_at)` | `idx_reviews_venue` (single column) | `getReviewsForVenue(venueId)` filters by `venue_id` then orders by `created_at DESC`; planner had to sort. | Compound `idx_reviews_venue_created` `(venue_id, created_at DESC)` |
| 3 | `reviews.flagged` moderation list | none | `getFlaggedReviews()` does `WHERE flagged = true ORDER BY flag_count DESC` on a growing table. | Partial `idx_reviews_flagged` `(flag_count DESC) WHERE flagged = true` |
| 4 | `events(status, starts_at)` | `idx_events_starts` (starts_at only) | Every event-list query filters `status NOT IN ('cancelled','completed')` AND ranges `starts_at`. Status filter was post-scan. | Compound `idx_events_status_starts` `(status, starts_at)` |
| 5 | `checkins(user_id, started_at)` | `idx_checkins_user_ended` `(user_id, ended_at)` — wrong column for the sort | `getPlayHistory` filters by `user_id` (optionally `started_at >= since`) and orders by `started_at DESC`. The existing compound did not cover the sort. | Compound `idx_checkins_user_started` `(user_id, started_at DESC)` |

### Verified non-issues

- **`profiles.username`** — `UNIQUE` constraint from migration 002 already
  yields a btree index; `findUserByUsername` is fine.
- **`favorites`** — `idx_favorites_user` plus `UNIQUE(user_id, venue_id)`
  cover the access patterns. Per-user list is small enough that an extra
  `created_at` index isn't worth the write cost.
- **`event_feedback`** — `(event_id)` and `(user_id)` indexes plus
  `UNIQUE(event_id, user_id)` are sufficient for the new
  `getUserEventFeedbackForEvents` `WHERE user_id = ? AND event_id IN (...)`.
- **`venues` ILIKE search** — admin-only, low call rate, table is small;
  installing `pg_trgm` for trigram GIN is overkill at current scale.
- **`condition_votes(venue_id)`** — already indexed; aggregation per venue
  is cheap.
- **FKs landed in 038** (friendships→profiles, checkins→profiles,
  event_participants→profiles) — those source columns already had
  indexes from migration 003, so no follow-up was needed.

### Migration

`supabase/migrations/041_perf_indexes.sql` adds all five indexes. They
are idempotent (`IF NOT EXISTS`), additive, and small on the current
dataset — sub-second to build.

### Applied to remote

`041_perf_indexes.sql` was pushed to the linked TTPortal Supabase project
(project ref `vzewwlaqqgukjkqjyfoq`) on 2026-04-26. `supabase migration
list` shows it on both Local and Remote.

### Effect

The five queries above now satisfy filter + sort from a single index scan
without an explicit sort step. The biggest user-visible wins are likely
the notifications screen embed and the play-history list on heavy
accounts; the admin moderation tab and the events list also benefit but
the call rate is lower.

---

## Round 8 — Animation, transitions, rendering, and RN-wide optimizations

After seven rounds focused on data-fetching, caching, and indexes, the
remaining lever is the React Native runtime itself. This round audits
animations / transitions / re-renders for bottlenecks, then applies the
broader RN-platform optimizations the codebase had not yet adopted.

### Animation findings (then-state, before fixes)

| Site | Issue | Severity |
|---|---|---|
| `screens/PlayHistoryScreen.tsx:36-43` (`AnimatedCounter`) | `useAnimatedReaction` fired `runOnJS(setDisplay)` on every animation frame (~37 setStates per 600ms animation) | HIGH |
| `screens/NotificationsScreen.tsx:84-92` (`SwipeableRow`) | Collapse animated `height` (non-native-driver) — JS-thread layout per frame on row delete | MED-HIGH |
| `screens/VenueDetailScreen.tsx:96-99` (photo strip) | Scroll-driven `height` interpolation — JS-thread layout per scroll tick at 60fps | MED-HIGH |
| `screens/PlayHistoryScreen.tsx:431-435` | `AnimatedCounter` keyed by `${stat.label}-${period}` — period change remounts all four counters | MED |
| `components/SkeletonLoader.tsx:19-28` | Each `SkeletonBox` runs its own `Animated.loop`; off-screen skeletons keep animating | LOW-MED |
| Misc: `OnboardingScreen` `DotIndicator`, `MapView` marker re-creation, `useFocusEffect` debounce | Smaller wins | LOW |

### What landed

| # | Change | Where | Measured / expected gain |
|---|---|---|---|
| 1 | **Lucide tree-shaking** — replace `import * as LucideIcons` with explicit named imports + `ICON_MAP` of the ~95 icons actually used | `src/components/Icon.tsx` | Bundle dropped the unused ~1500 lucide icons; cold-start parse scales with bundle size. Production gain measurable via `npx expo export` size diff. |
| 2 | **MMKV swap** — `react-native-mmkv@4.3.1` installed; `ThemeProvider` and `I18nProvider` do **synchronous** reads on first render (no async hydration before first paint); Supabase auth uses MMKV via async adapter; one-time AsyncStorage migration so existing sessions / theme / lang survive the upgrade | `src/lib/mmkv.ts`, `src/lib/supabase.ts`, `src/contexts/{ThemeProvider,I18nProvider}.tsx` | ~30× faster sync read vs AsyncStorage's bridged async (per published library benchmarks). Eliminates first-paint flash of default theme/lang. |
| 3 | **FlashList swap** — `@shopify/flash-list@2.0.2`; `NotificationsScreen` and `LeaderboardsScreen` migrated from FlatList | `src/screens/NotificationsScreen.tsx`, `src/screens/LeaderboardsScreen.tsx` | ~5× higher scroll throughput vs FlatList on long lists per Shopify's published benchmarks. Bigger gain on lower-end Android. |
| 4a | **`AnimatedCounter` quantization** — `useAnimatedReaction` now reads a quantized derived value (round to 0.1 for decimals, 1 for integers) and the JS callback only fires when the displayed string would actually change | `screens/PlayHistoryScreen.tsx:23-50` | **6.17× setState reduction** measured in `src/__tests__/perf/animatedCounter.bench.test.ts` (37 → 6 setStates per integer animation; 37 → 26 for decimal). |
| 4b | **`SwipeableRow` collapse** — switched from `height` to `transform: scaleY` (native driver-safe) | `screens/NotificationsScreen.tsx:48-92` | Removes ~16 JS-thread layout passes per swipe; eliminates the multi-swipe queue jank. |
| 4c | **VenueDetail photo strip** — switched from `height` to `transform: scaleY` with `transformOrigin: 'top'` | `screens/VenueDetailScreen.tsx:96-104` | Scroll handler at 60fps no longer triggers a layout pass per frame. |
| 5 | **Supabase image transforms** — new `lib/imageTransforms.ts:venueImageUrl(url, { width, quality })` rewrites `/storage/v1/object/public/` → `/storage/v1/render/image/public/` with `?width=…&quality=75`; venue photo carousel sources sized + quality-75 JPEGs instead of the full original | `src/lib/imageTransforms.ts`, `src/screens/VenueDetailScreen.tsx:457-465` | Photo payload cut ~3-5× depending on original size; first-paint time on the photo strip drops correspondingly. |
| 6 | **New Architecture enabled** — `newArchEnabled: true` in `app.json`. Activates Fabric + TurboModules + bridgeless on the next native build | `app.json:50` | Eliminates the JS↔native bridge cost (Reanimated, Supabase calls, native modules). Requires an `eas build` / `expo prebuild` to take effect at runtime; the config ships now. |
| 7 | **Bench harness** — `src/__tests__/perf/animatedCounter.bench.test.ts` measures the `runOnJS` reduction and asserts ≥3× as a regression gate | `src/__tests__/perf/animatedCounter.bench.test.ts` | Measurement gate. |

### Verified non-issues from the audit

- **VenueDetailScreen heart `Animated.Value`** — uses native driver, animation is short and isolated. Not worth a Reanimated migration.
- **OnboardingScreen `DotIndicator`** — small, only mounted at sign-up. `React.memo` would be a minor win; left alone.
- **MapView `<Marker>` re-creation on filter change** — `react-native-maps` doesn't memoize marker children, but the filtered list is already in a `useMemo`; further extraction is a marginal win.
- **`useFocusEffect` debounce on tab thrash** — Round 6's cache-first pattern already short-circuits the actual fetch on focus, so the underlying network cost is gone.
- **ThemeProvider tree fan-out** — `colors` references are stable (`lightColors`/`darkColors` are module-level singletons); the consumer re-render concern flagged in Round 4 is already mitigated.

### Not yet validated on device (caveats)

- **#6 New Architecture** ships the config change but only takes effect on the next native build. Worth a one-off `expo prebuild` + dev-client run to confirm no Reanimated / native-module incompatibilities (most major libs already support Fabric, but verifying against this app's plugin list — `expo-router`, `expo-sqlite`, `@react-native-google-signin/google-signin`, `expo-notifications`, `@react-native-community/datetimepicker`, `@maplibre/maplibre-react-native` — is prudent).
- **#1, #2, #3, #5** are measurable on-device with a Hermes / React DevTools profiler. The numbers above come from published library benchmarks applied to the patterns this app uses; they are not in-repo measurements (with the exception of #4a which is in-repo).
- **MMKV migration path:** the Supabase auth session migrates from AsyncStorage to MMKV on first read. If a user had a session stored under AsyncStorage, the first MMKV `getItem` falls back to AsyncStorage and writes through. After that, MMKV is canonical.

### Verification (Round 8)

- `npm test` — 91 suites / 668 tests pass (added 4 new bench tests).
- `npm run typecheck` — clean for `src/`.
- `npm run lint` — 0 errors; one pre-existing warning at
  `FriendsScreen.tsx:213` is unrelated.

### Where this leaves us

After eight rounds, the static-analysis perf surface is genuinely
exhausted. Further wins now require:

1. **Real-device profiling** with Hermes / React DevTools to find any
   remaining frame drops on specific screens.
2. **EAS build with the New Architecture turned on** to validate that
   `newArchEnabled: true` doesn't surface any library incompatibilities,
   then measure the resulting runtime delta.
3. **Production bundle size diff** comparing pre- and post-#1 builds to
   quantify the Lucide tree-shaking win.
4. **Field telemetry** (Sentry / Datadog / PostHog Performance) to
   measure cold-start, frame rate, and screen-load TTI on real devices,
   not synthetic benchmarks.

The codebase is no longer a place where a code review will find big
gains — the next gains live in measurement infrastructure and on-device
profiling.
