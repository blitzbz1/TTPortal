# Quickstart: User Authentication

**Branch**: `001-user-auth` | **Date**: 2026-03-26

---

## Prerequisites

- Node.js 18+
- Expo CLI (`npx expo`)
- EAS CLI (`npm install -g eas-cli`) — required for development builds
- Apple Developer account (for Apple Sign-In)
- Google Cloud project with OAuth 2.0 credentials
- Access to existing Supabase project (`vzewwlaqqgukjkqjyfoq.supabase.co`)

## Environment Setup

### 1. Initialize Expo project

The project needs to be initialized with Expo Router and TypeScript. The existing `src/` scaffold (screens, components, theme) should be preserved and integrated into the Expo Router file structure.

### 2. Install dependencies

Core packages needed:

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Supabase client (auth, DB, storage) |
| `expo-sqlite` | Session storage for Supabase auth |
| `react-native-url-polyfill` | URL polyfill for React Native |
| `@react-native-google-signin/google-signin` | Native Google Sign-In |
| `expo-apple-authentication` | Native Apple Sign-In |
| `expo-router` | File-based navigation |
| `expo-font` | Load Syne + DM Sans fonts |
| `@maplibre/maplibre-react-native` | Native maps (not auth-specific, but needed for map view) |

### 3. Supabase Dashboard Configuration

1. **Enable Email auth** — Authentication > Providers > Email (should already be on)
2. **Enable Google provider** — Add Web Client ID and Client Secret from Google Cloud Console
3. **Enable Apple provider** — Add Services ID, Team ID, and signing key from Apple Developer Portal
4. **Create `profiles` table** — Public schema table mirroring auth entity from `data-model.md`
5. **Disable email confirmation** — Authentication > Settings > toggle off "Enable email confirmations" (per clarification: no email verification)

### 4. Environment Variables

Create `.env` at project root:

```
EXPO_PUBLIC_SUPABASE_URL=https://vzewwlaqqgukjkqjyfoq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from existing config.js>
```

**Note**: The `EXPO_PUBLIC_` prefix makes these accessible in client code. The anon key is safe to expose because Supabase Row Level Security protects the database.

### 5. Development Build

Google Sign-In, Apple Sign-In, and MapLibre all require native code. You **cannot** use Expo Go. Use one of:

- `npx expo run:ios` (local iOS simulator)
- `npx expo run:android` (local Android emulator)
- `eas build --profile development` (cloud build)

## Verification Checklist

After setup, verify these work:

- [ ] `npx expo start` launches without errors
- [ ] Development build installs on simulator/device
- [ ] Supabase client connects (test with a simple query to `cities` table)
- [ ] Fonts (Syne, DM Sans) load correctly
- [ ] Navigation between splash → sign-in → map works
- [ ] Existing screens render (using scaffolded screen components)

## Key Files to Create (implementation order)

1. `src/lib/supabase.ts` — Supabase client initialization with expo-sqlite storage
2. `src/contexts/SessionProvider.tsx` — Auth context with session state
3. `src/hooks/useSession.ts` — Hook to consume auth context
4. `src/lib/i18n.ts` + `locales/ro.json` + `locales/en.json` — i18n migration
5. `src/app/_layout.tsx` — Root layout with SessionProvider
6. `src/app/sign-in.tsx` — Auth screen (upgrade existing SignupLoginScreen)
7. `src/app/forgot-password.tsx` — Password reset screen (upgrade existing ForgotPasswordScreen)
8. `src/app/(app)/_layout.tsx` — Protected route group with Stack.Protected
9. Header profile icon component with popover
10. Auth gate wrappers on add venue, write review, edit venue triggers

## Existing Code to Migrate

| Source (vanilla JS) | Target (React Native) | Action |
|--------------------|-----------------------|--------|
| `js/ui.js` STRINGS dict | `locales/ro.json` + `locales/en.json` | Extract ~80 string keys |
| `js/config.js` Supabase init | `src/lib/supabase.ts` | Rewrite with expo-sqlite storage |
| `src/screens/SignupLoginScreen.tsx` | `src/app/sign-in.tsx` | Add TextInput, validation, auth calls |
| `src/screens/ForgotPasswordScreen.tsx` | `src/app/forgot-password.tsx` | Add form logic, Supabase resetPassword |
| Header bar in `index.html` | Header component | Add profile icon with auth state |
