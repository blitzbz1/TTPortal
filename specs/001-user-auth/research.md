# Research: User Authentication — React Native + Expo + Supabase

**Branch**: `001-user-auth` | **Date**: 2026-03-26

---

## R-001: Session Storage in React Native

**Decision**: Use `expo-sqlite` (via its `localStorage` export) for Supabase session persistence.

**Rationale**: Current official recommendation from Expo and Supabase docs. `expo-secure-store` has a 2048-byte value limit that OAuth sessions (especially Google/Apple) routinely exceed, causing crashes. `@react-native-async-storage/async-storage` works but is the older pattern being phased out.

**Alternatives considered**:
- `expo-secure-store` — rejected due to 2048-byte limit breaking OAuth tokens
- `@react-native-async-storage/async-storage` — works but deprecated recommendation
- Custom encrypted SQLite — over-engineered for current needs; can upgrade later if required

**Configuration note**: Must set `detectSessionInUrl: false` in Supabase client config for React Native (no browser URL bar).

---

## R-002: Google OAuth in Expo

**Decision**: Use `@react-native-google-signin/google-signin` with Supabase `signInWithIdToken`.

**Rationale**: Official recommendation from both Expo and Supabase docs. Uses native Google sign-in UI (not a web redirect), providing the best UX. The `signInWithIdToken` pattern avoids known `setSession` hanging issues.

**Alternatives considered**:
- `expo-auth-session` — not recommended by current Expo docs for Google Sign-In
- Web-based OAuth redirect — worse UX on mobile, requires browser switch

**Critical requirements**:
- Must use the **Web Client ID** (not Android/iOS client ID) in `GoogleSignin.configure()`
- SHA-1 fingerprints required for Android builds
- Google provider must be enabled in Supabase Dashboard
- **Cannot use Expo Go** — requires EAS Build or development build

---

## R-003: Apple Sign-In in Expo

**Decision**: Use `expo-apple-authentication` with Supabase `signInWithIdToken`.

**Rationale**: Official Expo SDK package. Native iOS integration provides best UX; falls back to OAuth web flow on Android.

**Alternatives considered**:
- `supabase.auth.signInWithOAuth({ provider: 'apple' })` on all platforms — rejected because native iOS UX is significantly better
- Omit Android support — rejected; OAuth web flow provides acceptable fallback

**Critical gotchas**:
- Apple only sends user's full name on **first sign-in** — must capture and store immediately via `supabase.auth.updateUser({ data: { full_name } })`
- iOS: native flow via `expo-apple-authentication`
- Android: web OAuth flow via `signInWithOAuth` (opens browser)
- Requires Apple Developer account with Services ID configured
- Apple signing key must be rotated every 6 months for OAuth flow

---

## R-004: Navigation & Auth-Gated Routes

**Decision**: Use `expo-router` (SDK 53+) with `Stack.Protected` for declarative route protection.

**Rationale**: Expo Router is the officially recommended navigation solution. `Stack.Protected` provides declarative auth gating — when the guard flips, history entries are automatically cleaned up. File-based routing simplifies navigation structure.

**Alternatives considered**:
- React Navigation (manual) — more boilerplate, no file-based routing
- Custom redirect HOC — reinventing what `Stack.Protected` provides natively

**Auth gating pattern**:
- Unprotected routes: sign-in, forgot-password (accessible without session)
- Protected routes: all screens inside `(app)/` group
- Gated write actions (add venue, review, edit): check auth state before navigating; redirect to sign-in with return intent stored

---

## R-005: Maps Library

**Decision**: Use `@maplibre/maplibre-react-native` for native platforms; `react-leaflet` for web.

**Rationale**: MapLibre is the leading open-source native maps library. Supports any tile source including OpenStreetMap. OpenStreetMap tile servers actively block Android requests from `react-native-maps`, making it unsuitable. Platform-specific files (`.native.tsx` / `.web.tsx`) allow code splitting.

**Alternatives considered**:
- `react-native-maps` with UrlTile — rejected; OSM tiles blocked on Android
- `react-native-maps` with Google tiles — requires Google Maps API key and billing
- WebView + Leaflet — works but inferior performance to native rendering

**Note**: MapLibre requires a development build (cannot use Expo Go). For styled tiles, MapTiler offers a free tier.

---

## R-006: Project Structure

**Decision**: Follow Expo-recommended `src/app/` file-based routing structure with existing `src/` scaffold.

**Rationale**: Aligns with Expo Router conventions. Keeps route files thin, delegates complex UI to screen components. Existing `src/screens/`, `src/components/`, and `src/theme.ts` can be preserved and integrated.

**Structure** (auth-relevant paths):
```
src/
├── app/
│   ├── _layout.tsx          # Root layout: providers (Session, i18n)
│   ├── index.tsx             # Splash / city picker
│   ├── sign-in.tsx           # Auth screen (unprotected)
│   ├── forgot-password.tsx   # Password reset (unprotected)
│   └── (app)/
│       ├── _layout.tsx       # Stack.Protected guard + tabs
│       ├── (tabs)/
│       │   ├── _layout.tsx   # Tab bar layout
│       │   ├── index.tsx     # Map view
│       │   └── profile.tsx   # Profile (future)
│       ├── venue/[id].tsx    # Venue detail
│       ├── add-venue.tsx     # Add venue (auth-gated)
│       └── review/[venueId].tsx  # Write review (auth-gated)
├── components/
├── contexts/
│   └── SessionProvider.tsx
├── lib/
│   ├── supabase.ts
│   └── i18n.ts
├── hooks/
│   └── useSession.ts
└── theme.ts
```

---

## R-007: i18n Approach

**Decision**: Migrate existing STRINGS dictionary to JSON locale files consumed by a lightweight React context + hook.

**Rationale**: The existing app has a complete bilingual dictionary (RO/EN) in `js/ui.js`. Extracting to `locales/ro.json` and `locales/en.json` preserves all translations. A custom context/hook (`useI18n`) is lighter than `react-i18next` for only 2 languages and ~80 string keys.

**Alternatives considered**:
- `react-i18next` + `i18next` — overkill for 2 languages; adds ~40KB
- `expo-localization` only — handles detection but not string management

---

## R-008: Development Build Requirement

**Decision**: Use EAS Build (development client) from the start; do not target Expo Go.

**Rationale**: Three core dependencies — Google Sign-In, Apple Sign-In, and MapLibre — all require custom native code that is incompatible with Expo Go. Starting with a dev build avoids maintaining two code paths.

**Impact**: Developers must run `npx expo run:ios` or `npx expo run:android` (or use EAS Build) instead of scanning a QR code with Expo Go.
