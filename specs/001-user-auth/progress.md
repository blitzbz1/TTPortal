# Progress Log

Iteration learnings and patterns discovered during implementation.

---

## Iteration 1 - T001
- Expo project was already initialized with SDK 55, TypeScript, expo-router tabs template, and `src/app/` routing structure. Verified all quality gates pass (typecheck, lint, export).
- ESLint was auto-configured on first `npm run lint` run — it installs `eslint` and `eslint-config-expo` automatically and creates `eslint.config.js`. Fixed pre-existing lint errors (unescaped `"` in JSX) in scaffold screens.
- Push blocked: SSH key `tavigm` lacks write access to `blitzbz1/TTPortal.git`. Need repo access or correct remote URL before pushing.
- Useful commands: `npx expo export --platform web` for non-interactive build validation.
---

## Iteration 2 - T002
- Installed `@supabase/supabase-js`, `expo-sqlite`, `react-native-url-polyfill`, `expo-apple-authentication`. `expo-font` was already present from the initial Expo template.
- `expo doctor` is now `npx expo-doctor` (local CLI doesn't support `expo doctor`). Only failure was pre-existing Xcode version incompatibility (SDK 55 requires Xcode >=26.0.0), unrelated to installed packages.
- Push still blocked: SSH key `tavigm` lacks write access to `blitzbz1/TTPortal.git`. `gh auth` not configured either. This must be resolved before any iteration can push.
- Commit saved locally: `853bcb2 feat(T002): install core auth dependencies`
---

## Iteration 3 - T003, T004, T005
- Configured jest with jest-expo preset, installed @testing-library/react-native. Created Supabase client with expo-sqlite storage adapter. Extracted i18n strings from js/ui.js to JSON locale files with all auth keys from ui-contracts.md.
- Gotcha: `react-test-renderer` must be pinned to match exact react version (19.2.0) or npm ERESOLVE fails. Also, env vars for Supabase must be set in a jest setupFiles script (jest.setup.js) — setting them at top of test file runs too late because ES imports are hoisted above assignments.
- Push still blocked: SSH key `tavigm` lacks write access to `blitzbz1/TTPortal.git`. Commit saved locally: `0f477df`.
---

## Iteration 4 - T006
- Created I18nProvider context and useI18n hook. Provider loads language from expo-sqlite storage (same DB as Supabase client), exposes `lang`, `setLang`, and `s()` string resolver with English fallback and `{0}`-style interpolation.
- Gotcha: when mocking `jest.fn(() => null)`, TypeScript infers the return type strictly as `null`, causing `mockReturnValueOnce({...})` to fail typecheck. Fix: explicitly type the mock arrow function return type as a union (e.g., `(): { value: string } | null => null`).
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `bd5c03c`.
---

## Iteration 5 - T007
- Created SessionProvider context wrapping Supabase `onAuthStateChange`, useSession hook, and logger utility. 15 tests covering all contract methods, loading states, auth state changes, and stub OAuth methods.
- Gotcha: `jest.mock` factory is hoisted above variable declarations even when `const` names start with `mock`. Direct assignment like `getSession: mockGetSession` captures `undefined` because the factory runs before the `const` initializer. Fix: use wrapper functions `(...a: any[]) => mockFn(...a)` so the reference is resolved lazily at call time.
- The `@typescript-eslint/no-explicit-any` rule is not active in the current eslint config, so eslint-disable comments for `any` types are unnecessary and trigger "Unused eslint-disable directive" warnings.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `2fb1f2c`.
---

## Iteration 6 - T008
- Created root layout wrapping app in SessionProvider → I18nProvider, loading Syne and DM Sans fonts via @expo-google-fonts packages, showing splash/loading view while session or fonts load. 8 tests verifying loading states, provider nesting order, and splash screen behavior.
- Gotcha: `jest.mock` factory variables like `const mockHideAsync = jest.fn()` are hoisted but NOT initialized when the factory runs. For module-level mocks (like `expo-splash-screen`), use inline `jest.fn()` in the factory and reference the mock via `require` or import after the mock. Wrapper function pattern from T007 (`(...a) => mockFn(...a)`) works for lazy resolution, but for `* as Module` imports the mock factory itself must provide the functions.
- The `@expo-google-fonts/*` packages are ESM with `require()` for font assets. They work fine with Metro and jest-expo transform. The `transformIgnorePatterns` in jest.config.js already includes `@expo-google-fonts/.*` so they're properly transformed in tests.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `f98bb5f`.
---

## Iteration 7 - T009
- Created protected route group `src/app/(protected)/_layout.tsx` using `Stack.Protected` with `guard={!!session}` and `useEffect`-based redirect to `/sign-in?returnTo=<pathname>` when unauthenticated. Returns `null` before redirect to prevent content flash. 8 tests at 100% coverage.
- `Stack.Protected` exists in expo-router and accepts `guard: boolean`. Under the hood it's the `Group` primitive — when guard is false the wrapped `Stack.Screen` entries are unregistered from the navigator. Combine with an imperative `router.replace` in a `useEffect` for the actual redirect (no `<Redirect>` component in expo-router).
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `acbc874`.
---

## Iteration 8 - T010
- Created tab layout with 5 tabs (Harta, Evenimente, Clasament, Favorite, Profil) matching TabBar.tsx design, plus HeaderProfileIcon stub in header-right. Created placeholder tab screens (events, leaderboard, favorites, profile). 14 tests covering tab rendering, order, styling colors, and header integration.
- Parenthesized directory names like `(tabs)` need regex-based `--testPathPattern` when running jest directly — the literal path with parens doesn't match. Use `npx jest --testPathPattern='tabs.*_layout'` instead of passing the file path.
- The `Tabs.Screen` `tabBarIcon` callback receives `{ color }` which is set by `tabBarActiveTintColor`/`tabBarInactiveTintColor` — pass it through to the icon component rather than hardcoding colors per tab.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `9990567`.
---

## Iteration 9 - T011
- Created `supabase/migrations/001_create_profiles.sql` with profiles table (all columns per data-model.md), RLS enabled, and `handle_new_user` trigger that auto-creates a profile row on auth.users insert. Created `supabase/config.toml` documenting JWT expiry (3600s) and refresh token rotation settings for >=7 day session persistence. Wrote 19 tests validating migration SQL structure and Supabase auth config.
- This task is purely SQL/config — no runtime TypeScript source to measure coverage against. Tests validate file contents via `fs.readFileSync` and regex matching, which is a pragmatic approach for SQL migration testing in a mocked test environment.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `c78e10b`.
---

## Iteration 10 - T012, T013
- Wrote 6 registration form validation tests (T012) and 5 registration flow tests (T013) for the sign-in screen. Created a minimal `src/app/sign-in.tsx` scaffold (functional skeleton with validation, signUp call, error mapping, password toggle, loading state) so the TDD tests can import and test against a real component. Coverage: 90% statements, 93% branches.
- Gotcha: TDD test tasks (T012/T013) are test-only but quality gates require all tests pass — resolved by providing a minimal functional scaffold alongside the tests. T014/T015 will upgrade this scaffold with full styling and design system integration.
- The `userEvent` from `@testing-library/react-native` v13.x supports `user.type(element, text)` for TextInput and `user.press(element)` for Pressable. `userEvent.setup()` is called once per describe block (not per test).
- For Supabase `AuthError` mapping: `user_already_exists` code or "already registered" message → duplicate email; `AuthRetryableFetchError` name or "Failed to fetch" message → network error.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `05076cd`.
---

## Iteration 11 - T014
- Upgraded the sign-in.tsx scaffold from a bare functional skeleton to a styled, production-quality registration form using the design system (dark green theme, input icons via Lucide, tab switcher, keyboard avoidance). Added structured logging via logger for signup submit/success/failure events.
- The T012/T013 TDD tests already passed against the scaffold created in iteration 10, so T014 was primarily a styling/design-system upgrade. All 11 registration tests remain green with 86% statement coverage.
- `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` is the standard pattern for Expo — Android handles keyboard avoidance natively in most cases.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `35f4f6b`.
---

