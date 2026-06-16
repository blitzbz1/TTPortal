# TTPortal — New Feature Tasks

Derived from [features_suggestions.md](features_suggestions.md) (2026-06-10, grounded at commit `9a48d1e`). Tasks compiled 2026-06-13, accounting for the [improvement_suggestions_tasks.md](improvement_suggestions_tasks.md) work that has since landed (security migration series **082–099 applied to prod 2026-06-11**; admin-moderation tab split + migrations **100–103** committed). Each task references its source feature (§), lists concrete files, steps, and acceptance criteria.

> This file turns the 30 feature sketches into actionable engineering tasks, **re-ordered by the source's dependency-aware build order** rather than by theme. Every task keeps its source `§` so the *why* lives in [features_suggestions.md](features_suggestions.md); these tasks carry the *how*.

## Conventions

- **ID:** `F###` — stable references, grouped by phase (kept distinct from the improvement work's `T###` and the deferred `C###`). Phases are ordered; tasks inside a phase marked `[P]` touch different files and can run in parallel.
- **Priority / Size:** preserved verbatim from the source's own scoring — priority `must-have` · `high` · `medium` · `low`; size `small` ≤ ~2 days · `medium` ~3–6 days · `large` > 1 week.
- **Migrations:** **000–099 are frozen** (applied to prod) and **100–103 are committed but pending apply** — never edit them. New feature migrations start at **104+**; the numbers below are *indicative placeholders* — assign the next free number at creation time and keep each feature's RLS/trigger changes in **one** consecutive migration (the §2.8 single-series rule). Add a matching pgTAP assertion (`supabase/.migration-test/` harness + `supabase/tests/database/`, run via `npm run test:db`) for every RLS/trigger change.
- **Notifications:** **do not add per-feature boolean columns.** Register a new category in `profiles.notification_prefs` (jsonb, migration 097) and route every push through `create_and_send_notification`, which already gates on `notification_pref_enabled()`. Add the category toggle to the Settings notification center and a deep-link branch to `src/lib/notificationRoutes.ts` (T007). **No Realtime** — push + fetch-on-focus only (egress postmortem stands).
- **User-generated content:** every UGC feature (a) adds a `content_reports` type surfaced in `src/screens/AdminModeration/ReportsTab.tsx`, (b) calls `ugc_suspicious()` (migration 098) to soft-flag on insert (never blocks), (c) filters reads through `user_blocks` (072), and (d) seeds `rate_limit_config` rows with BEFORE INSERT triggers mirroring migration 047.
- **Architecture (CLAUDE.md):** new domains land under `src/features/<domain>/` (types + api + hooks + domain logic behind one `index.ts`), following `src/features/challenges/`. Data access is react-query hooks shaped like `useLeaderboardQuery` — queryFn calls the service and mirrors to a domain cache via `saveCached*`; `initialData` hydrates from `loadCached*`.
- **i18n / a11y:** every user-facing string ships in all 8 locales (`src/locales/*.json`); `en.json` is the source of truth, the 6 machine-translated locales (de/it/fr/es/pl/cs) are flagged for native review. New screens follow the existing a11y conventions (labels, hit targets, contrast).
- **Done = tested:** `npm test && npm run lint && npm run typecheck` green; `npm run deadcode` (knip) clean of new orphans; relevant `.maestro/flows/` flow added for user-facing journeys.

> **Cross-cutting prerequisites — all SHIPPED (so Themes 1 & 4 are unblocked):**
> - **Presence leakage closed** — RPCs derive identity from `auth.uid()` (T004/§1.2); `checkins` SELECT scoped to self+friends with an anonymous count RPC `get_venue_active_checkin_count` (T010/§1.3, migration 084).
> - **Check-in visibility control** — `profiles.checkin_visibility` (`friends` default | `private`) (T018/§9.5, migration 091). Open Play (F020) extends this enum with `public`.
> - **Notification preference center** — `notification_prefs` jsonb + `notification_pref_enabled()` gate (T086/§9.7, migration 097).
> - **Trust & safety groundwork** — `moderation_audit_log`, `ugc_suspicious()`, `moderation_keywords` (T089/§9.10, migration 098).
> - **Geo foundation (PENDING APPLY)** — PostGIS `geom`+GIST and `get_venues_near` are written as migration **102** (T027) but **not yet applied to prod**. Gate the geo-heavy steps (F010 pin dots/near-me, F021 rating-proximity & "near me") on 102 landing; until then fall back to lat/lng bbox.

## Task index

| Phase | Tasks | Theme | Notes |
|---|---|---|---|
| 1 — Foundation primitives | F001–F002 | §1.2, §3.1 | small but unblock the social + rating chains; build first |
| 2 — Live venue intelligence | F010–F016 | Theme 2 | independent; feeds the B2B data flywheel immediately |
| 3 — Find players & play now | F020–F023 | Theme 1 | prerequisites shipped; F020/F021 need F001 |
| 4 — Competitive layer | F030–F034 | Theme 3 | rating chain; all derive from F002 |
| 5 — Clubs, community & growth | F040–F042 | Theme 4 | F042 needs the moderation infra (shipped) |
| 6 — Habit & retention | F050–F054 | Theme 5 | independent; any order |
| 7 — Training & gear | F060–F063 | Theme 6 | F061 consumes F060's hours |

---

## Phase 1 — Foundation primitives

> Small, and everything social or competitive builds on them. Ship before Phases 3–4.

### F001 [P] · Skill level & play goals on profile + venue player-mix — §1.2 `must-have` `small`
**Files:** `supabase/migrations/104_profiles_skill_goals.sql` (new), `src/app/(auth)/` onboarding step 2, `src/services/profiles.ts`, `src/screens/ProfileScreen.tsx`, `src/screens/PlayerProfileScreen.tsx`, `src/screens/FriendsScreen.tsx`, `src/hooks/queries/useVenueDetailQuery.ts`
- [x] Migration: add `profiles.skill_level` (enum: `new`/`casual`/`club`/`competitive`) and `profiles.play_goals text[]` (casual rallies / competitive matches / training partner / doubles); extend the 085 column-grant pattern so both are publicly readable.
- [x] **Persist the currently-discarded onboarding interest selections** (flagged half-built in the code inventory) into `play_goals`; add the two pickers as onboarding step 2 and to profile edit.
- [x] Add a `get_venue_player_mix(p_venue_id)` RPC returning an anonymized label ("Mostly casual & club") only when ≥5 distinct recent visitors have a level set (honor the mspec 5-user aggregation threshold).
- [x] Surface level chips on `ProfileScreen`/`PlayerProfileScreen`/friend lists (extend the `get_profile_stats` RPC, 051, and friends payloads); fold the player-mix line into the venue detail bundle (`get_venue_detail`, 044).
- [x] Tests: pgTAP for the 5-user threshold (4 visitors → null, 5 → label); jest for the chips + onboarding persistence; locale keys ×8.

**Done when:** a new user's onboarding goal selection survives to their profile; level chips render on profiles/friends; a venue with ≥5 levelled visitors shows an anonymized mix and 4 shows the empty state.

### F002 · Match recording with opponent confirmation — §3.1 `must-have` `medium`
**Files:** `supabase/migrations/105_matches.sql` (new), `src/features/matches/` (new domain), `src/screens/VenueDetailScreen.tsx`, `src/screens/EventDetailScreen.tsx`, `src/screens/PlayerProfileScreen.tsx`, `src/screens/ProfileScreen.tsx`, `src/components/NotificationInboxModal.tsx`
- [x] Migration: `matches` (player_a, player_b, winner_id, `sets jsonb`, venue_id/event_id refs, `status`: `pending`/`confirmed`/`disputed`/`void`, created_at, confirmed_at) with participant-only RLS; confirm/dispute RPCs modeled on the **existing half-built `requestOtherPlayerValidation`/`respondToChallengeValidation`** layer (productize it); `get_player_matches` RPC; venue match-count folded into the venue bundle (044).
- [x] Triggers/cron: confirm-notification via `create_and_send_notification` (new `match_confirm` category); pg_cron auto-confirm after 72h; void after a second dispute; `rate_limit_config` row (047).
- [x] Client domain `src/features/matches/`: types + service + `useMatchesQuery`/`useLogMatchMutation` (useLeaderboardQuery shape).
- [x] UI: "Log Match" on the venue action row (when checked in), event detail, and friends' profiles; opponent picker; per-set score stepper with best-of-3/5/7 presets; inline **Confirm/Dispute** card reusing the existing inline friend-request-accept interaction in `NotificationInboxModal`; a W/L-coded "Matches" row on Profile.
- [x] Tests: pgTAP (RLS, confirm/dispute/auto-confirm/void, only-confirmed-counts); jest for the score stepper + hook; maestro flow `log_match`.

**Done when:** A logs a match, B confirms via the inline card, it shows confirmed on both profiles; an unconfirmed match never counts; a twice-disputed match voids; 72h-stale pending auto-confirms.

---

## Phase 2 — Live venue intelligence (the B2B data flywheel)

> Independent of Phase 1; each turns check-in exhaust into the "should I go now?" signal and richer paid-tier data.

### F010 · Live busyness + typical-hours histogram — §2.1 `must-have` `medium`
**Files:** `supabase/migrations/106_venue_busyness.sql` (new), `src/hooks/queries/useVenueDetailQuery.ts`, `src/screens/VenueDetailScreen.tsx`, `src/screens/MapViewScreen.tsx`, `src/components/VenueMarkers.tsx`
- [x] Migration: `venue_busyness_hourly` materialized view (12-week trailing window) with a daily pg_cron refresh (018 pattern); `get_venue_busyness(venue_id)` RPC (per-hour histogram + weekday selector); a light `get_live_venue_counts(p_city_id)` for pin dots. **Counts only, no identities** — reuse `get_venue_active_checkin_count` (084) for the live number.
- [x] Generalize the existing friends-presence pin badge to an anonymous live-count dot for *all* venues with active check-ins; map callouts + list rows show it.
- [x] Venue detail Busyness block: live line ("3 here now · 5 tables") + histogram ("usually busy ~19:00") + "not enough data yet — check in to help" empty state; fold the live count into the venue bundle (044).
- [x] Note: shares aggregates with mspec Phase 2 peak-hours heatmap — build the view once, serve both.
- [x] Tests: pgTAP (counts anonymous; MV refresh correctness); jest for histogram + empty state.

**Done when:** an active check-in makes a venue's pin show an anonymous count within the refresh window; venue detail shows a populated histogram for a busy venue and the empty state for a quiet one.

### F011 [P] · One-tap free-table reports — §2.2 `must-have` `small`
**Files:** `supabase/migrations/107_table_reports.sql` (new), `src/components/CheckinSuccessSheet.tsx`, `src/screens/VenueDetailScreen.tsx`, `src/hooks/queries/useVenueDetailQuery.ts`
- [x] Migration: `table_reports` (venue_id, user_id, free_count, group_size nullable, created_at) with insert-own RLS + rate limiting (047); latest-fresh aggregate (decays ~90 min) joined into the venue bundle (044) and `get_live_venue_counts`; pg_cron cleanup after 24h.
- [x] Prompt on the check-in success sheet + venue detail: "How many tables are free? 0/1/2/3+" scaled to the venue's known table count, with an optional group-size stepper; render "1 table free · reported 12 min ago", **anonymous** to viewers.
- [x] Tests: pgTAP (rate limit, freshness decay, anonymity); jest for the prompt + decay label.

**Done when:** a report from someone on-site shows on venue detail with a freshness timestamp, decays after ~90 min, and is rate-limited.

### F012 [P] · Structured amenities, fees & access — §2.3 `must-have` `small`
**Files:** `supabase/migrations/108_venue_amenities.sql` (new), `src/components/VenueChangeRequestModal.tsx`, `src/components/VenueFormFields.tsx`, `src/screens/VenueDetailScreen.tsx`, `src/services/venuesDelta.ts`, `src/screens/MapViewScreen.tsx`
- [x] Migration: `venues.amenities jsonb` (rental, ball vending, showers/lockers, parking, wheelchair, café/water, entry fee `free`/`day pass`/`membership`, BYO net) included in `get_venues_delta` (045) and the venue bundle (044); extend the `venue_change_requests` payload (078/080) and the admin apply function — **no new service**, it flows through the existing review queue.
- [x] Venue info grid gains a second section with ✓ / ✗ / "unknown — know this? Tell us" rows that open the existing Suggest-an-Edit modal (now extended with these fields via `VenueFormFields`).
- [x] Add "Free entry" and "Rental available" search chips on the map.
- [x] Tests: jest for the grid + edit flow; pgTAP/integration that an amenity edit lands in the admin queue and applies.

**Done when:** unknown amenities prompt an edit that flows through the existing moderation queue, and the two new search chips filter the map.

### F013 [P] · Weather-aware outdoor play assistant — §2.4 `high` `medium`
**Files:** `supabase/functions/weather-proxy/` (new), `supabase/migrations/109_weather_cache.sql` (new), `src/screens/VenueDetailScreen.tsx`, `src/screens/EventDetailScreen.tsx`, `src/screens/MapViewScreen.tsx`
- [x] Edge function `weather-proxy` calling Open-Meteo (free, keyless) keyed off the city catalog's map-center lat/lng; `weather_cache` table at ~30-min TTL following the `amatur_cache` pattern (022). No venue schema changes.
- [x] Outdoor venues + events held there show a weather chip ("18° · dry until 20:00"); wind warning >25 km/h.
- [x] When rain is imminent in the selected city, a dismissible Map banner offers "Rain expected ~17:00 — show indoor venues?" that one-tap applies the existing Indoor filter chip.
- [x] Tests: `npm run test:functions` (deno) for the proxy/cache; jest for the chip + banner + dismiss.

**Done when:** an outdoor venue shows a live weather chip, and the rain banner toggles the indoor filter in one tap and stays dismissed for the session.

### F014 [P] · Home venue & regulars — §2.6 `medium` `small`
**Files:** `supabase/migrations/110_home_venue.sql` (new), `src/services/profiles.ts`, `src/screens/ProfileScreen.tsx`, `src/screens/SettingsScreen.tsx`, `src/hooks/queries/useVenueDetailQuery.ts`
- [x] Migration: `profiles.home_venue_id` + `profiles.show_as_regular bool`; privacy-filtered "Regulars" (count + opt-in avatar list) folded into the venue bundle (044); auto-suggestion query over existing check-in history.
- [x] Profile/player cards show "@dana · plays at Prater Park"; venue detail gets a Regulars row; a Settings toggle controls public visibility.
- [x] Note: distinct from the planned mspec Phase 4 Follow system (a notification subscription) — this is public identity.
- [x] Tests: pgTAP (opt-out hides from the regulars list); jest for the home-venue suggestion + toggle.

**Done when:** picking a home venue surfaces it on the profile and adds the user to that venue's Regulars list, and the visibility toggle removes them.

### F015 [P] · City guide for traveling players (public web route) — §2.7 `medium` `medium`
**Files:** `supabase/migrations/` (RPC only — no new tables), `src/app/city/[id].tsx` (new web route), `src/services/` city guide service
- [x] One **anon-readable** `get_city_guide(city_id)` RPC aggregating existing data: hero stats, best outdoor tables, indoor halls, free-access list, this week's events, recurring sessions, city leaderboard podium (070 city counts + events + 040 weekly leaderboard).
- [x] Expose a public shareable web route `/city/[id]` (expo-router) readable pre-install; reuse the leaderboard podium + venue card components.
- [x] SEO: title/description/OG tags so it doubles as an acquisition surface.
- [x] Tests: jest/web export (`expo export --platform web`) renders the route anon; pgTAP that the RPC is anon-granted and leaks no private data.

**Done when:** `/city/<id>` renders a useful guide for a logged-out visitor on web with correct OG metadata.

### F016 · Venue board & Q&A — §2.5 `medium` `medium`
**Files:** `supabase/migrations/111_venue_posts.sql` (new), `src/features/venueBoard/` (new), `src/screens/VenueDetailScreen.tsx`, `src/screens/AdminModeration/ReportsTab.tsx`
- [x] Migration: `venue_posts` (self-FK for one reply level, helpful-vote, soft delete) with RLS; **block filtering via `user_blocks`**; `content_reports` type `venue_post` into the moderator queue (072/081) + `ugc_suspicious()` soft-flag (098); answer-notification trigger via `create_and_send_notification` (new category); rate limits (047); a **paged read RPC kept separate from the venue bundle** to keep detail light.
- [x] Board section below reviews: short questions/notes, one reply level + helpful vote, asker gets a push on answer, posts >60 days collapse; reserve space for a future "Answered by venue" badge.
- [x] Tests: pgTAP (block filtering, report flow, RLS); jest for the board + reply + collapse.

**Done when:** a question posts, a reply notifies the asker, blocked users are filtered, and reports land in the existing admin Reports tab.

---

## Phase 3 — Find players & play together now (Theme 1)

> Presence prerequisites are shipped. Open Play and Find Players widen presence visibility — keep every new surface opt-in and RLS-enforced.

> **✅ SHIPPED.** Migrations: **114** `notifications_type_check` backfill (fixes a latent bug — `match_confirm`/`match_confirmed`/`match_disputed` from 105 and `venue_post_reply` from 112 were never added to the CHECK, so those cross-user notifications would have raised a `check_violation` and rolled back the action; the shipped tests only exercised self-reply / non-notifying paths so it was never hit), **115** F020 open play, **116** F021 find players, **117** F022 crossed paths, **118** F023 direct messages. Domains under `src/features/{openplay,findPlayers,messaging}` + `useCrossedPathsQuery`. New notification categories: `open_play`, `match_invites`, `messages`. pgTAP: `f020`–`f023` + `notifications_type_backfill`. `checkin_visibility` extended with `public` (091's policy/feed/at-venue functions reproduced). `npm test` (1116) + `lint` + `typecheck` green; locale keys ×8 added; maestro flows `open_play_broadcast` + `direct_message`. **Deferred:** rating-proximity filter on F021 (gated on F030/Elo, Phase 4); the city-wide `get_open_play` RPC exists in 115 but has no client surface yet.

### F020 · Open Play Broadcast — "looking for players" — §1.1 `must-have` `large`
**Depends on:** F001 (skill chips on the join sheet).
**Files:** `supabase/migrations/112_open_play.sql` (new), `src/features/openplay/` (new), `src/components/CheckinDurationModal.tsx`, `src/screens/MapViewScreen.tsx`, `src/components/VenueMarkers.tsx`, `src/screens/VenueDetailScreen.tsx`
- [x] Migration: `ALTER checkins ADD open_to_play boolean, session_note text` (120-char); `play_intents` (future-intent: now / +1h / tonight / tomorrow + note + `friends_only|public`) + `play_intent_joins` tables with RLS; **extend `checkin_visibility` (091) with `public`**; `get_open_play(p_city)` RPC; a one-active-broadcast guard mirroring the simultaneous-check-in guard; pg_cron expiry sweep (auto-expire with the check-in / time window); `rate_limit_config` rows (047).
- [x] Notifications: register a `play_broadcast` category in `notification_prefs` (097) and fan out to in-city friends + venue-favoriters via `create_and_send_notification` — **not** a standalone `notify_play_broadcasts` column (supersedes the source's sketch).
- [x] Client: "Looking for players" toggle + note on `CheckinDurationModal`; pulsing ring on the venue pin + "Playing now — join them" row in the map sheet and on venue detail; "Plan a session" action; "I'm in" join that notifies the broadcaster; once 2+ are in, one tap converts the broadcast into a pre-filled event via the existing create-event flow.
- [x] Tests: pgTAP (one-active-broadcast guard, public-visibility opt-in, expiry); jest for the toggle/join/convert; maestro `open_play_broadcast`.

**Done when:** a check-in toggled "looking for players" pulses on the map and notifies in-city friends; two "I'm in" joins convert to a pre-filled event; broadcasts expire with their window.

### F021 · Find Players — opt-in city directory with matching — §1.3 `high` `large`
**Depends on:** F001 (skill/goals), F002 (rating proximity once F030 lands), PostGIS 102 (near-me).
**Files:** `supabase/migrations/113_find_players.sql` (new), `src/features/findPlayers/` (new), `src/screens/FriendsScreen.tsx`, `src/services/equipment.ts`
- [x] Migration: `profiles.discoverable boolean default false`; `partner_preferences` table; `find_players(city, filters)` RPC joining profiles + current equipment (grip/handedness/style from the **existing equipment profile**) + ratings + recent activity, **excluding `user_blocks` (072) and existing friends**; `match_invites` table with an accept RPC that transactionally creates a private 2-person event (058 visibility); notification category + rate limit (e.g. 5 invites/day, 047).
- [x] Directory UI on Friends: avatar, skill chip, style/grip/handedness badges, availability windows, top venues, played-this-week dot; filters for skill, sought style (attacker/defender/penholder/lefty), availability, park/indoor, and rating proximity (after F030); a "Challenge" button → match invite → on-accept private event (reminders come free).
- [x] Tests: pgTAP (discoverable default off, block/friend exclusion, invite-accept creates a private event); jest for filters + challenge flow.

**Done when:** opting into "discoverable" lists a player with style/availability badges, blocked users and friends are excluded, and an accepted Challenge spawns a private event with reminders.

### F022 [P] · Crossed Paths — "you played at the same place" — §1.5 `medium` `small`
**Files:** `supabase/migrations/114_crossed_paths.sql` (new), `src/screens/FriendsScreen.tsx`, `src/services/feed.ts`
- [x] Migration: `get_crossed_paths()` RPC (self-join on `checkins` with `tstzrange` overlap, last 30 days, excluding friends + blocked); `suggestion_dismissals` table; index on `checkins(venue_id, started_at)`. No push for v1.
- [x] Card strip atop Friends: avatar + shared venue ("2× at Stadtpark") + Add / Dismiss.
- [x] Tests: pgTAP (overlap detection, friend/block exclusion, dismissal persists); jest for the strip.

**Done when:** two strangers who overlapped at a venue see each other as a dismissible suggestion, and friends/blocked never appear.

### F023 · Direct Messages (1:1 partner chat) — §1.4 `high` `large`
**Depends on:** F020/F021 (the surfaces that dead-end at "Saturday 10am?"); moderation infra (098, shipped).
**Files:** `supabase/migrations/115_dm.sql` (new), `src/features/messaging/` (new), `src/screens/` Messages inbox + thread, `src/contexts/NotificationProvider.tsx`, `src/lib/notificationRoutes.ts`, `src/screens/AdminModeration/ReportsTab.tsx`
- [x] Migration: `dm_threads` (UNIQUE pair) + `dm_messages` with participant-scoped RLS; a `can_message()` check (accepted friendship OR shared event, AND no block); insert trigger reusing `create_and_send_notification` (new `dm` category); per-user rate limits (047); `content_reports` type `dm_message` (extends 072) + `ugc_suspicious()` (098) into the admin Reports tab.
- [x] Client: "Message" button on friend/co-participant profiles; thread screen (bubbles, day separators, pull-to-refresh) + Messages inbox (paper-plane icon next to the bell) with unread badges; **push-/poll-driven refetch on receipt + AppState foreground, no websockets**; deep-link routing added to `notificationRoutes.ts`; long-press to report; blocked users can't start/continue.
- [x] Tests: pgTAP (`can_message` gate, block enforcement, RLS); jest for thread refetch-on-focus + unread badges; maestro `direct_message`.

**Done when:** two eligible users exchange messages that arrive via push and refetch on foreground, blocked users are barred, and a reported message reaches the admin queue.

---

## Phase 4 — Competitive layer (Theme 3)

> All derive from F002. Build the rating engine (F030) before the surfaces that read it.

> **✅ SHIPPED.** Migrations: **119** F030 Elo (`player_ratings` + `rating_history`; `apply_match_rating` K=40<10/K=20, hooked via an `AFTER INSERT OR UPDATE` trigger that catches confirm_match, the auto-confirm cron, AND F032's directly-inserted confirmed games; `recompute_player_ratings` for void/dispute reversal), **120** F031 head-to-head + rivals (RPC only, block-filtered), **121** F032 single-elim brackets (`tournament_brackets`/`tournament_slots`, rating-seeded with byes; `report_tournament_slot` advances + inserts a confirmed match so ratings/H2H update), **122** F033 ladder (`ladder_seasons`/`season_results`, `get_city_ladder` ranked by Elo with a 5-match placement gate, quarterly pg_cron rollover). Domains: `src/features/{ratings,tournaments}` + H2H/rivals on `features/matches` + ladder on the existing leaderboard stack. New components: `RatingChip`, `RatingSparkline`, `ShareCard` (built fresh — the "orphan" was `react-native-view-shot`, not a component), `RatingCelebrationSheet`, `TournamentSection`, `QuickMatchModal`/`QrScanModal`. New notification categories `tournaments` + `seasons` (cumulative `notification_category`/`type_check` reproduction across 121→122). `npm test` (1141) + `lint` + `typecheck` green; locale keys ×8; pgTAP `f030`–`f033`; maestro `tournament_bracket`. **F034 Quick Match QR:** deep-link build/parse + `?logMatch=1` prefill + QR display + camera scanner are coded and jest-tested; this added native deps **`expo-camera`** + `react-native-qrcode-svg` and an `expo-camera` config plugin — **requires a dev rebuild** (`npx expo run:ios/android` or EAS) to scan on-device; the live camera was not run here. **Deferred:** F032 round-robin format (single-elim only); the rating-proximity filter on F021 is now unblocked by F030 but not yet wired into the directory.

### F030 · TTPortal skill rating (Elo) with history — §3.2 `high` `medium`
**Depends on:** F002.
**Files:** `supabase/migrations/116_player_ratings.sql` (new), `src/features/matches/` (extend), `src/screens/ProfileScreen.tsx`, `src/screens/PlayerProfileScreen.tsx`, `src/screens/EventDetailScreen.tsx`
- [x] Migration: `player_ratings` + `rating_history`; one plpgsql `apply_match_rating(match_id)` (K=40 provisional under 10 matches / K=20 after) invoked from the match-confirmation trigger; a recompute function for dispute reversals. **Deterministic, no ML.**
- [x] UI: rating chip on profiles/identity card/event participant lists ("Provisional" under 10 matches); profile gains current/peak, a 90-day sparkline, last-5 delta; a celebration sheet on the opponent's confirmation.
- [x] Tests: pgTAP (Elo math, provisional K, recompute on dispute reversal); jest for the chip + sparkline + celebration.

**Done when:** confirming a match moves both players' ratings deterministically, the profile shows current/peak + sparkline, and reversing a dispute recomputes correctly.

### F031 [P] · Head-to-head records and rivals — §3.3 `high` `small`
**Depends on:** F002 (F030 enables the Challenge deep-link target).
**Files:** `supabase/migrations/` (RPC only — no new tables), `src/features/matches/`, `src/screens/PlayerProfileScreen.tsx`, `src/screens/ProfileScreen.tsx`
- [x] `get_head_to_head(opponent_id)` and `get_rivals()` RPCs over `matches`, respecting `user_blocks` filtering — no new tables.
- [x] On a played-opponent's profile: W-L, set ratio, current streak, last-5 as tappable W/L dots; own profile gains a "Rivals" section (top-5 most-played) with a Challenge button deep-linking into the F021 match-invite flow.
- [x] Tests: pgTAP (record math, block filtering); jest for the H2H block + rivals.

**Done when:** a played opponent's profile shows an accurate W-L/streak and the Rivals section deep-links to a challenge.

### F032 · Tournament brackets and round-robin on events — §3.4 `high` `large`
**Depends on:** F002, F030 (rating seeding).
**Files:** `supabase/migrations/117_tournaments.sql` (new), `src/features/tournaments/` (new), `src/screens/EventDetailScreen.tsx`
- [x] Migration: `tournament_brackets` + `bracket_matches`; `generate_bracket(event_id, format)` (organizer-only, single-elim or round-robin, seeded by rating with unrated last/randomized, handles byes); `report_bracket_result` advancing the bracket transactionally **and inserting into `matches`** (so ratings update); "your next match is ready" notification (new category); refetch-on-focus, no Realtime.
- [x] UI for `event_type='tournament'`: organizer "Set up bracket"; participants see a scrollable bracket / standings with their path highlighted; per-tile score entry; podium on past-event detail + a winner profile trophy.
- [x] Tests: pgTAP (seeding, byes, advancement, matches insert); jest for the bracket render + result entry; maestro `tournament_bracket`.

**Done when:** an organizer generates a seeded bracket, per-tile results advance it and feed `matches`/ratings, and a completed tournament shows a podium + winner trophy.

### F033 · City ladder with quarterly seasons — §3.5 `medium` `medium`
**Depends on:** F002, F030.
**Files:** `supabase/migrations/118_seasons.sql` (new), `src/screens/LeaderboardsScreen.tsx`, `src/services/leaderboard.ts`, `src/components/ShareCard.tsx`
- [x] Migration: `seasons` + `season_results` snapshot tables; `get_city_ladder` RPC (rank, rating, W-L from confirmed matches this season; 5 to place); pg_cron season rollover (close → snapshot → open → notify).
- [x] "Ladder" tab on Leaderboards with an "In placement — 3/5" state; quarterly countdown pill; season-end notification + a shareable recap card rendered with the **orphaned `ShareCard`** view-shot component; top-3 get permanent profile trophies.
- [x] Tests: pgTAP (placement gate, season rollover snapshot); jest for the ladder tab + share card.

**Done when:** the ladder ranks placed players for the current season, rollover snapshots results and notifies, and a recap card shares as an image.

### F034 [P] · Quick Match QR pairing — §3.6 `low` `small`
**Depends on:** F002.
**Files:** `src/features/matches/`, `src/screens/PlayerProfileScreen.tsx`, `src/screens/` Log Match
- [x] Essentially no backend — reuse the player deep link + `matches` insert; client QR render (on Profile) + scan (on Log Match). Scanning fills both players + venue (from the scanner's active check-in) and drops into the score stepper; opponent still confirms (F002), so v1 can skip signed tokens.
- [x] The QR encodes the existing player-profile deep link with `?logMatch=1`, so a normal camera app opens the web profile — a side-effect acquisition channel.
- [x] Tests: jest for QR encode/decode + prefill; maestro is optional (camera).

**Done when:** scanning an opponent's QR prefills a match and venue and lands on the score stepper, with the opponent confirming as normal.

---

## Phase 5 — Clubs, community & growth (Theme 4)

> **✅ SHIPPED.** Migrations: **123** F040 clubs, **124** F041 referrals, **125** F042 session moments — **applied to prod + types regenerated**. (The source's `119/120/121` placeholders were taken by the shipped competitive layer; next free numbers were 123–125.) New domains `src/features/{clubs,checkinMoments}`; the orphaned `ActivityFeedScreen` is finally **routed** (a 5th "Activity" tab). New **`club`** event-visibility scope (enum + `events.club_id` + reproduced SELECT policy + a `BEFORE INSERT OR UPDATE` membership trigger + `club_event_created` fan-out); a single **`/join/<code>`** deep link serves **both** referral and club codes; the Recruiter badge reuses the existing `badge_awards` (new `recruiter` `challenge_category`); moments add a dedicated **`moments` Storage bucket** + a 3rd `get_friend_feed` branch (with `photo_url`) + a lazy `get_venue_moments` strip. New notification categories: `club_event`, `referrals`. **`generate_recurring_events` fixed** to propagate `visibility`/`club_id` (a latent bug — recurring instances silently became `public`). pgTAP `f040` (13) / `f041` (10) / `f042` (11) executed green on the full chain via the `.migration-test` harness; `npm test` (1190) + `lint` (0 err) + `typecheck` green; locale keys ×8; maestro flow `club_create_join`. An adversarial multi-agent review caught & fixed **9 issues** before apply — incl. a **club-feed UPDATE-injection** (the membership trigger was INSERT-only), a **moment venue-spoof** (`post_checkin_moment` trusted the caller's `venue_id`), a **feed `checkin_visibility` privacy regression**, a recurrence/trigger **cron deadlock**, a duplicate-friendship, and two storage-bucket / return-type **apply blockers**. **Deferred (documented):** referee-side referral rate-limit (cosmetic-badge farming — a v1 call), the inert anon `referral_code` grant, the stash cold-start fallback, and native review of the 6 machine-translated locales.

### F040 · Clubs & groups — §4.1 `high` `large`
**Files:** `supabase/migrations/119_clubs.sql` (new), `src/features/clubs/` (new), `src/screens/` club screen, `src/screens/EventSchedulingScreen.tsx`, `src/services/events.ts`
- [x] Migration: `clubs` + `club_members` (admin/member roles) with RLS; `ALTER events ADD club_id` and extend the 058–060 event-visibility policies with a `club` scope; `join_club_by_code` / `get_my_clubs` / `get_club_detail` RPCs; fan-out notification (new `club_event` category) via `create_and_send_notification`; avatar via the existing image pipeline.
- [x] Create-club flow (name, avatar, description, city, optional home venue → 6-char join code / share link); club screen (members + roles, home-venue card, upcoming club events); create-event "Club" visibility so club events appear in members' Events tabs with a push; admins remove members / rotate the code.
- [x] Builds on event visibility (058) and recurrence (016).
- [x] Tests: pgTAP (club RLS, club-scoped event visibility, join-by-code); jest for create/join + member admin; maestro `club_create_join`.

**Done when:** a club created with a code lets a member join via link, a club-visibility event reaches members' tabs with a push, and admins can rotate the code / remove members.

### F041 [P] · Referral links with auto-friend on join — §4.2 `medium` `medium`
**Files:** `supabase/migrations/120_referrals.sql` (new), `supabase/functions/send-app-invite/`, `src/screens/SettingsScreen.tsx` (Invite row), `src/contexts/SessionProvider.tsx`
- [x] Migration: `profiles.referral_code` (generated like usernames, 035); `referrals` table; `claim_referral(p_code)` RPC inserting an **accepted friendship** + badge awards (025); self-referral / re-claim guards.
- [x] Embed the code in `send-app-invite` emails (`ttportal.org/join/RADU42`); deep-link handling via the existing returnTo infra; "Invite friends" row with native share + an "Invited: N" counter; Recruiter badge at 1/5/10 via the existing badge system.
- [x] Tests: pgTAP (auto-friendship on claim, self-referral guard, badge award); jest for share + counter + deep-link claim.

**Done when:** signing up via a referral link auto-connects both users as friends with a push, the inviter's counter increments, and self/re-claim is blocked.

### F042 [P] · Session moments (photo + caption on check-in) — §4.3 `medium` `medium`
**Depends on:** moderation infra (098, shipped).
**Files:** `supabase/migrations/121_checkin_moments.sql` (new), `src/components/CheckinSuccessSheet.tsx`, `src/screens/ActivityFeedScreen.tsx`, `src/services/feed.ts`, `src/screens/VenueDetailScreen.tsx`, `src/lib/imageUpload.ts`
- [x] Migration: `checkin_moments` (UNIQUE per check-in, soft delete) with RLS; a `moments` Storage bucket reusing `imageUpload.ts` + CDN transforms; a **third UNION branch in the `friend_feed` RPC** (extends 052); latest-N in the venue bundle (044); `content_reports` type + `ugc_suspicious()` (098) + rate limits (047). *(Note: venue moments ship as a separate lazy `get_venue_moments` RPC rather than folded into the 044 bundle — the F016/venue-board convention, keeps the detail critical path light.)*
- [x] "Add a moment" (one photo + caption) on the check-in success sheet; moments render as photo cards in the friend feed — **finally giving the orphaned `ActivityFeedScreen` a reason to be routed** — and a "Recent moments" strip on venue detail; long-press to report, authors can delete.
- [x] Tests: pgTAP (per-check-in uniqueness, soft delete, report); jest for upload + feed card + venue strip; route `ActivityFeedScreen`.

**Done when:** a moment attached to a check-in appears in friends' feeds and the venue's strip, `ActivityFeedScreen` is reachable, and reports/deletes work.

---

## Phase 6 — Habit, retention & reactivation (Theme 5)

> Independent; any order. Pure aggregation over existing data + pg_cron pushes.

### F050 [P] · Weekly play streaks — §5.1 `high` `medium`
**Files:** `supabase/migrations/122_streaks.sql` (new), `src/screens/ProfileScreen.tsx`, `src/components/CheckinSuccessSheet.tsx`
- [ ] Migration: `user_streaks` maintained by triggers on check-ins/event attendance (025 badge-sync pattern); one weekly pg_cron job to expire/freeze and enqueue reminder pushes (new `streak` category); fold into `get_profile_stats` (051). One auto-applied freeze/month.
- [ ] Flame counter chip on the identity card + in the success sheet ("Week 6 — keep it alive!"); tap for current/best + which day still counts; one lapse-warning push.
- [ ] Tests: pgTAP (increment, freeze consumes once/month, expiry); jest for the chip + tap detail.

**Done when:** consecutive play-weeks increment the flame, a missed week burns the monthly freeze instead of resetting, and a lapse nudge fires once.

### F051 [P] · Venue explorer quests — §5.2 `high` `medium`
**Files:** `supabase/migrations/123_explorer_quests.sql` (new), `src/features/challenges/` (extend), `src/screens/` Challenges tab, `src/screens/MapViewScreen.tsx`
- [ ] Migration: a quest-definitions table (venue predicate: park/indoor/verified; tier targets) + `get_explorer_progress` RPC (`COUNT(DISTINCT venue_id)` joined to venues); awards reuse the badge infrastructure (025).
- [ ] "Explore" section on Challenges: city-scoped quests ("Visit 5 venues" bronze/silver/gold at 5/10/20, "Park Hopper", "Indoor Initiate") with progress rings; "Find one" jumps to the Map pre-filtered via the existing chips; tier completion fires the earned-badge modal; "New to you" callout tag on never-visited pins.
- [ ] Tests: pgTAP (distinct-venue counting, tier thresholds); jest for the quest cards + map jump.

**Done when:** visiting distinct venues advances a quest ring, hitting a tier fires the badge modal, and "Find one" opens the filtered map.

### F052 [P] · Weekly recap — "Your week in TT" — §5.3 `high` `medium`
**Files:** `supabase/migrations/` (RPC + cron — no new tables), `src/screens/` recap, `src/components/ShareCard.tsx`
- [ ] `get_weekly_recap(user_id, week_start)` RPC over existing tables (checkins, event hours 029, weekly leaderboard 040); one Monday pg_cron job inserting notifications + pushes **only for users who played** (no guilt spam, new `recap` category).
- [ ] Monday push → one-screen recap (sessions, hours, venues w/ new-venue callout, friends played with, rank delta, streak) ending in "Share my week" via `react-native-view-shot` + the orphaned `ShareCard`.
- [ ] Tests: pgTAP (recap aggregation; inactive users get nothing); jest for the recap screen + share.

**Done when:** active users get a Monday recap with correct numbers and a shareable card; users who didn't play get no push.

### F053 [P] · Milestone moments with shareable cards — §5.4 `medium` `medium`
**Files:** `supabase/migrations/124_milestones.sql` (new), `src/lib/badgeChallenges.ts` (definitions), `src/components/CheckinSuccessSheet.tsx`, `src/screens/ProfileScreen.tsx`
- [ ] Migration: `user_milestones` populated by AFTER INSERT triggers (025 style); `get_profile_stats` (051) extended with lifetime counters. Definitions in client code like `badgeChallenges.ts`.
- [ ] Lifetime thresholds (10th/50th/100th check-in, 10th/25th distinct venue, 50/100/250 hours, first review, 1-year anniversary) trigger a full-screen celebration (stacked after the success sheet when both fire) + share card; a milestones strip on Profile with locked next-milestone ghosts ("38/50 venues").
- [ ] Tests: pgTAP (threshold firing, no double-award); jest for the celebration stacking + ghosts.

**Done when:** crossing a lifetime threshold fires a one-time celebration + share card and the profile strip shows earned + next-ghost milestones.

### F054 [P] · TT Wrapped — year in review — §5.5 `medium` `large`
**Files:** `supabase/migrations/` (RPC + optional jsonb precompute — no core new tables), `src/features/wrapped/` (new), `src/screens/ProfileScreen.tsx`, `src/components/ShareCard.tsx`
- [ ] `year_in_review(user_id, year)` RPC over existing tables; one pg_cron teaser notification at unlock (new category); optional jsonb precompute for heavy users.
- [ ] Dec 15–Jan 15: a Profile banner → a swipeable 5–6-card story (hours/sessions, top venue w/ photo, most-played month, partner of the year, badges/milestones, a rule-based archetype card); each card shares as a story-format image.
- [ ] Tests: pgTAP (aggregation, window gating); jest for the card story + share; verify it lands when outdoor players churn.

**Done when:** within the window, eligible users see a swipeable Wrapped story whose cards share as images, gated outside Dec 15–Jan 15.

---

## Phase 7 — Training & gear utility (Theme 6)

### F060 [P] · Training session log — §6.1 `medium` `medium`
**Files:** `supabase/migrations/125_training_sessions.sql` (new), `src/features/training/` (new), `src/screens/PlayHistoryScreen.tsx`, `src/hooks/queries/usePlayHistoryQuery.ts`, `src/components/LogHoursModal.tsx`
- [ ] Migration: `training_sessions` (owner-write/friend-read RLS mirroring `equipment_history`); extend the play-history query path; rate-limit row (047); MMKV cache per the `playHistoryCache` pattern.
- [ ] "Log training" on Profile + the success sheet: type (solo/partner/multiball/robot), duration (reuse the `LogHoursModal` preset pattern), 1–3 focus chips (serves, receive, footwork, FH/BH loop, blocking, match play), optional venue (pre-filled from active check-in) + partner; new row type in the `PlayHistoryScreen` day breakdown + a focus-distribution bar on the period summary.
- [ ] Tests: pgTAP (RLS, rate limit); jest for the log modal + history row + distribution bar.

**Done when:** a logged training session appears in Play History with its focus areas and contributes to the period summary.

### F061 [P] · Rubber wear tracker with replacement reminders — §6.2 `medium` `medium`
**Depends on:** F060 (training hours feed the estimate).
**Files:** `supabase/migrations/126_equipment_wear.sql` (new), `src/screens/EquipmentScreen.tsx`, `src/services/equipment.ts`, `src/hooks/queries/useEquipmentHistoryQuery.ts`
- [ ] Migration: `equipment_wear_settings` (side, installed_at, expected_hours default 60); `get_rubber_wear` RPC summing the three hour sources (check-in durations + event hours + training sessions); nightly pg_cron threshold notifications with a sent-flag (new category) at 80% and 100%.
- [ ] EquipmentScreen gains an "installed on" date per rubber (default from `equipment_history`) + a wear card (estimated hours vs adjustable lifespan); pushes deep-link to Equipment; saving a new rubber resets the clock.
- [ ] Tests: pgTAP (hour summation across sources, threshold once-only); jest for the wear card + reset.

**Done when:** a rubber accrues estimated hours from real play, the wear card reflects it, and 80%/100% pushes fire once each and reset on re-rubber.

### F062 [P] · Equipment database with community reviews — §6.3 `medium` `medium`
**Files:** `supabase/migrations/127_equipment_reviews.sql` (new), `src/features/equipment/` (extend), `src/screens/EquipmentScreen.tsx`, `src/screens/AdminModeration/ReportsTab.tsx`
- [ ] Migration: `equipment_reviews` (UNIQUE per user+model, **owned-it check against `equipment_history`**); `get_equipment_model_summary` RPC (aggregate stars, speed/spin/control bars, "N players use this"); `content_reports` type + `ugc_suspicious()` (098) into the admin tab; rate-limit row (047).
- [ ] Every blade/rubber in the **existing delta-synced catalog** becomes tappable into a model page; reviews show each author's grip/style from their real equipment profile; only owners can review (stars + three 0–10 sliders + time used + text); a "Gear" browse entry by manufacturer; report/block reuse the venue-review patterns.
- [ ] Tests: pgTAP (owned-it gate, uniqueness, report); jest for the model page + review form.

**Done when:** a model page shows aggregate ratings + usage count, only owners can post a review, and reports reach the admin queue.

### F063 [P] · Coach directory — §6.4 `medium` `medium`
**Files:** `supabase/migrations/128_coach_profiles.sql` (new), `src/features/coaches/` (new), `src/screens/AdminModeration/` (new Coaches tab), `src/hooks/queries/useAdminListsQuery.ts`, `src/screens/VenueDetailScreen.tsx`, `src/screens/MapViewScreen.tsx`
- [ ] Migration: `coach_profiles` (status lifecycle, public-read-when-approved RLS) + `coach_venues`; admin approve/reject RPCs as a **new AdminModeration tab** following the just-shipped tab pattern (`src/screens/AdminModeration/*Tab.tsx` + `useAdminListsQuery`); coach chips in the venue bundle (044) and `get_profile_stats` (051).
- [ ] "I coach" application (bio, experience, levels, languages, price range, contact, up to 3 venues) → existing admin approval queue; approved coaches get a Coach badge + a pinned card on their player profile showing real TTPortal activity; venue detail "Coaches here"; a "Coaching" map filter chip. No booking/payments in v1.
- [ ] Tests: pgTAP (approval gating, public-read only when approved); jest for the application + admin approve + venue chip.

**Done when:** a coach application lands in a new admin tab, approval pins a credible coach card + Coach badge, and the venue/map surfaces the coach.

---

## Dependency graph (critical path)

```
Prereqs (SHIPPED): T004/T010 presence · T018 visibility · T086 notif-prefs · T089 moderation · [T027/102 PostGIS pending apply]

F001 (skill/goals) ─┐
F002 (matches) ─────┼─► F020 (open play), F021 (find players)
                    └─► F030 (Elo) ─► F031 (H2H) · F032 (brackets) · F033 (ladder)
Social: F020/F021 ─► F023 (DMs) ─► [F040 clubs is independent but completes the social story]
Venue intel: F010–F016 independent (F010/F021 near-me gate on PostGIS 102)
Retention: F050–F054 independent, any order
Training: F060 ─► F061;  F062, F063 independent
```

**Suggested first wave (foundation + quick B2B wins):** F001, F002, F011, F012 — two small must-haves that unblock everything plus two small data-flywheel features. Then F010 (busyness) and F020 (open play) as the flagship presence pair.

## Not in scope here

- Everything in **mspec.md** (venue claiming, verified profiles, analytics tiers, promoted events, follow/notifications, loyalty, sponsored challenges, reservations, market reports) — already specified; F001/F010/F011/F012/F014/F016 are designed to *feed* it.
- Everything in **improvement_suggestions.md** — tracked in [improvement_suggestions_tasks.md](improvement_suggestions_tasks.md); its privacy/notif/moderation prerequisites for these features are shipped (see the prerequisites box above).
- Realtime/websockets — every feature above is push + fetch-on-focus (egress postmortem).
