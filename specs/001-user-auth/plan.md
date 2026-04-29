# Implementation Plan: User Authentication

**Branch**: `001-user-auth` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-user-auth/spec.md`

## Summary

Implement user authentication for TT Portal as a React Native (Expo) application. Covers email/password registration and login, Google OAuth, Apple Sign-In, forgot password flow, and a header profile icon with logout popover. Authentication is optional — venue browsing remains anonymous; write actions (add venue, review, edit) are gated behind login. Uses Supabase Auth as the backend with expo-router `Stack.Protected` for route protection. Bilingual RO/EN support carries over from the existing i18n dictionary.

## Technical Context

**Language/Version**: TypeScript 5.x, React Native 0.76+, React 18
**Primary Dependencies**: Expo SDK 53+, expo-router, @supabase/supabase-js, expo-sqlite, @react-native-google-signin/google-signin, expo-apple-authentication
**Storage**: Supabase (PostgreSQL) for user data; expo-sqlite for on-device session tokens
**Testing**: Jest + React Native Testing Library (unit/component); Detox or Maestro (E2E)
**Target Platform**: iOS 15+, Android 10+ (development build — not Expo Go)
**Project Type**: Mobile app (React Native + Expo)
**Performance Goals**: Auth screen renders in <1s; login/register completes in <2s excluding network
**Constraints**: Must use EAS Build (dev client) — Google Sign-In, Apple Sign-In, and MapLibre require native code incompatible with Expo Go
**Scale/Scope**: Initial launch ~1000 users (Romania market); 6 user stories, 24 functional requirements, 6 screens/components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution is unconfigured (template placeholders only). No gates to enforce. Proceeding.

**Post-Phase 1 re-check**: No violations — constitution has no active principles.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technology research & decisions
├── data-model.md        # Phase 1: auth entities & relationships
├── quickstart.md        # Phase 1: setup & onboarding guide
├── contracts/
│   └── ui-contracts.md  # Phase 1: screen & component contracts
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
src/
├── app/                           # Expo Router file-based routes
│   ├── _layout.tsx                # Root layout: SessionProvider, i18n, fonts
│   ├── index.tsx                  # Splash / city picker (entry point)
│   ├── sign-in.tsx                # Auth screen — signup/login tabs, OAuth
│   ├── forgot-password.tsx        # Password reset: send email
│   ├── reset-password.tsx         # Password reset: set new password (deep link target)
│   ├── (tabs)/                    # Tab navigator — publicly accessible (anonymous browsing)
│   │   ├── _layout.tsx            # Tab bar + header with profile icon
│   │   ├── index.tsx              # Map view (main screen)
│   │   ├── events.tsx             # Events tab (placeholder)
│   │   ├── leaderboard.tsx        # Leaderboard tab (placeholder)
│   │   ├── favorites.tsx          # Favorites tab (placeholder)
│   │   └── profile.tsx            # Profile tab (placeholder)
│   ├── venue/[id].tsx             # Venue detail — publicly accessible
│   └── (protected)/               # Auth-gated write routes only
│       ├── _layout.tsx            # Stack.Protected guard (requires session)
│       ├── add-venue.tsx          # Add venue
│       └── review/[venueId].tsx   # Write review
├── components/
│   ├── Icon.tsx                   # Lucide icon wrapper (existing)
│   ├── TabBar.tsx                 # Bottom navigation (existing)
│   ├── HeaderProfileIcon.tsx      # Auth-aware profile icon + popover
│   └── AuthGate.tsx               # Wrapper that redirects to sign-in if unauthenticated
├── contexts/
│   ├── SessionProvider.tsx        # Supabase auth state management
│   └── I18nProvider.tsx           # Language context (RO/EN)
├── hooks/
│   ├── useSession.ts              # Consume SessionProvider
│   └── useI18n.ts                 # Consume I18nProvider
├── lib/
│   ├── supabase.ts                # Supabase client init (expo-sqlite storage)
│   └── i18n.ts                    # i18n helpers, string resolution
├── screens/                       # Existing screen scaffolds (preserved)
│   └── *.tsx                      # 15 screen files from design system
├── theme.ts                       # Design tokens (existing)
└── locales/
    ├── ro.json                    # Romanian strings (extracted from STRINGS dict)
    └── en.json                    # English strings (extracted from STRINGS dict)
```

**Structure Decision**: Single mobile app using Expo Router file-based routing. Browse routes (tabs, venue detail) are publicly accessible outside any protected group so anonymous users can browse venues per FR-020. Only write-action routes (add-venue, review) are inside a `(protected)/` group using `Stack.Protected`. The existing `src/screens/` scaffolds are preserved as reference implementations. No backend code — Supabase handles all server-side logic (auth, database, storage).

## Complexity Tracking

No constitution violations to justify — constitution is unconfigured.
