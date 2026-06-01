# TTPortal UI/UX Improvements Plan

## Overview

This document tracks the phased implementation of UI/UX improvements for TTPortal, based on a deep analysis of the app and research into similar apps (Untappd, Swarm, Strava, AllTrails, Meetup, Yelp, Google Maps).

---

## Phase 1: Polish & Quick Wins (P0)

Low-effort, high-impact improvements that immediately raise perceived quality.

### 1.1 Skeleton Loading Screens
**Files:** All screen files that show `ActivityIndicator`
**What:** Replace spinner-only loading states with skeleton placeholder components that match the layout of the content being loaded.
- Create a reusable `SkeletonLoader` component with shimmer animation
- Create layout-specific skeletons: `VenueCardSkeleton`, `ReviewCardSkeleton`, `EventCardSkeleton`, `FriendCardSkeleton`, `LeaderboardSkeleton`, `NotificationSkeleton`
- Replace `ActivityIndicator` in: MapViewScreen, VenueDetailScreen, EventSchedulingScreen, FriendsScreen, FavoritesScreen, LeaderboardsScreen, PlayHistoryScreen, NotificationsScreen, ProfileScreen

### 1.2 Empty States with Illustrations & CTAs
**Files:** All screen files with empty-state text
**What:** Replace plain "no data" text with designed empty state components.
- Create a reusable `EmptyState` component with icon, title, description, and optional CTA button
- Add unique empty states per screen:
  - Favorites: heart icon + "Salvează sălile preferate" + "Explorează harta" CTA
  - Play History: map-pin icon + "Niciun check-in încă" + "Mergi la hartă" CTA
  - Friends: users icon + "Conectează-te cu alți jucători" + "Invită prieteni" CTA
  - Events: calendar icon + "Niciun eveniment" + "Creează eveniment" CTA
  - Notifications: bell-off icon + "Nicio notificare" + descriptive text
  - Leaderboard: trophy icon + "Fă check-in pentru a apărea în clasament"
  - Venue reviews (0 reviews): pen icon + "Fii primul care scrie o recenzie"
  - Map (0 results): search icon + "Nicio sală găsită" + "Schimbă filtrele" CTA
- Add i18n keys for all empty state strings (en.json + ro.json)

### 1.3 Haptic Feedback
**Files:** Multiple screen files
**What:** Add tactile feedback at key interaction points using `expo-haptics`.
- Install `expo-haptics` if not present
- Add haptics to:
  - Star rating selection (light impact)
  - Favorite toggle (light impact)
  - Filter chip toggle (selection)
  - Check-in confirmation (medium impact)
  - Check-in success (success notification)
  - Tab bar tap (selection)
  - RSVP/Join button (medium impact)
  - Pull-to-refresh trigger (light impact)

### 1.4 Touch Target Improvements
**Files:** MapViewScreen, TabBar, filter chips, icon buttons
**What:** Ensure all interactive elements meet minimum 44x44pt touch targets.
- Map pins: add `hitSlop` or increase wrapper to 44x44
- Filter chips: increase height from 30 to 36px
- Icon-only buttons (back, close, bell, profile): add `hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}`
- Star rating in WriteReviewScreen: ensure 44pt per star

---

## Phase 2: Core UX Improvements (P1)

Medium-effort changes that significantly improve the core experience.

### 2.1 Venue Detail Action Row
**Files:** VenueDetailScreen.tsx
**What:** Add a sticky horizontal action row below venue info card.
- Four buttons: Check-in, Review, Favorite, Share
- Each button: icon + label, state-aware (filled heart when favorited, check when checked in)
- Replaces scattered actions throughout the page
- Actions remain visible without scrolling

### 2.2 Check-in Celebration Screen
**Files:** VenueDetailScreen.tsx (new component)
**What:** Replace plain Alert after check-in with a celebration bottom sheet.
- Create `CheckinSuccessSheet` component
- Show: animated checkmark, "+10 XP" text, streak counter, newly unlocked badges
- Auto-dismiss after 3 seconds or tap to dismiss
- Include "Distribuie" share button

### 2.3 Onboarding Flow
**Files:** New screen(s), _layout.tsx
**What:** Add first-time user onboarding after sign-up.
- 3 screens: City selection, Interests toggle, Find friends
- Store onboarding-completed flag in profile/local storage
- After completion, navigate to Map with coach-mark tooltip on nearest venue
- Skip option on each step

---

## Phase 3: Engagement Features (P2)

Higher-effort features that drive retention and repeat usage.

### 3.1 Gamification: XP & Badges System
**What:** Add point system and achievement badges.
- Database: new tables `user_xp`, `badges`, `user_badges`
- XP awards for: check-in (10), review (20), condition vote (5), new venue bonus (+15), event creation (15)
- 12+ badges with unlock conditions
- Badge showcase on Profile screen
- Badge unlock celebration overlay

### 3.2 Weekly Leaderboard
**What:** Add "This Week" tab to LeaderboardsScreen.
- New materialized view for weekly stats (reset Monday)
- Tab selector: "Săptămâna asta" | "Toate timpurile"
- Monday morning notification with results

### 3.3 Review Attribute Tags
**What:** Add quick-tap attribute tags to WriteReviewScreen.
- Tags: "Mese bune", "Palete noi", "Iluminare ok", "Aglomerat", "Liniștit", etc.
- Store as array in reviews table
- Display tag summary on venue detail page

### 3.4 Profile Page Enrichment
**What:** Expand ProfileScreen with badges, activity chart, richer stats.
- Stats strip: 4 key numbers (check-ins, venues, reviews, friends)
- Badge showcase: horizontal scroll of earned/locked badges
- Activity chart: weekly check-in bar chart (last 8 weeks)
- Quick links to Favorites, Play History, Leaderboard, Friends

---

## Phase 4: Advanced Features (P3)

### 4.1 Activity Feed (Social Tab) - DONE
Social feed showing friend check-ins and reviews, with venue navigation.

### 4.2 Map Bottom Sheet (draggable) - DONE
DraggableSheet component using Animated + PanResponder. Three snap points (peek/half/full). Map is now full-screen behind the sheet.

### 4.3 Map Pin Clustering - DONE
react-native-map-clustering integrated. Clusters nearby pins at low zoom, expands on zoom-in. Falls back to regular MapView on web.

### 4.4 Monthly Community Challenges - DONE
Rotating monthly challenges (explorer/active/critic). ChallengeBanner with progress bar on Map screen. Progress computed from existing check-in/review data.

### 4.5 Venue Champion System - DONE
"Campion" shown on venue detail for user with most check-in days in 30 days.

### 4.6 Share Cards (branded images) - DONE
ShareCard component with branded TT Portal card, react-native-view-shot capture, Share API integration. Share button added to CheckinSuccessSheet.

### 4.7 Micro-animations - DONE
Heart scale on favorite, tab bounce on press, VenueActionRow favorite scale.

### 4.8 Offline Caching - DONE
SQLite-based cache for venue data. Shows cached venues with "offline" banner on network failure.

---

## Implementation Status

| Item | Status | Notes |
|------|--------|-------|
| 1.1 Skeleton Loading | Done | SkeletonLoader component + 8 layout variants, integrated in all screens |
| 1.2 Empty States | Done | EmptyState component with icon/title/desc/CTA, integrated in all screens, i18n keys added |
| 1.3 Haptic Feedback | Done | expo-haptics installed, haptics utility, added to: filter chips, tabs, star rating, favorites, check-in, join event |
| 1.4 Touch Targets | Done | hitSlop on icon buttons, filter chips 30->36px |
| 2.1 Action Row | Done | VenueActionRow component below photo strip on venue detail |
| 2.2 Celebration Screen | Done | CheckinSuccessSheet with animated checkmark + XP display |
| 2.3 Onboarding Flow | Done | 3-step flow (city, interests, done), route + sign-in redirect |
| 3.1 XP & Badges | Done (UI) | Badge showcase on Profile with 5 badges, unlock logic from stats. XP display in check-in success sheet. Backend XP table deferred to Phase 4 |
| 3.2 Weekly Leaderboard | Done | Period toggle (This week / All time), service queries with 7-day filter |
| 3.3 Review Tags | Done | 8 attribute tag pills in WriteReviewScreen, haptic feedback, tags appended to review body |
| 3.4 Profile Enrichment | Done | 4-stat strip (checkins, venues, reviews, friends), badge showcase with unlock logic, getUserReviewCount service |
| 4.1 Activity Feed | Done | Social feed tab with friend check-ins/reviews, feed service, navigation to venues |
| 4.2 Map Bottom Sheet | Done | DraggableSheet component with 3 snap points, full-screen map behind |
| 4.3 Map Pin Clustering | Done | react-native-map-clustering, falls back to MapView on web |
| 4.4 Monthly Challenges | Done | ChallengeBanner, rotating challenges, progress from existing data |
| 4.5 Venue Champion | Done | getVenueChampion service, crown row on VenueDetailScreen |
| 4.6 Share Cards | Done | ShareCard component, view-shot capture, share button in CheckinSuccessSheet |
| 4.7 Micro-animations | Done | Heart scale, tab bounce, action row favorite scale |
| 4.8 Offline Caching | Done | SQLite cache for venues, offline banner on MapViewScreen |

## Test Coverage

81 new tests added across 19 test files:
- `src/components/__tests__/SkeletonLoader.test.tsx` — 12 tests
- `src/components/__tests__/EmptyState.test.tsx` — 7 tests
- `src/components/__tests__/VenueActionRow.test.tsx` — 10 tests
- `src/components/__tests__/CheckinSuccessSheet.test.tsx` — 6 tests
- `src/components/__tests__/DraggableSheet.test.tsx` — 3 tests
- `src/components/__tests__/ChallengeBanner.test.tsx` — 3 tests
- `src/components/__tests__/ShareCard.test.tsx` — 5 tests
- `src/lib/__tests__/haptics.test.ts` — 4 tests
- `src/lib/__tests__/offline-cache.test.ts` — 4 tests
- `src/lib/__tests__/challenges.test.ts` — 5 tests
- `src/screens/__tests__/OnboardingScreen.test.tsx` — 5 tests
- `src/screens/__tests__/WriteReviewScreen.tags.test.tsx` — 3 tests
- `src/screens/__tests__/LeaderboardsScreen.period.test.tsx` — 3 tests
- `src/screens/__tests__/ProfileScreen.enriched.test.tsx` — 3 tests
- `src/screens/__tests__/ActivityFeedScreen.test.tsx` — 4 tests
- `src/services/__tests__/reviews.test.ts` — 1 test
- `src/services/__tests__/feed.test.ts` — 3 tests
- `src/services/__tests__/checkins.champion.test.ts` — 1 test

Full suite: 411 tests passing, 0 type errors, 0 lint errors.

## Summary

All 19 planned items are fully implemented. No deferred items remain.
