# Performance Improvement Report — 2026-04-26

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
