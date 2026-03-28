# TTPortal - Technical Documentation

TTPortal is a cross-platform mobile and web application for discovering, reviewing, and organizing table tennis venues across Romania. Built with React Native and Expo, it runs natively on iOS, Android, and the web from a single codebase.

## Table of Contents

- [Technology Stack](#technology-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Routing & Navigation](#routing--navigation)
- [Authentication](#authentication)
- [Database Schema](#database-schema)
- [Data Access Layer](#data-access-layer)
- [State Management](#state-management)
- [Internationalization](#internationalization)
- [Notifications](#notifications)
- [Map Integration](#map-integration)
- [Design System](#design-system)
- [Testing](#testing)
- [CI/CD & Deployment](#cicd--deployment)
- [Development Setup](#development-setup)
- [Commands Reference](#commands-reference)

---

## Technology Stack

| Layer | Technology | Version | Docs |
|-------|-----------|---------|------|
| **Framework** | [React Native](https://reactnative.dev/) | 0.81.5 | [Docs](https://reactnative.dev/docs/getting-started) |
| **Platform** | [Expo SDK](https://expo.dev/) | 54 | [Docs](https://docs.expo.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | 5.9.2 | [Docs](https://www.typescriptlang.org/docs/) |
| **UI Library** | [React](https://react.dev/) | 19.1.0 | [Docs](https://react.dev/reference/react) |
| **Router** | [Expo Router](https://docs.expo.dev/router/introduction/) | 6.x | [Docs](https://docs.expo.dev/router/introduction/) |
| **Backend** | [Supabase](https://supabase.com/) | 2.x | [Docs](https://supabase.com/docs) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) | 15+ | [Docs](https://www.postgresql.org/docs/) |
| **Auth** | [Supabase Auth](https://supabase.com/docs/guides/auth) | - | [Docs](https://supabase.com/docs/guides/auth) |
| **Maps (Native)** | [react-native-maps](https://github.com/react-native-maps/react-native-maps) | 1.20.1 | [Docs](https://github.com/react-native-maps/react-native-maps/blob/master/docs/README.md) |
| **Maps (Web)** | [Leaflet](https://leafletjs.com/) | 1.9.4 | [Docs](https://leafletjs.com/reference.html) |
| **Icons** | [Lucide](https://lucide.dev/) | 1.7.0 | [Docs](https://lucide.dev/guide/) |
| **Fonts** | [Syne](https://fonts.google.com/specimen/Syne) + [DM Sans](https://fonts.google.com/specimen/DM+Sans) | - | Google Fonts |
| **Storage (Native)** | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) | 16.x | [Docs](https://docs.expo.dev/versions/latest/sdk/sqlite/) |
| **Push Notifications** | [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) | 0.32.x | [Docs](https://docs.expo.dev/push-notifications/overview/) |
| **OAuth (Google)** | [@react-native-google-signin](https://github.com/react-native-google-signin/google-signin) | 16.x | [Docs](https://github.com/react-native-google-signin/google-signin#readme) |
| **OAuth (Apple)** | [expo-apple-authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/) | 8.x | [Docs](https://docs.expo.dev/versions/latest/sdk/apple-authentication/) |
| **Unit Testing** | [Jest](https://jestjs.io/) + [Testing Library](https://testing-library.com/docs/react-native-testing-library/intro/) | 29.x | [Docs](https://jestjs.io/docs/getting-started) |
| **E2E Testing** | [Maestro](https://maestro.mobile.dev/) | 2.3.0 | [Docs](https://maestro.mobile.dev/getting-started) |
| **CI/CD** | [GitHub Actions](https://docs.github.com/en/actions) | - | [Docs](https://docs.github.com/en/actions) |
| **Web Hosting** | [GitHub Pages](https://pages.github.com/) | - | [Docs](https://docs.github.com/en/pages) |

---

## Architecture Overview

```
                    +-------------------+
                    |   GitHub Pages    |
                    |   (Web Deploy)    |
                    +--------+----------+
                             |
              +--------------+--------------+
              |                             |
    +---------+----------+    +-------------+---------+
    |   iOS / Android    |    |     Web Browser       |
    |   (React Native)   |    |   (React Native Web)  |
    +---------+----------+    +-------------+---------+
              |                             |
              +-------------+---------------+
                            |
                   +--------+--------+
                   |    Expo Router   |
                   |  (File-based)   |
                   +--------+--------+
                            |
              +-------------+-------------+
              |             |             |
         +----+----+  +----+----+  +----+----+
         | Screens |  |Contexts |  |Services |
         | (UI)    |  | (State) |  | (Data)  |
         +----+----+  +----+----+  +----+----+
              |             |             |
              +-------------+-------------+
                            |
                   +--------+--------+
                   |    Supabase     |
                   | (Auth + DB +    |
                   |  Realtime)      |
                   +-----------------+
```

**Key architectural decisions:**

- **File-based routing** via Expo Router — routes map to files in `src/app/`
- **Service layer pattern** — all Supabase queries are in `src/services/`, screens never call Supabase directly
- **Context-based state** — auth, i18n, and notifications are managed via React contexts
- **Platform shims** — native-only modules (react-native-maps) have web shims in `src/shims/`
- **Materialized views** — venue stats and leaderboards are precomputed in PostgreSQL for performance
- **RLS (Row Level Security)** — all tables have PostgreSQL policies enforcing access control at the database level

---

## Project Structure

```
TTPortal/
├── src/
│   ├── app/                    # Routes (Expo Router file-based)
│   │   ├── (tabs)/             # Bottom tab screens (public + auth-gated)
│   │   ├── (protected)/        # Auth-required routes (add venue, review, etc.)
│   │   ├── venue/[id].tsx      # Dynamic venue detail route
│   │   ├── sign-in.tsx         # Login / Signup
│   │   ├── forgot-password.tsx
│   │   ├── reset-password.tsx
│   │   └── _layout.tsx         # Root layout (providers + navigation)
│   ├── screens/                # Screen components (presentation logic)
│   ├── services/               # Data access layer (Supabase queries)
│   ├── components/             # Reusable UI components
│   ├── contexts/               # React contexts (auth, i18n, notifications)
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilities (supabase client, logger, auth helpers)
│   ├── locales/                # Translation strings (ro.json, en.json)
│   ├── shims/                  # Web shims for native modules
│   ├── theme.ts                # Design tokens (colors, fonts, radii)
│   └── types/                  # TypeScript type definitions
├── supabase/
│   ├── migrations/             # Production database migrations (000-010)
│   ├── seeds/                  # Local dev seed data (not for production)
│   ├── docker-compose.yml      # Local Supabase stack
│   ├── .env                    # Local Supabase credentials
│   ├── run_migrations.ps1      # PowerShell migration runner
│   └── full_migration.sql      # Combined migration for SQL Editor
├── .maestro/                   # E2E test suite
│   ├── flows/                  # 20 test flows
│   └── helpers/                # Reusable test helpers
├── .github/workflows/          # CI/CD (deploy to GitHub Pages)
├── assets/                     # Images, icons, splash screens
├── metro.config.js             # Metro bundler config (WASM + web shims)
├── app.json                    # Expo configuration
├── jest.config.js              # Test configuration
└── package.json                # Dependencies and scripts
```

---

## Routing & Navigation

Built on [Expo Router](https://docs.expo.dev/router/introduction/) with file-based routing.

### Route Groups

| Group | Path | Auth | Description |
|-------|------|------|-------------|
| `(tabs)` | `/`, `/events`, `/leaderboard`, `/favorites`, `/profile` | Mixed | Bottom tab navigation. Map and Events are public; Leaderboard, Favorites, Profile require auth |
| `(protected)` | `/add-venue`, `/review/[id]`, `/friends`, etc. | Required | Write actions — guarded by `useAuthGuard()` hook |
| Root | `/sign-in`, `/forgot-password`, `/reset-password` | No | Auth screens |
| Dynamic | `/venue/[id]` | No | Venue detail (public) |

### Auth Guard

```typescript
// src/hooks/useAuthGuard.ts
export function useAuthGuard(): boolean {
  // Redirects to /sign-in with returnTo param if not authenticated
  // Returns true when safe to render
}
```

Used in `(protected)/_layout.tsx` and each auth-only tab screen.

---

## Authentication

Three auth methods via [Supabase Auth](https://supabase.com/docs/guides/auth):

| Method | Implementation |
|--------|---------------|
| **Email/Password** | `supabase.auth.signUp()` / `signInWithPassword()` |
| **Google OAuth** | Native via `@react-native-google-signin` → `supabase.auth.signInWithIdToken()` |
| **Apple OAuth** | Native via `expo-apple-authentication` on iOS, web OAuth fallback on Android |

**Session persistence:**
- **Native (iOS/Android):** `expo-sqlite` — stores session in a local SQLite database
- **Web:** `localStorage` with in-memory fallback during SSR

**Profile creation:** A PostgreSQL trigger (`handle_new_user`) auto-creates a profile row when a new `auth.users` entry is inserted.

---

## Database Schema

### Tables

| Table | Description | Key Fields |
|-------|-------------|------------|
| `profiles` | User profiles | `id` (FK → auth.users), `full_name`, `email`, `city`, `lang`, `is_admin` |
| `cities` | Supported cities | `name` (unique), `lat`, `lng`, `zoom`, `venue_count` |
| `venues` | Table tennis venues | `name`, `type`, `city`, `lat`, `lng`, `condition`, `verified`, `approved` |
| `reviews` | Venue reviews | `venue_id`, `user_id`, `rating` (1-5), `body` |
| `favorites` | User favorites | `user_id`, `venue_id` (unique pair) |
| `checkins` | Play sessions | `user_id`, `venue_id`, `started_at`, `ended_at` (NOT NULL, auto-checkout) |
| `condition_votes` | Venue condition ratings | `user_id`, `venue_id`, `condition` |
| `friendships` | Social connections | `requester_id`, `addressee_id`, `status` (pending/accepted/declined) |
| `events` | Group play events | `title`, `venue_id`, `organizer_id`, `starts_at`, `status`, `event_type` |
| `event_participants` | Event attendance | `event_id`, `user_id` |
| `notifications` | In-app notifications | `recipient_id`, `sender_id`, `type`, `title`, `body`, `read` |
| `push_tokens` | Push notification tokens | `user_id`, `token`, `device_type` |

### Materialized Views

| View | Purpose | Refresh |
|------|---------|---------|
| `venue_stats` | Avg rating, review/checkin/favorite counts per venue | Via `refresh_stats()` |
| `leaderboard_checkins` | User rankings by total check-ins | Via `refresh_stats()` |
| `leaderboard_reviews` | User rankings by total reviews | Via `refresh_stats()` |
| `leaderboard_venues` | User rankings by venues submitted | Via `refresh_stats()` |

### Row Level Security (RLS)

Every table has RLS enabled. Key policies:

- Users can only read their own checkins, favorites, friendships, notifications
- Active checkins (`ended_at > now()`) are readable by all authenticated users
- Venues and reviews are publicly readable
- Notifications can only be inserted by `service_role` (via triggers)
- Users can delete their own notifications

### Migrations

Production migrations are in `supabase/migrations/` (000-010). Local dev seed data is in `supabase/seeds/` (001-002).

---

## Data Access Layer

All database queries go through service modules in `src/services/`. Screens never import `supabase` directly.

### Two-Step Query Pattern

Since Supabase PostgREST can't join across tables that only share a common FK through `auth.users`, several services use a two-step approach:

```typescript
// Example: getFriends() in src/services/friends.ts
const { data: friendships } = await supabase
  .from('friendships').select('*')...;     // Step 1: get relationships

const { data: profiles } = await supabase
  .from('profiles').select('*')
  .in('id', friendIds);                     // Step 2: batch-fetch profiles

// Merge in-memory
const merged = friendships.map(f => ({
  ...f, profile: profileMap.get(f.friend_id)
}));
```

This pattern is used in: `getFriends`, `getPendingRequests`, `getNotifications`, `getEventParticipants`, `getVenues` (for venue_stats).

### Performance Optimizations

- **Materialized views** for venue stats and leaderboards (precomputed, not per-query)
- **Composite indexes** on `checkins(user_id, ended_at)`, `checkins(venue_id, ended_at)`, `friendships(addressee_id, status)`, `reviews(user_id)`, `event_participants(user_id)`
- **`getFriendIds()`** — lightweight single-query alternative to `getFriends()` when only IDs are needed
- **LIMIT clauses** on all unbounded queries (venues: 300, events: 50, reviews: 50, favorites: 100)
- **Column selection** — map view selects only needed columns instead of `SELECT *`

---

## State Management

No external state library. State is managed via:

| Mechanism | Scope | Examples |
|-----------|-------|---------|
| **React Context** | App-wide | Auth session, i18n language, notification count |
| **useState** | Per-screen | Venues list, loading states, form inputs |
| **useMemo** | Derived data | Filtered venues, sorted favorites |
| **useCallback** | Stable references | Event handlers, fetch functions |

### Contexts

| Context | Provider | Hook | Purpose |
|---------|----------|------|---------|
| `SessionContext` | `SessionProvider` | `useSession()` | Auth state, login/logout methods |
| `I18nContext` | `I18nProvider` | `useI18n()` | Language selection, string resolution |
| `NotificationContext` | `NotificationProvider` | `useNotifications()` | Unread count, push token management |

---

## Internationalization

Dual-language support (Romanian and English) via a custom i18n system.

- **String files:** `src/locales/ro.json` and `src/locales/en.json`
- **Language persistence:** Stored in expo-sqlite (key: `ttportal-lang`)
- **Default:** Romanian (`ro`)
- **Usage:** `const { s } = useI18n(); s('checkinHere')` resolves to the current language string with English fallback

---

## Notifications

### In-App Notifications

Created by PostgreSQL triggers when:
- Friend request sent/accepted
- User joins your event
- Event cancelled
- Friend checks in nearby
- Review posted on your venue

### Push Notifications

- Token registration via `expo-notifications` on sign-in
- Push delivery via `pg_net` → Expo Push API from database triggers
- Error handling: push failures never roll back parent transactions

### Notification Types

`friend_request`, `friend_accepted`, `event_reminder`, `event_joined`, `event_cancelled`, `checkin_nearby`, `review_on_venue`

---

## Map Integration

### Native (iOS/Android)

Uses [react-native-maps](https://github.com/react-native-maps/react-native-maps) with Apple Maps (iOS) and Google Maps (Android).

**Custom markers:** Colored circles (30px) with emoji icons (🏓 outdoor, 🏢 indoor) and a white border + arrow. Friend check-in badges (👋) overlay on venues where friends are playing.

**Performance:** `tracksViewChanges={false}` on all markers. Filter changes toggle `opacity` instead of unmounting markers to prevent crashes.

### Web

Uses [Leaflet](https://leafletjs.com/) via a shim in `src/shims/react-native-maps.web.js`. The shim:
- Loads Leaflet CSS/JS from CDN
- Creates `divIcon` markers with HTML matching the native pin design
- Handles `ResizeObserver` for proper tile rendering
- Supports `Callout` via Leaflet popups

---

## Design System

Defined in `src/theme.ts`:

| Token | Values |
|-------|--------|
| **Colors** | Green palette (primary), orange (actions), purple (social), red (destructive), amber (warnings) |
| **Fonts** | Syne (headings, 400/700), DM Sans (body, 400/500) |
| **Radii** | sm: 6, md: 10, lg: 14, xl: 20, full: 100 |

**Header theme:** All screens use a dark green (`#14532d`) top bar with white text and orange action buttons.

**Web constraint:** App content is limited to 430px max-width on desktop with a centered frame and subtle shadow.

---

## Testing

### Unit Tests (Jest)

- **31 test suites, 236 tests**
- Located in `__tests__/` directories alongside source files and in `src/services/__tests__/`
- Mocks: `expo-sqlite`, `react-native-safe-area-context`, `expo-router` configured in `jest.setup.js`
- Coverage: auth flows, form validation, service layer queries, context providers, layout rendering

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

### E2E Tests (Maestro)

- **20 test flows** in `.maestro/flows/`
- Tests: auth (signup, login, logout, validation), navigation, map interaction, venue detail, events, leaderboard, favorites, profile, friends, play history, checkin, protected routes, full user journey
- Reusable helpers in `.maestro/helpers/` (login, sign-out, dismiss banner)
- Test users: `andrei@test.com`, `maria@test.com`, `cristian@test.com` (password: `test1234`)

```bash
npm run e2e                              # Run all flows
npm run e2e:single .maestro/flows/02_auth_login.yaml  # Single flow
npm run e2e:studio                       # Interactive studio
```

---

## CI/CD & Deployment

### GitHub Actions Workflow

**File:** `.github/workflows/deploy.yml`

**Trigger:** Push to `001-user-auth` branch

**Pipeline:**
1. Checkout code
2. Setup Node.js 20
3. Install dependencies (`npm install`)
4. Build Expo web export (`npx expo export --platform web`)
5. Copy `index.html` → `404.html` for SPA routing
6. Deploy to GitHub Pages

**Secrets required:**
- `EXPO_PUBLIC_SUPABASE_URL` — production Supabase URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — production anon key

### Database Migrations

Production migrations can be run via:
- **PowerShell script:** `supabase/run_migrations.ps1 -Password "db-password"`
- **SQL Editor:** Paste `supabase/full_migration.sql` into Supabase Dashboard → SQL Editor
- **Manual:** Run each file in `supabase/migrations/` in order (000-010)

---

## Development Setup

### Prerequisites

- Node.js 20+
- Docker (for local Supabase)
- Xcode (for iOS simulator)
- Maestro CLI (for E2E tests)

### Local Supabase

```bash
cd supabase
docker compose up -d          # Start
docker compose down           # Stop
docker compose down -v        # Reset (wipe data)
```

After starting, apply migrations and seeds:
```bash
for f in $(ls migrations/*.sql seeds/*.sql | sort); do
  docker exec -i supabase-db psql -U postgres < "$f"
done
```

**Local endpoints:**
- API: `http://localhost:54331`
- Studio: `http://localhost:8000`
- Database: `postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:5432/postgres`

### Environment Variables

Copy from `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54331
EXPO_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<your-google-client-id>
```

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `npx expo start` | Start dev server |
| `npx expo start --clear` | Start with cleared cache |
| `npx expo start --web` | Start web version |
| `npx expo run:ios` | Build and run on iOS simulator |
| `npx expo run:android` | Build and run on Android |
| `npm test` | Run unit tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run e2e` | Run all Maestro E2E tests |
| `npx expo export --platform web` | Build web export |
