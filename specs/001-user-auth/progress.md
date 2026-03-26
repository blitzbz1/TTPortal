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

## Iteration 12 - T015
- Added ActivityIndicator loading spinner to submit button during async signUp call. Registration success redirect (`router.replace` to `/(tabs)/` or `returnTo`) and server error mapping (`mapAuthErrorToKey`) were already functional from the T012/T013 scaffold (iteration 10). All 5 T013 tests pass green; 86% coverage on sign-in.tsx.
- Pattern: when TDD scaffold tests are written alongside a functional scaffold, later "implementation" tasks may only need UI polish (e.g., adding a spinner) since the core logic already exists to satisfy the tests.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `21f4acd`.
---

## Iteration 13 - T042
- Added Terms of Service and Privacy Policy touchable text links below the submit button on the signup tab only. Links open external URLs via `Linking.openURL`. Added 4 new i18n keys (`authTermsPrefix`, `authTermsOfServiceLink`, `authTermsConnector`, `authPrivacyPolicyLink`) to both locale files. Wrote 6 tests covering signup-only visibility, tab switching, and URL invocation.
- Pattern: nested `<Text onPress={...}>` inside a parent `<Text>` is the standard React Native approach for inline tappable links within a sentence. The `testID` on the nested Text works for testing with `getByTestId` + `user.press`.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `d823aee`.
---

## Iteration 14 - T016, T017
- Wrote 5 login form validation tests (T016) and 4 login flow tests (T017). Updated sign-in.tsx to support login flow: `handleSubmit` now branches on `activeTab` to call `signIn` vs `signUp`, and `mapAuthErrorToKey` handles `invalid_credentials` error code.
- For T017 session persistence test: `jest.mock('../../hooks/useSession')` replaces the hook for ALL components in the file, including test consumers. Fix: use `useContext(SessionContext)` directly in the test consumer to bypass the mocked hook and read real SessionProvider state.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `34f786d`.
---

## Iteration 15 - T018
- Login tab functionality was already fully implemented during T012-T016 scaffold iterations. All 5 T016 tests pass green with 94.8% coverage. Task was a verification pass — no code changes needed.
- Pattern: when TDD scaffold builds functional code incrementally across multiple tasks, later "implementation" tasks may be no-ops if the scaffold already satisfies all test requirements. Always verify tests pass before assuming work is needed.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `e78919c`.
---

## Iteration 16 - T019
- Login success redirect (`router.replace` to `/(tabs)/` or `returnTo`), generic error messages (`invalid_credentials` → `errorInvalidCredentials`), and loading state were already implemented in the scaffold from iterations 10-14. All 4 T017 tests pass green with 94.8% coverage. No code changes needed — verification pass only.
- Pattern confirmed: three consecutive tasks (T018, T019) were no-ops because the TDD scaffold built during T012-T016 already contained all the functional logic. This is expected when TDD tests are written alongside a functional scaffold rather than pure stubs.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `1612065`.
---

## Iteration 17 - T020
- Created `SessionProvider.persistence.test.tsx` with 5 tests verifying session restoration from expo-sqlite on mount and session survival across simulated app restart (unmount + remount). All tests pass green; 130 total tests across 15 suites.
- The persistence test is a pure test-only task — coverage on SessionProvider.tsx from this file alone is ~47% because the auth methods (signUp, signIn, etc.) aren't exercised, but the existing `SessionProvider.test.tsx` already covers those paths comprehensively.
- Pattern: for `jest.mock` factories that capture callbacks into module-scoped variables, if those variables aren't used directly in tests (only used inside mock functions), remove them to avoid lint `no-unused-vars` warnings.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `af27b8c`.
---

## Iteration 18 - T021
- Wrote 5 Google Sign-In tests covering button rendering, signInWithGoogle call, success navigation, error display, and loading state disabling all auth buttons. Wired Google button in sign-in.tsx with testID, onPress, and disabled props. Also added testID/disabled to Apple button for loading state test.
- Extracted `isValidEmail` and `mapAuthErrorToKey` to `src/lib/auth-utils.ts` and styles to `src/app/sign-in.styles.ts` to keep sign-in.tsx under the 500-line limit (was 555 → now 343). This refactor pattern will be needed as more features are added to sign-in.tsx.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `06a80a1`.
---

## Iteration 19 - T022
- Installed `@react-native-google-signin/google-signin`, configured Expo plugin in app.json, added Google Web Client ID env var. Replaced `signInWithGoogle` stub in SessionProvider with real implementation: GoogleSignin.signIn() → extract idToken → supabase.auth.signInWithIdToken → upsert profiles with auth_provider 'google'. Added 4 new SessionProvider tests (success, cancel, error, profile upsert).
- Gotcha: any test file that imports `SessionProvider.tsx` (directly or transitively) must mock `@react-native-google-signin/google-signin` because the module-level `GoogleSignin.configure()` call triggers a TurboModule lookup that fails in jest. Two existing test files (`SessionProvider.persistence.test.tsx`, `sign-in.login-flow.test.tsx`) needed this mock added.
- Pattern: `GoogleSignin.configure()` at module level in SessionProvider.tsx is cleanest — runs once on import. In tests, the jest.mock factory (hoisted before imports) replaces it with jest.fn().
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `d124ae6`.
---

## Iteration 20 - T023
- Verified Google-to-email account linking: wrote 6 tests confirming that when an email-registered user signs in with Google, the profile upsert (onConflict: 'id') updates the existing row with `auth_provider: 'google'` rather than creating a duplicate. Added account-linking detection logging when `app_metadata.providers` includes both 'email' and 'google'.
- Pattern: Supabase automatically links OAuth identities to existing email accounts when the email matches. The `app_metadata.providers` array on the user object reliably indicates which identity providers are linked — useful for detecting account linking after the fact.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `12e3b33`.
---

## Iteration 21 - T024
- Wrote 5 Apple Sign-In tests and wired Apple button's `onPress` handler in sign-in.tsx (following the same pattern as Google: `handleAppleSignIn` callback with loading/error state). Test for "Hide My Email" verifies relay email addresses flow through normally.
- Pattern: Apple and Google OAuth buttons follow identical UI-level patterns (mock `signInWith*`, verify navigation/error). The implementation-level differences (native vs web fallback, name capture) are tested in SessionProvider tests (T025/T026), not sign-in screen tests.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `c768750`.
---

## Iteration 22 - T025
- Replaced `signInWithApple` stub in SessionProvider.tsx with real implementation: iOS uses `expo-apple-authentication` `signInAsync` → `supabase.auth.signInWithIdToken`, captures `credential.fullName` on first sign-in and stores via `updateUser`. Android falls back to `supabase.auth.signInWithOAuth`. Upserts profile with `auth_provider: 'apple'`. Added 5 new Apple-specific tests in SessionProvider.test.tsx (88% coverage).
- Gotcha: Any test file that imports SessionProvider.tsx (directly or transitively) must now mock `expo-apple-authentication` in addition to `@react-native-google-signin/google-signin`. Updated 4 test files: SessionProvider.test.tsx, SessionProvider.persistence.test.tsx, SessionProvider.google-linking.test.tsx, sign-in.login-flow.test.tsx.
- Pattern: `jest.replaceProperty(require('react-native').Platform, 'OS', 'ios')` is the clean way to test platform-specific branches within a single test file. Each test can set the platform independently.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `510a1db`.
---

## Iteration 23 - T026
- Handled Apple name capture edge case: refactored `signInWithApple` to conditionally include `full_name` in profile upsert only when `credential.fullName` is present. Wrote 5 tests covering first sign-in (name present), repeat sign-in (fullName null), partial name (givenName only), and empty name fields.
- Pattern: To conditionally include a field in a Supabase upsert, build the data object with an optional typed field (`full_name?: string`) and only assign it when the value is present. This avoids overwriting existing DB values on update while still supporting insert.
- Push still blocked: SSH key `tavigm` lacks write access. Commit saved locally: `5dbdad4`.
---

