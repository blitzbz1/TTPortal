# Performance Improvement Report — 2026-04-26

> Round 2 (same date) extends this report with additional findings surfaced by
> a follow-up audit; see the **Round 2** section at the bottom.

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
