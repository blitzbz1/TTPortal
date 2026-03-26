# Tasks: User Authentication

**Input**: Design documents from `/specs/001-user-auth/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: TDD approach — each task includes a test that MUST be written first and pass (green) before the task is marked complete.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions
- **TDD**: Each task specifies a test file → write test first (red), implement (green), then mark complete

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize Expo project, install dependencies, configure tooling

- [x] T001 Initialize Expo project with TypeScript and expo-router in project root — run `npx create-expo-app@latest . --template tabs` (or equivalent), ensure `app.json` has `expo-router` scheme configured. **Test**: `npx expo start --no-dev` exits without errors; `src/app/_layout.tsx` exists
- [x] T002 Install core dependencies: `@supabase/supabase-js`, `expo-sqlite`, `react-native-url-polyfill`, `expo-font`, `expo-apple-authentication`. **Test**: `npx expo doctor` passes; all packages resolve in `node_modules/`
- [x] T003 [P] Install and configure testing: `jest`, `@testing-library/react-native`, `jest-expo`. Create `jest.config.js` at project root with `jest-expo` preset. **Test**: `npm test -- --passWithNoTests` exits 0
- [x] T004 [P] Create Supabase client in `src/lib/supabase.ts` — initialize with `expo-sqlite` localStorage, `detectSessionInUrl: false`, `autoRefreshToken: true`, `persistSession: true`. Read URL and anon key from `EXPO_PUBLIC_` env vars. Create `.env` with existing Supabase credentials from `js/config.js`. **Test**: write `src/lib/__tests__/supabase.test.ts` verifying `supabase` export is a valid client object with `auth` property
- [x] T005 [P] Extract i18n strings from `js/ui.js` STRINGS dictionary to `src/locales/ro.json` and `src/locales/en.json`. Include all auth-related keys from contracts (validation errors, button labels, screen titles). Add auth-specific keys from `contracts/ui-contracts.md` validation contract. **Test**: write `src/locales/__tests__/locales.test.ts` verifying both JSON files parse, have identical key sets, and contain all required auth keys (`authSignup`, `authLogin`, `authForgot`, `validationEmailInvalid`, `validationPasswordMin`, `validationNameRequired`, `errorDuplicateEmail`, `errorInvalidCredentials`, `errorNetwork`, `logout`, `forgotPasswordSuccess`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Auth context, i18n context, and route structure that ALL user stories depend on

**TDD**: Write tests first for each provider/hook, then implement until green

- [x] T006 Create `src/contexts/I18nProvider.tsx` and `src/hooks/useI18n.ts` — provider loads language from `expo-sqlite` storage (migrating from localStorage key `ttportal-lang`), exposes `lang`, `setLang(lang)`, and `s(key, ...args)` string resolver with English fallback. **Test**: write `src/contexts/__tests__/I18nProvider.test.tsx` — render provider with `lang='ro'`, verify `s('authLogin')` returns Romanian string; switch to `'en'`, verify English string; verify `s('nonexistent')` returns key as fallback
- [x] T007 Create `src/contexts/SessionProvider.tsx` and `src/hooks/useSession.ts` — provider wraps Supabase `onAuthStateChange` listener, exposes `session`, `user`, `isLoading`, `signUp`, `signIn`, `signInWithGoogle`, `signInWithApple`, `signOut`, `resetPassword` per Auth Context Contract. On mount, restore session from storage; set `isLoading=false` once resolved. **Test**: write `src/contexts/__tests__/SessionProvider.test.tsx` — mock `supabase.auth`, verify: initial `isLoading=true`, resolves to `isLoading=false` with `session=null` when no stored session; verify `signUp` calls `supabase.auth.signUp` with correct params; verify `signOut` calls `supabase.auth.signOut`; verify `signInWithGoogle` and `signInWithApple` exist as functions on the context (stub implementations that throw "not yet implemented" until US3/US4)
- [x] T008 Create root layout `src/app/_layout.tsx` — wrap app in `SessionProvider` → `I18nProvider`. While `isLoading` is true, render splash/loading view (prevent auth flicker). Load Syne and DM Sans fonts via `expo-font`. Render `<Stack>` navigator. **Test**: write `src/app/__tests__/_layout.test.tsx` — mock providers, verify loading state shows splash; verify providers are rendered in correct order (Session wraps I18n)
- [x] T009 Create protected route group `src/app/(protected)/_layout.tsx` — use `Stack.Protected` with `guard={!!session}`. This group wraps **only** write-action routes (add-venue, review) — NOT the tabs or venue detail, which must remain publicly accessible per FR-020. When guard is false (anonymous user attempts a write route), redirect to `/sign-in` with `returnTo` param. **Test**: write `src/app/(protected)/__tests__/_layout.test.tsx` — mock `useSession` returning `session=null`, verify redirect to sign-in; mock with valid session, verify child content renders
- [x] T010 Create tab layout `src/app/(tabs)/_layout.tsx` — configure 5 tabs (Harta, Evenimente, Clasament, Favorite, Profil) matching existing `src/components/TabBar.tsx` design. This layout is **outside** the protected group so anonymous users can browse freely. Use icons from theme. Active tab: dark green, inactive: muted gray. Include HeaderProfileIcon in the header. **Test**: write `src/app/(tabs)/__tests__/_layout.test.tsx` — verify 5 tab items render with correct labels; verify active tab styling uses `Colors.green`; verify HeaderProfileIcon appears in header
- [x] T011 Create `profiles` table in Supabase — SQL migration with columns per data-model.md: `id` (UUID PK, references `auth.users.id`), `full_name` (text, not null), `email` (text, unique), `avatar_url` (text, nullable), `city` (text, nullable), `lang` (text, default `'ro'`), `auth_provider` (text, not null), `created_at` (timestamptz, default `now()`). Create a trigger function that auto-creates a profile row when a new auth user is created. Store migration SQL in `supabase/migrations/001_create_profiles.sql`. Configure Supabase Auth: set JWT expiry and refresh token rotation to support >=7 days session persistence (SC-008). Verify built-in rate limiting on auth endpoints is active (Supabase defaults: 30 requests/5 min). **Test**: write `src/lib/__tests__/profiles.test.ts` — query `profiles` table structure via Supabase, verify table exists and has expected columns; verify Supabase auth config supports session refresh

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 — Email Registration (Priority: P1) MVP

**Goal**: New users can create an account with full name, email, and password, and are immediately active

**Independent Test**: Complete the registration form with valid data → account is created → user lands on map view

### TDD Tests for User Story 1

> **Write these tests FIRST. They must FAIL (red) before implementation begins.**

- [x] T012 [P] [US1] Write registration form validation tests in `src/app/__tests__/sign-in.registration.test.tsx` — test: (1) signup tab shows name, email, password fields; (2) submit with empty name shows "Numele este obligatoriu" error; (3) submit with invalid email shows "Email invalid" error; (4) submit with password <8 chars shows "Minim 8 caractere" error; (5) submit with all valid fields calls `signUp(name, email, password)`; (6) password visibility toggle switches between secure and plain text
- [x] T013 [P] [US1] Write registration success/error tests in `src/app/__tests__/sign-in.registration-flow.test.tsx` — test: (1) successful signUp navigates to map route (or `returnTo` param if present); (2) duplicate email error from server shows "Acest email este deja folosit"; (3) network error shows "Eroare de conexiune. Încearcă din nou."; (4) loading state disables submit button during signUp call

### Implementation for User Story 1

- [x] T014 [US1] Implement registration form in `src/app/sign-in.tsx` — upgrade existing `SignupLoginScreen` scaffold to use real `TextInput` components with controlled state, client-side validation per contracts, show/hide password toggle via `secureTextEntry` prop, call `signUp` from `useSession` on submit. Include all i18n strings via `useI18n`. Parse `returnTo` and `initialTab` from route params. **Test**: T012 tests pass (green)
- [x] T015 [US1] Wire registration success redirect and server error handling in `src/app/sign-in.tsx` — on successful `signUp`, navigate to `/(app)/(tabs)/` (or `returnTo` if present). Map Supabase error codes to localized error messages per validation contract. Show loading spinner during async call. **Test**: T013 tests pass (green)

- [ ] T042 [US1] Add Terms of Service and Privacy Policy links to signup tab in `src/app/sign-in.tsx` — render touchable text links below the submit button per FR-018 ("Prin înregistrare, accepți Termenii și condițiile și Politica de confidențialitate"). Tap opens external URL via `Linking.openURL`. Both strings via `useI18n`. **Test**: write `src/app/__tests__/sign-in.terms.test.tsx` — verify links render on signup tab only (not login tab); verify tap calls `Linking.openURL` with correct URLs

**Checkpoint**: Email registration works end-to-end. New users can create accounts and land on the map.

---

## Phase 4: User Story 2 — Email Login (Priority: P1)

**Goal**: Returning users can sign in with email and password; sessions persist across app restarts

**Independent Test**: Log in with existing credentials → user lands on map view → close and reopen app → still logged in

### TDD Tests for User Story 2

- [ ] T016 [P] [US2] Write login form validation tests in `src/app/__tests__/sign-in.login.test.tsx` — test: (1) login tab shows email and password fields (no name field); (2) submit with invalid email shows validation error; (3) submit with password <8 chars shows validation error; (4) submit with valid fields calls `signIn(email, password)`; (5) tab switcher toggles between signup and login, clears errors on switch
- [ ] T017 [P] [US2] Write login flow tests in `src/app/__tests__/sign-in.login-flow.test.tsx` — test: (1) successful signIn navigates to map route; (2) incorrect credentials show "Email sau parola incorectă" (generic message, not revealing if email exists); (3) session persists — mock `onAuthStateChange` emitting a session, verify `useSession` returns it on next render; (4) `returnTo` param is honored after successful login

### Implementation for User Story 2

- [ ] T018 [US2] Implement login tab in `src/app/sign-in.tsx` — reuse form structure from US1; login tab hides name field, submit calls `signIn` instead of `signUp`. Tab switcher clears `error` state on toggle. **Test**: T016 tests pass (green)
- [ ] T019 [US2] Wire login success redirect and generic error messages in `src/app/sign-in.tsx` — map `invalid_credentials` Supabase error to generic localized message (FR-007: not revealing whether email exists). Honor `returnTo` param. **Test**: T017 tests pass (green)
- [ ] T020 [US2] Verify session persistence in `src/contexts/__tests__/SessionProvider.persistence.test.tsx` — test that `SessionProvider` on mount restores a previously stored session from `expo-sqlite`. Mock storage to return a valid session token, verify `session` is non-null after `isLoading` resolves to false. Verify session survives simulated app restart (unmount + remount provider). **Test**: this test file itself must pass green

**Checkpoint**: Full email auth cycle works. Users can register, log out, log back in, and sessions persist.

---

## Phase 5: User Story 3 — Google OAuth Sign-In (Priority: P2)

**Goal**: Users can sign in with their Google account; Google accounts link with existing email accounts

**Independent Test**: Tap Google button → complete Google consent → land on map view with Google display name

### TDD Tests for User Story 3

- [ ] T021 [P] [US3] Write Google Sign-In tests in `src/app/__tests__/sign-in.google.test.tsx` — test: (1) Google button renders on auth screen; (2) tapping Google button calls `signInWithGoogle`; (3) successful Google auth navigates to map; (4) Google auth failure shows localized error message; (5) loading state during Google flow disables all auth buttons

### Implementation for User Story 3

- [ ] T022 [US3] Install `@react-native-google-signin/google-signin`, configure Expo config plugin in `app.json`. Add Google Web Client ID to environment variables. Implement `signInWithGoogle` in `src/contexts/SessionProvider.tsx` — call `GoogleSignin.signIn()`, extract `idToken`, pass to `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`. On success, upsert profile in `profiles` table with `auth_provider: 'google'`. **Test**: T021 tests pass (green)
- [ ] T023 [US3] Implement Google-to-email account linking in `src/contexts/SessionProvider.tsx` — when Google signIn returns a user whose email matches an existing `profiles` row, Supabase automatically links the identity. Verify the profile row is updated (not duplicated) with `auth_provider` reflecting the latest method. **Test**: write `src/contexts/__tests__/SessionProvider.google-linking.test.tsx` — mock scenario where email-registered user signs in with Google; verify single profile row exists, `auth_provider` updated to `'google'`

**Checkpoint**: Google OAuth works. Users can sign in with Google; existing email accounts auto-link.

---

## Phase 6: User Story 4 — Apple Sign-In (Priority: P2)

**Goal**: Users can sign in with Apple ID (native on iOS, web fallback on Android); Apple relay emails work transparently

**Independent Test**: Tap Apple button → complete Apple auth → land on map view

### TDD Tests for User Story 4

- [ ] T024 [P] [US4] Write Apple Sign-In tests in `src/app/__tests__/sign-in.apple.test.tsx` — test: (1) Apple button renders on auth screen; (2) tapping Apple button calls `signInWithApple`; (3) successful Apple auth navigates to map; (4) Apple "Hide My Email" relay address is stored and functions normally; (5) Apple auth failure shows localized error

### Implementation for User Story 4

- [ ] T025 [US4] Implement `signInWithApple` in `src/contexts/SessionProvider.tsx` — on iOS: use `expo-apple-authentication` to call `AppleAuthentication.signInAsync`, extract `identityToken`, pass to `supabase.auth.signInWithIdToken({ provider: 'apple', token })`. Capture `credential.fullName` on first sign-in and store via `supabase.auth.updateUser({ data: { full_name } })` (Apple only sends name once). On Android: fall back to `supabase.auth.signInWithOAuth({ provider: 'apple' })`. Upsert profile with `auth_provider: 'apple'`. **Test**: T024 tests pass (green)
- [ ] T026 [US4] Handle Apple name capture edge case in `src/contexts/SessionProvider.tsx` — if `credential.fullName` is null (repeat sign-in), skip name update. If name was captured, update both `auth.users.user_metadata` and `profiles.full_name`. **Test**: write `src/contexts/__tests__/SessionProvider.apple-name.test.tsx` — mock first Apple sign-in with fullName present, verify profile updated; mock repeat sign-in with fullName null, verify profile name unchanged

**Checkpoint**: Apple Sign-In works on iOS (native) and Android (web fallback). Relay emails supported.

---

## Phase 7: User Story 5 — Forgot Password (Priority: P3)

**Goal**: Users can request a password reset email and set a new password via the reset link

**Independent Test**: Tap "Ai uitat parola?" → enter email → submit → see success message → (email sent with reset link)

### TDD Tests for User Story 5

- [ ] T027 [P] [US5] Write forgot password screen tests in `src/app/__tests__/forgot-password.test.tsx` — test: (1) screen renders with email input and submit button; (2) submit with invalid email shows validation error; (3) successful submission shows success message "Verifică inbox-ul și folderul spam. Link-ul expiră în 60 de minute."; (4) same success message shown for non-existent email (enumeration protection); (5) "Înapoi la conectare" link navigates to `/sign-in` with `initialTab: 'login'`; (6) loading state disables submit during request

### Implementation for User Story 5

- [ ] T028 [US5] Implement forgot password screen in `src/app/forgot-password.tsx` — upgrade existing `ForgotPasswordScreen` scaffold. Dark green background per spec (Screen 09 design). Lock icon, email input with mail icon, "Trimite link de resetare" button. Call `resetPassword(email)` from `useSession`. On response (success OR error), show identical success message (FR-007 enumeration protection). Add "Înapoi la conectare" back link. All strings via `useI18n`. **Test**: T027 tests pass (green)
- [ ] T029 [US5] Add "Ai uitat parola?" link to login tab in `src/app/sign-in.tsx` — below the password field on the login tab, add a touchable text link that navigates to `/forgot-password`. Style as muted text per design system. **Test**: write `src/app/__tests__/sign-in.forgot-link.test.tsx` — verify link renders on login tab (not signup tab), verify tap navigates to `/forgot-password`
- [ ] T040 [P] [US5] Write reset-password screen tests in `src/app/__tests__/reset-password.test.tsx` — test: (1) screen renders with new-password input and confirm button; (2) password <8 chars shows validation error; (3) successful password update shows success message and navigates to `/sign-in` with `initialTab: 'login'`; (4) expired/invalid token shows error with option to request new link; (5) already-used token shows "already used" message
- [ ] T041 [US5] Configure deep link URL scheme in `app.json` — add scheme for password reset links (e.g., `ttportal://reset-password`). Configure Supabase Auth redirect URL to use this scheme. Create `src/app/reset-password.tsx` — parse token from deep link URL params, show new-password form (with min 8 char validation), call `supabase.auth.updateUser({ password })` to set new password. Handle expired/used tokens with error message and "request new link" option. All strings via `useI18n`. **Test**: T040 tests pass (green)

**Checkpoint**: Full password reset flow works end-to-end. Users can request reset, receive email, click link, set new password, and log in with it.

---

## Phase 8: User Story 6 — Logout & Auth UI (Priority: P3)

**Goal**: Authenticated users see their initials in header, can open a popover, and log out; anonymous users see the auth entry point; gated actions redirect to sign-in

**Independent Test**: Log in → see initials icon in header → tap → see popover with name → tap "Deconectare" → icon reverts to anonymous → tap "Adaugă" → redirected to sign-in

### TDD Tests for User Story 6

- [ ] T030 [P] [US6] Write HeaderProfileIcon tests in `src/components/__tests__/HeaderProfileIcon.test.tsx` — test: (1) when anonymous, renders generic user icon; (2) when anonymous, tap navigates to `/sign-in`; (3) when authenticated, renders circle with user initials (first letter of first + last name); (4) when authenticated, tap opens popover with user name and "Deconectare" button; (5) initials use `Colors.green` background and `Colors.white` text
- [ ] T031 [P] [US6] Write profile popover tests in `src/components/__tests__/ProfilePopover.test.tsx` — test: (1) popover shows user full name; (2) popover shows user email (truncated if >25 chars); (3) tapping "Deconectare" calls `signOut`; (4) after signOut, popover closes and icon reverts to anonymous; (5) tapping outside popover closes it
- [ ] T032 [P] [US6] Write auth gate tests in `src/components/__tests__/AuthGate.test.tsx` — test: (1) when authenticated, children render normally; (2) when anonymous, navigates to `/sign-in?returnTo={currentRoute}`; (3) after auth completes, user is redirected to original `returnTo` route

### Implementation for User Story 6

- [ ] T033 [US6] Implement `src/components/HeaderProfileIcon.tsx` — when anonymous: render Lucide `user` icon (outline), onPress navigate to `/sign-in`. When authenticated: render 32px circle with initials extracted from `user.full_name` (first char of first name + first char of last name, uppercase), green background, white text. onPress: toggle popover visibility. **Test**: T030 tests pass (green)
- [ ] T034 [US6] Implement `src/components/ProfilePopover.tsx` — render below HeaderProfileIcon, right-aligned. Show user name (fallback "User"), email (truncated), and "Deconectare"/"Sign out" button. Tap logout calls `signOut()` from `useSession`, then closes popover. Dismiss on outside tap via `Pressable` overlay. **Test**: T031 tests pass (green)
- [ ] T035 [US6] Implement `src/components/AuthGate.tsx` — wrapper component that checks `useSession().session`. If null, navigate to `/sign-in` with `returnTo` param set to the intended route. Use on add-venue, write-review, and edit-venue trigger points. **Test**: T032 tests pass (green)
- [ ] T036 [US6] Integrate HeaderProfileIcon into app header — add to the header-right area in `src/app/(tabs)/_layout.tsx` (publicly accessible tab layout). Replace or augment existing header-right content (language toggle + add button). **Test**: write `src/app/(tabs)/__tests__/header-integration.test.tsx` — verify HeaderProfileIcon renders in the header; verify both anonymous and authenticated states display correctly

**Checkpoint**: Full auth lifecycle complete. Header shows auth state, popover provides logout, gated actions redirect properly.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Integration testing, i18n completeness, edge cases

- [ ] T037 [P] Run full i18n audit — verify every user-facing string in auth screens uses `useI18n`, no hardcoded Romanian or English strings. Verify `ro.json` and `en.json` have identical key sets. **Test**: write `src/__tests__/i18n-completeness.test.ts` — programmatically compare keys of both locale files; grep auth screen files for string literals that should be i18n keys
- [ ] T038 [P] Write edge case tests in `src/__tests__/auth-edge-cases.test.tsx` — test: (1) network drop during OAuth shows connection error and allows retry; (2) session expiry during active use prompts re-auth without losing map context; (3) registering with an OAuth-linked email shows "account exists" message suggesting the OAuth provider; (4) password reset link used twice shows "already used" message
- [ ] T039 Run `quickstart.md` verification checklist — validate: Expo starts without errors, dev build installs, Supabase connects, fonts load, navigation works between splash → sign-in → map, all screens render. **Test**: all previous tests pass (`npm test` exits 0 with no failures)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **User Stories (Phases 3-8)**: All depend on Phase 2 completion
  - US1 (Email Registration) and US2 (Email Login) can run in parallel
  - US3 (Google OAuth) and US4 (Apple Sign-In) can run in parallel
  - US5 (Forgot Password) depends on US2 (needs the "Ai uitat parola?" link on login tab)
  - US6 (Logout) can run independently after Phase 2
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 2 (Foundation)
  ├── US1 (Email Registration) ──┐
  ├── US2 (Email Login) ─────────┤──→ US5 (Forgot Password)
  ├── US3 (Google OAuth) ────────┤
  ├── US4 (Apple Sign-In) ───────┤
  └── US6 (Logout & Auth UI) ────┘
                                  └──→ Phase 9 (Polish)
```

### Within Each User Story (TDD cycle)

1. Write tests FIRST → verify they FAIL (red)
2. Implement → verify tests PASS (green)
3. Refactor if needed (keeping tests green)
4. Story complete when all its tests are green

### Parallel Opportunities

- **Phase 1**: T003, T004, T005 can run in parallel (different files)
- **Phase 2**: T006, T007 in parallel after T004 (both depend on supabase client + locale files)
- **Phase 3-4**: US1 and US2 tests can be written in parallel (T012-T013 ∥ T016-T017)
- **Phase 5-6**: US3 and US4 tests can be written in parallel (T021 ∥ T024)
- **Phase 8**: All US6 tests can be written in parallel (T030 ∥ T031 ∥ T032)
- **Phase 9**: T037 and T038 can run in parallel

---

## Parallel Example: User Story 1 + User Story 2

```bash
# Write all P1 tests in parallel (different test files):
Task T012: "Registration form validation tests in src/app/__tests__/sign-in.registration.test.tsx"
Task T013: "Registration flow tests in src/app/__tests__/sign-in.registration-flow.test.tsx"
Task T016: "Login form validation tests in src/app/__tests__/sign-in.login.test.tsx"
Task T017: "Login flow tests in src/app/__tests__/sign-in.login-flow.test.tsx"

# Then implement sign-in.tsx (shared file — sequential):
Task T014: "Implement registration form in src/app/sign-in.tsx"
Task T015: "Wire registration redirect in src/app/sign-in.tsx"
Task T018: "Implement login tab in src/app/sign-in.tsx"
Task T019: "Wire login redirect in src/app/sign-in.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Email Registration
4. Complete Phase 4: US2 — Email Login
5. **STOP and VALIDATE**: Full email auth cycle works end-to-end
6. Deploy/demo if ready — users can register and log in

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Registration) → Test → First accounts created (MVP!)
3. US2 (Login) → Test → Full email auth cycle
4. US3 + US4 (Google + Apple) → Test → Social login available
5. US5 (Forgot Password) → Test → Password recovery works
6. US6 (Logout + Header + Auth Gate) → Test → Complete auth UI
7. Polish → Test → Production-ready auth

### TDD Rhythm

For each task:
1. **Red**: Write the test. Run it. Watch it fail.
2. **Green**: Write the minimum implementation to make the test pass.
3. **Refactor**: Clean up while keeping the test green.
4. **Commit**: One commit per task (test + implementation together).

---

## Notes

- [P] tasks = different files, no dependencies on incomplete parallel tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- All tests MUST be written before implementation (TDD red-green cycle)
- Commit after each task (test + implementation together)
- Stop at any checkpoint to validate story independently
- Mock Supabase client in unit tests; use real client only for integration/E2E tests in Phase 9
- Total: 42 tasks across 9 phases
