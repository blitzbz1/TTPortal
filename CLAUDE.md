# TTPortal Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-26

## Active Technologies

- TypeScript 5.x, React Native 0.76+, React 18 + Expo SDK 54, expo-router, @supabase/supabase-js, expo-sqlite, @react-native-google-signin/google-signin, expo-apple-authentication (001-user-auth)

## Project Structure

```text
src/
tests/
```

## Commands

- Run app: `npx expo start`, `npx expo start --clear`
- Lint: `npm run lint`
- TypeCheck: `npm run typecheck`
- Build validation: `npx expo export --platform web`
- Test: `npm test`, `npm run test:watch`, `npm run test:coverage`
- Test + lint: `npm test && npm run lint`

## Code Style

TypeScript 5.x, React Native 0.76+, React 18: Follow standard conventions

## Recent Changes

- 001-user-auth: Added TypeScript 5.x, React Native 0.76+, React 18 + Expo SDK 54, expo-router, @supabase/supabase-js, expo-sqlite, @react-native-google-signin/google-signin, expo-apple-authentication

<!-- MANUAL ADDITIONS START -->

## Architecture conventions

- **`src/features/<domain>/`** is the pattern for cohesive product domains
  (types + api + hooks + domain logic behind one barrel `index.ts`).
  `features/challenges/` is the reference implementation — challenge
  definitions, monthly rotation, progression, availability, and hooks all
  live there. Add new domains (and migrate old `lib/`+`services/` splits)
  to this shape rather than scattering domain logic across `src/lib`.
- **Data access**: standardize on react-query hooks following the
  `useLeaderboardQuery` shape — queryFn calls the service and mirrors to a
  domain cache via `saveCached*`; `initialData` hydrates from `loadCached*`.
- **Tests**: Jest for app code (`npm test`), `npm run test:functions` for
  Edge Function Deno tests, `npm run test:db` for pgTAP, `npm run deadcode`
  (knip) for unused-export sweeps.
- **DB changes**: migrations 000–099 are applied to prod and FROZEN —
  never edit them; all schema changes ship as new migrations (100+).
  099's RPC compat shims drop once pre-097 clients retire.
<!-- MANUAL ADDITIONS END -->
