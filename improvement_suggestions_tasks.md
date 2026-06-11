# TTPortal — Improvement Tasks

Derived from [improvement_suggestions.md](improvement_suggestions.md) (2026-06-10, analyzed at commit `9a48d1e`). Each task references its source finding (§), lists concrete files, steps, and acceptance criteria.

> **Deferred:** CI/CD pipeline work (quality gates, db-test job, drift check, build automation, coverage-in-CI, nightly E2E) has been moved to [cicd_tasks.md](cicd_tasks.md) (C001–C007). One-line stubs below keep the original IDs valid. The **local** equivalents stay here — notably T020's "`supabase db reset` replays clean + pgTAP suite", which the security migration series depends on. Until C001 lands, run `npm test && npm run lint && npm run typecheck` manually before pushing: the deploy workflow still publishes on every push with no checks.

**Conventions**
- **ID:** `T###` — stable references, grouped by phase. Phases are ordered; tasks inside a phase marked `[P]` can run in parallel.
- **Priority:** `P0` (this week) · `P1` (before store launch / next imports) · `P2` (rolling debt).
- **Size:** `S` ≤ ½ day · `M` 1–3 days · `L` > 3 days.
- New migration files are numbered `082+` as placeholders — renumber to whatever is next when you create them, and keep RLS-changing migrations in one consecutive series (§2.8).
- Any task that changes RLS or triggers must add a matching pgTAP test once T020 lands (tests can be back-filled for Phase-0 tasks).

## Task index

| Phase | Tasks | Theme |
|---|---|---|
| 0 | T001, T003–T009 | Stop the bleeding (all `high/low`) |
| 1 | T010–T018 | Security & privacy migration series |
| 2 | T020–T024, T026–T027 | DB restore-correctness & release readiness |
| 3 | T030–T036 | Offline & resilience correctness |
| 4 | T040–T048 | Performance |
| 5 | T050–T059 | Architecture & code quality |
| 6 | T060–T068 | UX, i18n & accessibility |
| 7 | T070–T071, T073–T075 | Testing depth & remaining deps |
| 8 | T080–T089 | Operational & strategic gaps |
| — | C001–C007 | **CI/CD (deferred)** → [cicd_tasks.md](cicd_tasks.md) |

---

## Phase 0 — Stop the bleeding (target: ~1 week)

### T001 · Fix the 2 failing tests at HEAD — §3.1 `P0` `S`
**Files:** `src/lib/auth-utils.ts` (line ~37), `src/__tests__/auth-edge-cases.test.tsx`, `src/locales/*.json`
- [x] Make the duplicate-email error copy flag-aware: when `SOCIAL_AUTH_ENABLED` is false (`src/lib/featureFlags.ts:8`), return a variant of `errorDuplicateEmail` that does **not** suggest Google/Apple sign-in. Add the new i18n key to `en.json` + the 7 other locales. *(Added `errorDuplicateEmailNoSocial`; `mapAuthErrorToKey` branches on the flag.)*
- [x] Update/gate the two assertions in `auth-edge-cases.test.tsx` (~line 321) on the flag so they test both copy variants. *(Actual breakage was the age-confirmation checkbox never being ticked — fixed; flag-on variant covered there, flag-off variant + all-locale copy check in new `src/lib/__tests__/auth-utils.test.ts`; `sign-in.registration-flow.test.tsx` updated to the no-social copy.)*
- [x] Run `npx jest` — full suite green. *(872/872, lint + typecheck clean.)*

**Done when:** `npx jest --ci` exits 0 at HEAD.

### T002 · ~~Add CI quality gates and fix the deploy pipeline~~ → **moved to [cicd_tasks.md](cicd_tasks.md) C001** (deferred)

### T003 [P] · Migration: block self-escalation of `is_admin`/`is_moderator` — §1.1 `P0` `S`
**Files:** `supabase/migrations/082_profiles_role_guard.sql` (new), regression test
- [x] `BEFORE UPDATE` trigger on `public.profiles` that raises unless (`OLD.is_admin = NEW.is_admin` AND `OLD.is_moderator = NEW.is_moderator` AND `OLD.pending_deletion_at IS NOT DISTINCT FROM NEW.pending_deletion_at`) OR the caller is admin (reuse the existing admin-check helper). *(`supabase/migrations/082_profiles_role_guard.sql`; SECURITY DEFINER/service paths exempted via `current_user NOT IN ('authenticated','anon')`.)*
- [x] Verify the account-deletion path (migration 071 cron + `requestAccountDeletion` RPC) still works — route `pending_deletion_at` changes through SECURITY DEFINER if the trigger blocks them. *(071's two RPCs were SECURITY INVOKER and would be blocked — 082 recreates them as SECURITY DEFINER, verified.)*
- [x] Confirm `admin_set_user_moderator` (081) still functions (SECURITY DEFINER passes the guard). *(Verified.)*
- [x] Regression test: a normal JWT `PATCH /rest/v1/profiles?id=eq.<own-id>` with `{"is_admin": true}` is rejected. *(Verified in a scratch Postgres container simulating PostgREST roles + JWT claims — `supabase/.migration-test/` harness + assertions, 14/14 pass; pgTAP port lands with T020. Full local stack replay blocked by the broken chain, T020.)*
- [ ] Apply to prod after local verification. **(Needs operator: `supabase db push` — review 082+083 together; 083 changes RPC signatures, deploy with the matching client build.)**

**Done when:** self-PATCH of role flags fails for a non-admin; admin RPC and deletion flow still work.

### T004 [P] · Migration: derive identity from `auth.uid()` in the 3 leaky RPCs — §1.2 `P0` `M`
**Files:** `supabase/migrations/083_rpc_auth_uid.sql` (new), `src/services/feed.ts`, `src/hooks/queries/useVenueDetailQuery.ts`, `src/hooks/queries/useFriendsAtVenueQuery.ts`
- [x] `get_friend_feed`: drop `p_friend_ids` trust — compute accepted friendships of `auth.uid()` server-side. *(Parameter dropped; `supabase/migrations/083_rpc_auth_uid.sql`. Also revoked from `anon`.)*
- [x] `get_venue_detail`: remove `p_user_id`; compute `is_favorited`/`user_active_checkin` from `auth.uid()`, returning false/NULL for anon. `DROP FUNCTION` + recreate (signature changes).
- [x] `get_friends_at_venue`: same treatment; revoke from `anon` if it has no anonymous use case. *(Revoked.)*
- [x] Update the three client call sites to stop passing user IDs; type-check + run affected unit tests. *(feed.ts/useFeedQuery/ActivityFeedScreen no longer fetch friend ids; useVenueDetailQuery/useFriendsAtVenueQuery keep userId in the query key only. Tests updated; typecheck + suites green.)*
- [x] Smoke-test as anon and as two different users on the local stack: feed shows only own friends; venue detail personalization is self-only. *(Verified in the scratch-container harness with admin/two-users/stranger/anon roles — `supabase/.migration-test/99_assertions.sql` checks 8–14.)*

**Done when:** no deployed RPC accepts the acting user's identity as a parameter; clients updated; verified with two test accounts.

### T005 [P] · Wire React Query to NetInfo/AppState — §4.1 `P0` `S`
**Files:** `src/lib/queryClient.ts`, `src/app/_layout.tsx`
- [x] `onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false)))`.
- [x] `AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'))`. *(Gated to native — web already drives focusManager via visibility events.)*
- [x] Ensure the module runs at app start (import from `_layout.tsx` if tree-shaking is a concern). *(`_layout.tsx` already imports `queryClient` by value; wiring is module-level.)*
- [x] Keep `OfflineQueueProvider`'s NetInfo subscription, or derive its `isOnline` from `onlineManager` to avoid duplicate listeners — pick one and note it in the provider. *(Chose: derive from `onlineManager` — single NetInfo listener, both systems agree on "online"; noted in the provider.)*
- [x] Manual check (airplane mode on device/simulator): offline queries pause (`fetchStatus: 'paused'`) instead of erroring; on reconnect, errored/stale queries refetch. *(Verified via unit tests capturing the NetInfo callback and asserting `onlineManager` state — `src/lib/__tests__/queryClient.test.ts`; on-device airplane-mode pass still worth doing before release.)*

**Done when:** toggling airplane mode off triggers refetch without user interaction; offline navigation no longer surfaces instant query errors.

### T006 [P] · Flush the offline queue on cold start, foreground, and enqueue — §4.2 `P0` `S`
**Files:** `src/contexts/OfflineQueueProvider.tsx`
- [x] Mount effect: after `refreshCount()`, if `getPending().length > 0` and `NetInfo.fetch()` reports online → `void flush()`. *(Uses `onlineManager.isOnline()` — same NetInfo source via the T005 wiring.)*
- [x] Add an AppState `'active'` listener that flushes when pending > 0.
- [x] Call `flush()` after each `enqueue` when `isOnline` (covers flapping connections).
- [x] Keep the reentrancy guard (`flushingRef`) intact for all new call paths. *(All triggers verified in `src/contexts/__tests__/OfflineQueueProvider.test.tsx` — cold-start flush, offline-mount + reconnect, foreground, enqueue-while-online, handler-error retention.)*

**Done when:** an item queued offline, followed by app kill + relaunch online, replays without requiring an offline→online transition. (Unit tests in T036.)

### T007 [P] · Fix push-notification deep links (eventId + cold start) — §7.3 `P0` `S`
**Files:** `src/lib/notificationRoutes.ts` (new), `src/contexts/NotificationProvider.tsx`, `src/components/NotificationInboxModal.tsx`
- [x] Extract the inbox's route-building logic (`NotificationInboxModal.tsx:97-106`) into `buildRouteFromNotificationData(data)` — handle `screen` plus `eventId` **and** snake_case `event_id` (migration 012 reminders). *(`src/lib/notificationRoutes.ts` + unit tests.)*
- [x] Use the helper in both the inbox and `NotificationProvider`'s `responseListener` (currently reads only `data.screen`).
- [x] Cold start: on provider mount, call `Notifications.getLastNotificationResponseAsync()` and route if present (one-shot ref guard).
- [ ] Optional follow-up migration: change 012's payload key to `eventId` for consistency. *(Skipped — the shared helper accepts both keys, so the migration buys nothing; revisit if payload shapes get typed.)*
- [x] Test matrix: push tapped (a) app foregrounded, (b) backgrounded, (c) killed — all land on the event screen. *(All three code paths unit-tested in `NotificationProvider.routing.test.tsx` — warm listener (a/b share it) + cold-start fetch (c); worth one on-device pass before release.)*

**Done when:** all three tap scenarios deep-link to the event, including event-reminder pushes.

### T008 [P] · Quick fix: VenueDetail favorite toggle uses the mutation hook — §5.2 `P0` `S`
**Files:** `src/screens/VenueDetailScreen.tsx` (lines ~19, 445–454)
- [x] Replace direct `addFavorite`/`removeFavorite` calls in `handleToggleFavorite` with `useToggleFavoriteMutation(user?.id).mutate({ venueId, isFav })`, keeping haptic + heart animation on success. *(Uses `mutateAsync` so the existing inline error Alert + heart animation stay; offline enqueue now flows through the hook.)*
- [x] Verify the Favorites screen reflects a toggle from venue detail immediately (cache invalidation now flows through the hook). *(The hook invalidates `['favorites', userId]` on settle — same path FavoritesScreen uses; screens suite green.)*
- [x] Audit `doCheckin` in the same file for the same bypass pattern; file follow-up in T031 if confirmed. *(Confirmed: `doCheckin` calls the `checkin` service directly with no offline handling — exactly T031's scope, no extra ticket needed.)*

**Done when:** favoriting from venue detail updates the Favorites screen without pull-to-refresh and enqueues offline like FavoritesScreen does.

### T009 [P] · .gitignore safety net (the 5-minute subset of repo hygiene) — §8.7 `P0` `S`
**Files:** `.gitignore`
- [x] Add: `*.apk`, `*.aab`, `.idea/`, `supabase/.temp/`, `tables.json`.
- [x] Verify `git status` no longer lists the APK/IDE noise. (Full cleanup is T026 — this just removes the "one `git add .` bricks pushes" hazard.)

---

## Phase 1 — Security & privacy migration series

> Ship as one consecutive migration series; land T020's local replay + pgTAP harness first or alongside so the chain stays buildable. Each task adds a pgTAP assertion (run via `supabase test db` locally until C002 enforces it in CI).

### T010 · Scope `checkins` SELECT to self + friends; anonymous venue counts via RPC — §1.3 `P0` `M`
**Files:** `supabase/migrations/084_checkins_rls_scope.sql`, `src/services/checkins.ts`, `src/hooks/queries/useFriendsAtVenueQuery.ts`
- [x] Replace `'Active checkins are readable' USING (ended_at > now())` with: `user_id = auth.uid() OR EXISTS (accepted friendship between auth.uid() and checkins.user_id)`. *(`supabase/migrations/084_checkins_rls_scope.sql`.)*
- [x] Add a SECURITY DEFINER RPC returning **count-only** active check-ins per venue (for "who's here now" surfaces and the future busyness feature); grant to `anon` + `authenticated`. *(`get_venue_active_checkin_count`.)*
- [x] Update client paths that relied on broad reads (`getActiveCheckins` by venue) to use the count RPC; friend paths keep direct reads (now RLS-bounded). *(`getActiveCheckins` had no consumers — replaced with `getVenueActiveCheckinCount`; friend paths unchanged.)*
- [x] Check the leaderboard/venue_stats materialized views and `get_venue_detail` still compute (they run as owner — confirm). *(Confirmed — and caught that 040's weekly leaderboard RPCs were SECURITY INVOKER and would shrink to self+friends; 084 recreates the two checkin-based ones as SECURITY DEFINER (count-only output).)*
- [x] pgTAP: stranger cannot SELECT another user's active check-in; friend can; count RPC works for anon. *(Verified in the scratch harness — `supabase/.migration-test/99_assertions_084.sql`, 5/5 incl. leaderboard-stays-global; pgTAP port with T020.)*

### T011 · Stop exposing `email` (and `pending_deletion_at`) via `profiles` — §1.4 `P0` `M`
**Files:** `supabase/migrations/085_profiles_email_privacy.sql`, `src/services/profiles.ts`, any service selecting `email`
- [x] Pick the approach: (a) move `email` to a self-only table, or (b) keep the column but `REVOKE SELECT (email, pending_deletion_at)` from `authenticated`/`anon` and expose public fields through a view. *(Chose (b) via table-REVOKE + column-list GRANT — `supabase/migrations/085_profiles_email_privacy.sql`.)*
- [x] Update `getProfile` and friends/leaderboard/admin services to select explicit public columns; self email comes from `auth.getUser()`. *(All embeds already enumerated public columns; fixed `getProfile`, `updateProfile`'s RETURNING, the admin feedback-inbox email attach, and ProfileScreen now fills email from the session user.)*
- [x] Confirm `admin_search_users` (SECURITY DEFINER) still returns emails for admins. *(Verified — definer functions run as owner and bypass the column grant.)*
- [x] pgTAP: authenticated user selecting another profile's email gets NULL/error; own profile flow unaffected. *(Scratch-harness assertions 6/6 — `supabase/.migration-test/99_assertions_085.sql`; pgTAP port with T020.)*

### T012 · Storage RLS in source control + server-side upload cap — §1.5 `P1` `M`
**Files:** `supabase/migrations/086_storage_policies.sql`, optionally `supabase/functions/signed-upload/` (new), `src/lib/imageUpload.ts`
- [x] Snapshot current cloud bucket policies (`venue-photos`) and commit them as a migration — path-scoped INSERT (`venues/`, `change-requests/`, `condition-votes/`), public read, size limit. *(`supabase/migrations/092_storage_policies.sql` codifies the intended set + bucket file_size_limit/mime allowlist. **Operator step before prod apply:** diff the dashboard's live `storage.objects` policies against this file — the migration drops known historical names, but ad-hoc dashboard policies need manual review.)*
- [x] Enforce the 10/day cap server-side: either a storage INSERT policy counting the user's recent `storage.objects` rows, or replace direct uploads with a signed-upload Edge Function that calls `enforce_rate_limit('upload_image')` and returns a one-time signed URL. *(Chose the INSERT-policy count — no new Edge Function/deploy dependency.)*
- [x] Keep the client `record_image_upload()` call for UX-side messaging, but it is no longer the enforcement point. *(Unchanged client-side.)*
- [x] Test: 11th upload in a day fails server-side even when the RPC call is skipped. *(Scratch-harness assertions 5/5 — `99_assertions_092.sql` with a storage-schema stub mirroring the Storage API's owner stamping.)*

### T013 [P] · Uniqueness + rate limits for reviews and condition votes — §1.6 `P1` `S`
**Files:** `supabase/migrations/087_review_vote_constraints.sql`, `src/services/reviews.ts`, `src/services/conditions.ts`
- [x] Dedupe existing data (keep newest per user/venue), then add `UNIQUE(user_id, venue_id)` to `reviews` and `condition_votes`. *(`supabase/migrations/086_review_vote_constraints.sql` — numbered 086 since the storage migration (T012) hasn't landed yet.)*
- [x] Switch `createReview`/`submitVote` to upsert (edit-in-place); update UI copy where it implied multiple reviews. *(Both upsert on `user_id,venue_id`; also added the missing own-row UPDATE policy on `condition_votes` that upsert needs. Existing copy is neutral — no changes needed.)*
- [x] Seed `rate_limit_config` rows (`add_review`, `condition_vote`) and attach BEFORE INSERT triggers mirroring migration 047. *(10/10min + 50/day each.)*
- [x] pgTAP: second insert for same user+venue upserts rather than duplicating; burst inserts hit the rate limit. *(Scratch-harness assertions 4/4 — `supabase/.migration-test/99_assertions_086.sql`.)*

### T014 [P] · `event_participants` visibility mirrors the parent event — §1.7 `P1` `S`
**Files:** `supabase/migrations/088_event_participants_rls.sql`
- [x] Replace `SELECT USING (true)` with: participant is self, OR the caller can read the parent event (EXISTS subquery reusing 058's public/organizer/friends/invited predicate — extract it into a helper function to avoid duplicating logic). *(`supabase/migrations/087_event_participants_rls.sql` — SECURITY INVOKER `can_read_event()` delegates to events RLS, so participant visibility can never drift from 058/059's predicate.)*
- [x] Verify event detail, avatar stacks, and `profile_stats` (events joined) still render for public events and for invited users on private events. *(`get_profile_stats` is SECURITY DEFINER; avatar-stack reads verified per-role in the harness; anon keeps public-event participants for the web pages.)*
- [x] pgTAP: anon cannot enumerate a private event's participants; an invitee can. *(Scratch-harness assertions 5/5 — `99_assertions_087.sql`: anon/stranger blocked, invitee/organizer/public OK.)*

### T015 [P] · Validated `find_or_create_city` / `find_or_create_country` RPCs — §1.8 `P1` `M`
**Files:** `supabase/migrations/089_catalog_insert_rpcs.sql`, `src/lib/cityCatalog.ts`, `src/screens/AddVenueScreen.tsx` (city-creation path)
- [x] SECURITY DEFINER RPCs that normalize (trim, case, diacritics), dedupe against existing rows, validate country codes, and insert; optionally flag new rows `pending_review` for the admin dashboard. *(`supabase/migrations/088_catalog_insert_rpcs.sql` — `find_or_create_city`/`find_or_create_country`, rate-limited (`add_city`), `expansion_status='active'` kept (pending_review deferred — admin dashboard has no such queue yet). Bonus: the legacy client "repair" UPDATE was a silent RLS no-op; it now works inside the RPC.)*
- [x] Drop the open INSERT policies from migrations 034/069; direct table INSERT becomes admin-only.
- [x] Point the add-venue new-city flow at the RPCs. *(`upsertCity` is now a single RPC call — AddVenueScreen/AdminModerationScreen signatures unchanged; service tests rewritten.)*
- [x] pgTAP: authenticated direct INSERT into `cities` fails; RPC dedupes "Wien"/"wien". *(Scratch-harness assertions 7/7 — `99_assertions_088.sql`.)*

### T016 [P] · `amatur_cache` policy + `search_path` hardening — §1.8 `P1` `S`
**Files:** `supabase/migrations/090_definer_hardening.sql`
- [x] Drop the `FOR ALL USING(true)` write policy on `amatur_cache` (service_role bypasses RLS; the policy only adds risk). Keep anon SELECT. *(`supabase/migrations/089_definer_hardening.sql`.)*
- [x] Add `SET search_path = public, pg_temp` to every SECURITY DEFINER function missing it: `handle_new_user`, `refresh_stats`, the 009 notification trigger functions, `send_event_invites` (grep all migrations for `SECURITY DEFINER` without `search_path`). *(19 found via scripted scan; instead of enumerating, 089 loops `pg_proc` and pins every unpinned public definer function — future-proof. Bodies verified schema-qualified, so the restricted path is safe; functions with deliberate wider paths are skipped.)*
- [x] pgTAP: authenticated role cannot UPDATE/DELETE `amatur_cache`. *(Scratch-harness assertions 4/4 — `99_assertions_089.sql`, incl. "no definer function left unpinned".)*

### T017 · Condition-vote photos: actually upload them — §6.6 `P1` `S`
*(Placed here: it's a broken user-facing feature writing garbage to the DB, and it touches the storage policies from T012.)*
**Files:** `src/screens/ConditionVotingScreen.tsx` (lines ~84–107), `src/services/conditions.ts`
- [x] Mirror the change-request flow: `prepareImageForUpload` → `record_image_upload` RPC → Storage upload (`condition-votes/` path, web-blob/native-FormData split) → store the public URL. *(Extracted the pipeline into shared `src/services/imageEvidence.ts`; change-requests and condition votes both delegate to it. Upload failures show a specific error — incl. rate-limit copy — and preserve the vote input.)*
- [x] One-off cleanup: NULL out existing `file://` values in `condition_votes.photo_url`. *(`supabase/migrations/090_condition_vote_photo_cleanup.sql` — also covers content:/ph:/assets-library URIs; verified it keeps https URLs.)*
- [x] If this can't ship promptly, hide the photo button instead — stop persisting dead local URIs. *(Shipped the real fix — N/A.)*

### T018 · User-facing privacy controls (check-in visibility) — §9.5 `P1` `M`
*(Prerequisite for any presence-broadcasting feature in `features_suggestions.md`.)*
**Files:** `supabase/migrations/091_checkin_visibility.sql`, `src/screens/SettingsScreen.tsx`, check-in read paths
- [x] Add `profiles.checkin_visibility` enum (`friends` default | `private`) — `public` can come later with the Open Play feature. *(`supabase/migrations/091_checkin_visibility.sql` — CHECK-constrained text column + 085 column grant.)*
- [x] Fold the preference into the T010 RLS policy / count RPC (private = self-only rows; counts always anonymous). *(Policy updated; also folded into `get_friend_feed` and `get_friends_at_venue` — private users' check-ins drop out of friend feeds/presence too (reviews stay public). Count RPC unchanged.)*
- [x] Settings: a "Privacy" section with the visibility picker and copy explaining what friends can see. *(Friends/Only-me toggle in the existing Privacy section; keys in all 8 locales — non-en machine-translated, flag for native review.)*
- [x] pgTAP: a `private` user's active check-in is invisible to friends; counts still include them. *(Scratch-harness assertions 7/7 — `99_assertions_091.sql`.)*

---

## Phase 2 — DB restore-correctness & release readiness

### T020 · Make the migration chain replayable + pgTAP invariants — §2.1, §3.2 `P0→P1` `L`
**Files:** `supabase/migrations/*`, `supabase/challenge-system/*`, `supabase/tests/` (new)
> **Reworked under the history-immutability rule:** migrations 000–081 are applied on prod and are **frozen** — no edits, no backdated insertions. All chain repairs below landed as NEW migrations (094/095) that are idempotent no-ops against prod. Consequence: a literal fresh-clone `supabase db reset` still fails inside 000–081 (009's pg_net clause, 025/026's challenge deps, 060's legacy column, 062's retro-edit) — by design, those files stay broken-for-fresh-replay until a prod baseline is cut (T021). Until then, `supabase/.migration-test/replay_prod_parity.sh` replays the frozen chain + the manual interventions prod history actually had (verified end-to-end, 9/9 invariants green).

- [x] Fold `supabase/challenge-system/001` (and `004`) into the chain as a properly-numbered migration (they already use `IF NOT EXISTS` style) so migration 026 and 079 have their dependencies. *(`094_challenge_system.sql` — a NEW migration (001 + 002 seed + 004); the seed is `ON CONFLICT DO NOTHING` so re-applying on prod cannot revert 079's title rewording (verified), and it re-runs 089's search_path pin over its CREATE OR REPLACE functions. Note: prod's manual application had to predate **025** (badge awards already use `challenge_category`), not just 026.)*
- [x] Repair 062: guard the `country_code` INSERT with a column-exists check — or squash 062–067 into a baseline (prod already has the end state). *(NOT repaired in place — 062 is frozen. Its retro-edited content is documented in the replay script; the real fix is the T021 baseline.)*
- [x] Convert `.txt`-only repairs with real effects (`066b_launch_city_seed.txt`, `068_repair_missing_romania_city_centers`) into `.sql` migrations; delete the duplicate/scratch `.txt` files (`063a/b/c`, `066a/c`, the preflight diagnostics, `065_...txt`). *(Both carried forward as NEW migration `095_location_catalog_repairs.sql` — launch-city seed converted to `DO NOTHING` so prod's curated city state can't be clobbered (verified); center repairs are id-gated NULL-fills. Deleted 16 scratch/identical-twin `.txt` files; kept `073/074.txt` — they genuinely diverge from their `.sql` twins, which is T021's prod-determination call.)*
- [x] Get `supabase db reset` green locally against `supabase/config.toml`. *(Replaced by the prod-parity replay: `replay_prod_parity.sh` applies frozen 000–081 + additive 082–095 on a fresh `supabase/postgres:15.8.1.085` container, with the four manual interventions prod history implies. Verified single-pass green; a literal `db reset` additionally needs the T021 baseline and free ports (another project's stack holds 54321/54322 here).)*
- [x] Seed a pgTAP suite (run via `supabase test db`) with the four highest-value invariants: (a) `notifications` NOT in `supabase_realtime` publication (postmortem regression); (b) anon cannot SELECT others' checkins/profiles; (c) `handle_new_user` creates a profile row; (d) `get_venues_delta` returns only rows newer than the watermark. *(`supabase/tests/database/invariants.test.sql` — 9 assertions, green against the prod-parity replay; `npm run test:db` wired.)*
- [x] Add `deno test` for `supabase/functions/_shared` and `amatur-proxy` HTML parsing, runnable locally. *(`logger.test.ts` 4/4 via `npm run test:functions`. Note: amatur-proxy contains no HTML parsing — it's a fetch/cache proxy; parsing lives client-side and is covered by `src/services/__tests__/amatur.test.ts`.)*
- [ ] *(CI enforcement of all of the above is deferred → C002 in [cicd_tasks.md](cicd_tasks.md).)*

**Done when:** a fresh clone can build the full schema with `supabase db reset`; the 4 invariants pass via `supabase test db` locally. *(Met to the extent history immutability allows: the additive chain + invariants are verified via the prod-parity replay; full fresh-clone `db reset` lands with T021's baseline.)*

### T021 · Reconcile prod↔repo schema drift — §2.2 `P1` `M`
**Files:** `supabase/migrations/*`, `supabase/full_migration.sql`, `supabase/run_migrations.ps1`, `TECHNICAL.md`, `src/services/reviews.ts`
- [ ] `supabase db dump --schema public` from prod; diff against a clean chain replay (after T020).
- [ ] For each prod-only object: back-port a migration (if live) or drop it in prod (vestigial `public.check_ins`, `public.messages` — confirm empty/unused first, per 056's comments).
- [ ] Resolve the 073/074 `.sql`/`.txt` twins: determine which version of `admin_get_venues_in_viewport` prod runs, back-port the winner, delete the loser.
- [ ] Delete `full_migration.sql` and `run_migrations.ps1`; update `TECHNICAL.md` to document `supabase db reset` / `db push` as the only procedure.
- [ ] Delete the dead `flagReview` export and its `rpc('flag_review')` call (`src/services/reviews.ts:42`) — 072's report flow supersedes it; the RPC exists nowhere.
- [ ] *(Recurring drift detection is deferred → C003 in [cicd_tasks.md](cicd_tasks.md); until then, re-run the dump-vs-replay diff manually after each prod deploy of migrations.)*

### T022 [P] · Import provenance for OSM/seed data operations — §2.5 `P1` `M`
**Files:** `supabase/migrations/092_import_provenance.sql`, `supabase/seeds/osm/*.sh`, `scripts/`
- [x] Commit `apply_with_geo_dedup.sh`, `apply_new_cities_only.sh`, `fix_imported_venues_nets.sql`, and the wien upsert (requires the `.gitignore` fix from T009/T026 for `scripts/`). *(All untracked-but-committable now that the blanket `scripts/` ignore is gone; actual `git commit` left to you with the rest of this work.)*
- [x] Add `venues.source TEXT` (`'user' | 'curated_seed' | 'osm_<batch>'`) and an `import_runs` table (run_id, started_at, file, radius_m, row counts). *(`supabase/migrations/093_import_provenance.sql`; ledger is admin-read RLS.)*
- [x] Update the apply scripts to write an `import_runs` row and stamp `import_run_id` + `source` on inserted venues; rollback becomes `DELETE WHERE import_run_id = X` (replaces the id-watermark heuristic that can destroy user submissions). *(Both scripts; stamping guards on `submitted_by IS NULL AND source='user'` so mid-run user submissions are never claimed. Stamp + exact-rollback flow verified against the replayed chain.)*
- [x] Backfill `source` for existing rows where derivable (id ranges from the watermark files); move `tables.json` + wien csv/json intermediates under `scripts/osm-import/` or delete. *(093 backfills the 2026-06-08 wave (C0=1058/V0=3922) into a retroactive `import_runs` row — prod-only, no-op on fresh replays. Intermediates moved to `scripts/osm-import/data/` (ignored); the appliable wien .sql seeds stay in `supabase/seeds/`.)*

### T023 · Release signing + version source of truth (EAS) — §8.1, §8.3 `P0 for any release` `M`
**Files:** `eas.json`, `app.json`, `scripts/build-android.ps1`, `scripts/BUILD-ANDROID.md`
- [ ] Run `eas credentials` to create/upload a real Android release keystore (and iOS credentials while there).
- [ ] `eas.json` production profile: `"appVersionSource": "remote"`, `"autoIncrement": true`.
- [ ] Set the real version line in `app.json` (`expo.version: "0.0.8"`), add `ios.buildNumber`; stop trusting `package.json` version (mirror via `npm version` script or ignore it).
- [ ] Add a warning header to `scripts/BUILD-ANDROID.md`: local `assembleRelease` output is debug-signed and must never be distributed; have the script read the artifact name from `app.json` if it stays for dev builds.
- [ ] Produce one `eas build --profile production --platform android` and verify: release-signed (`apksigner verify --print-certs`), correct versionName/versionCode.

**Done when:** the next distributed APK/AAB is release-signed with an incremented versionCode, and the in-app version matches the artifact.

### T024 · OTA updates via expo-updates — §8.2 `P1` `M`
**Depends on:** T023 (maintained version field).
**Files:** `package.json`, `app.json`, `eas.json`
- [ ] `npx expo install expo-updates`; set `"runtimeVersion": { "policy": "appVersion" }` + EAS updates URL in `app.json`.
- [ ] Add `"channel": "preview"` / `"production"` to the eas.json build profiles.
- [ ] Document the flow: JS-only fixes ship via `eas update --channel preview`; native changes require a new build (runtimeVersion bump).
- [ ] Verify an end-to-end OTA: build → install → publish update → relaunch picks it up.

### T025 · ~~EAS profiles + tag-triggered build automation~~ → **moved to [cicd_tasks.md](cicd_tasks.md) C004** (deferred)

### T026 [P] · Full repo hygiene — §8.7 `P2` `S`
**Files:** `.gitignore`, repo root, `docs/`, `index.html`, `js/`, `css/`, `scripts/`
- [x] Move `postmortem.md`, `supabase_cli*.md`, `supabase_realtime.md` into `docs/`; delete the root screenshot and APK (store release artifacts in GitHub Releases). *(Notes moved; screenshot deleted. **APK kept**: v0.0.7-alpha is NOT in GitHub Releases (latest is v0.0.6) — upload it to a release first, then delete; it's gitignored, so the push hazard is already gone.)*
- [x] `git rm -r index.html js css` (legacy pre-app site; deploy serves `web/out`). *(Removed; deploy.yml confirmed to serve web/out + dist only.)*
- [x] Replace the blanket `scripts/` ignore with specific entries for genuinely-local files so build/ops tooling is committable (unblocks T022). *(Only `scripts/osm-import/data/` (134MB extracts) stays ignored; scanned the rest for secrets — clean, all committable now.)*

### T027 [P] · Geo foundation: PostGIS — §2.4 `P2` `M`
**Files:** `supabase/migrations/093_postgis.sql`, `supabase/seeds/osm/apply_with_geo_dedup.sh`, viewport/admin RPCs
- [ ] `CREATE EXTENSION postgis`; add `geom geography(Point,4326) GENERATED ALWAYS AS (...) STORED` + GIST index on `venues` (keep `lat`/`lng` for client payloads).
- [ ] Replace the awk-injected haversine dedup gate with `WHERE NOT EXISTS (... ST_DWithin(e.geom, ST_MakePoint(...)::geography, 50))`.
- [ ] Reimplement `admin_get_venues_in_viewport` with `ST_MakeEnvelope && geom`; add a `get_venues_near(lat,lng,radius)` RPC for future near-me/busyness features.
- [ ] Do this **before** the Berlin-scale imports run (33k-venue catalog).

---

## Phase 3 — Offline & resilience correctness

### T030 · Module-level offline replay-handler registry — §4.3 `P1` `M`
**Files:** `src/lib/offlineHandlers.ts` (new), `src/contexts/OfflineQueueProvider.tsx`, `src/hooks/queries/useFavoritesQuery.ts`, `src/contexts/NotificationProvider.tsx`
- [x] Static registry mapping entityType → service function (`favorite` → favorites service, `notification-read`/`-delete` → notifications service), imported by the provider — handlers exist regardless of mounted screens. *(`src/lib/offlineHandlers.ts`; the favorite handler invalidates via the `queryClient` singleton. `registerOfflineHandler()` is the extension point for feature modules — check-ins use it in T031.)*
- [x] Remove the component-scoped `registerHandler` effects (also fixes the unmount-clobber bug when two consumers share an entityType). *(Removed from `useFavoritesQuery` + `NotificationProvider`; `registerHandler` dropped from the context type entirely.)*
- [x] Keep `useToggleFavoriteMutation`'s optimistic/enqueue behavior; only replay moves to the registry. *(Verified — full suite green; provider tests prove replay works with no screen mounted.)*

### T031 · Offline-aware check-ins (and honest offline messaging) — §4.4 `P1` `M`
**Depends on:** T030.
**Files:** `src/screens/VenueDetailScreen.tsx`, `src/services/checkins.ts`, `src/lib/offlineHandlers.ts`, `src/screens/WriteReviewScreen.tsx`, `src/screens/EventDetailScreen.tsx`
- [x] Tier 1 (all three actions): branch on `useOfflineQueue().isOnline` — show a specific "You're offline" message instead of `genericError`; preserve the user's input (review text stays in the form). *(`offlineActionError` key ×8 locales; WriteReviewScreen + EventDetailScreen pre-check and return without clearing state; check-ins get tier 2.)*
- [x] Tier 2 (check-ins only): enqueue with original `started_at`/`ended_at` (service already accepts explicit timestamps); register a root replay handler; show the success sheet with a "will sync when online" note. Reviews/RSVPs stay online-only with the better messaging. *(`checkin` handler in `lib/offlineHandlers`; timestamped entityId so multiple offline check-ins don't dedupe each other; CheckinSuccessSheet gained a `queuedOffline` note (`checkinQueuedNote` ×8 locales).)*
- [x] Verify the one-active-check-in guard handles a queued check-in replaying after the user checked in elsewhere (replay should no-op or close the older one — decide and test). *(Decided: live check-in at the SAME venue supersedes → replay no-ops; live check-in at a DIFFERENT venue → the queued (older) one is closed at now() so the session is recorded without double presence; already-ended check-ins insert as-is. All covered in `src/lib/__tests__/offlineHandlers.test.ts`.)*

### T032 · Venue detail offline fallback + correct error state — §4.5 `P1` `M`
**Files:** `src/hooks/queries/useVenueDetailQuery.ts`, `src/screens/VenueDetailScreen.tsx`, `src/lib/venueDetailCache.ts`
- [x] In the queryFn: on success, call `saveCachedVenueMeta`/`saveCachedVenueReviews`; on RPC error, fall back to the cached pair and synthesize a partial bundle flagged `fromCache: true` (personalized fields null). *(The write-only cache finally has readers; 4 queryFn behaviors unit-tested in `useVenueDetailQuery.test.ts`.)*
- [x] Screen: distinguish `isError` (network → ErrorState with Retry + Back) from `data === null` (genuinely missing → `notFound`); disable check-in/favorite when `fromCache`. *(ErrorState + back button when nothing cached. Reconciled with T031: only the FAVORITE toggle is blocked when `fromCache` (its direction flips on the unknown `is_favorited`); check-ins stay enabled and queue offline per T031.)*
- [x] If instead the decision is "offline venue detail is out of scope": delete `venueDetailCache.ts` and its invalidate call sites — don't keep a write-only cache. *(N/A — wired it in.)*

### T033 · Per-user state cleanup on sign-out + queue dead-letter — §4.6 `P1` `M`
**Files:** `src/contexts/SessionProvider.tsx`, `src/lib/offlineQueue.ts`, `src/contexts/OfflineQueueProvider.tsx`, cache modules
- [x] On `SIGNED_OUT` (the `onAuthStateChange` handler exists at `SessionProvider.tsx:90-95`): `offlineQueue.clear()`, `clearAllEventsCacheForUser(prevUserId)`, remove play-history/profile cache keys by prefix, `queryClient.clear()`. *(`clearPerUserStateOnSignOut` — the outgoing user id comes from a session mirror ref since the auth callback closes over the first render.)*
- [x] Add `attempts` to `QueuedChange`; in `flush`, dequeue-and-log entries after 5 failures or older than 7 days (dead-letter into the logger/Grafana so drops are visible). *(`recordFailedAttempt`/`isDeadLetter`; flush logs `logger.error('OfflineQueue: dead-letter…')`. Pre-existing persisted entries get `attempts: 0` backfilled on read.)*
- [x] Cap queue length (e.g. 200) to bound MMKV growth. *(`MAX_QUEUE_LENGTH = 200`, oldest dropped with a warn log.)*
- [x] Tests in T036 cover both behaviors. *(They do — see T036.)*

### T034 [P] · Cache schema versioning — §4.7 `P2` `S`
**Files:** `src/lib/cacheUtils.ts`, `src/lib/venuesPersistentCache.ts`, `src/lib/citiesPersistentCache.ts`, `src/lib/offline-cache.ts`
- [x] Single `CACHE_SCHEMA_VERSION` constant stored inside each persisted envelope (`{ v, data, syncedAt }`) and as a `schema_version` row in the SQLite cache. *(`src/lib/cacheSchema.ts` (own module — avoids a cacheUtils↔offline-cache import cycle), re-exported from `cacheUtils`. SQLite store wipes all rows on mismatch via a `__schema_version__` row; venues/cities MMKV envelopes carry `v`.)*
- [x] On read, version mismatch ⇒ cache miss (forces full delta fetch with `since=null`); centralize in `cacheUtils.ts` so every domain cache inherits it. *(Every SQLite-backed domain cache inherits the wipe; the two MMKV delta caches check per-envelope. Pre-versioning envelopes (no `v`) read as misses. Covered in `cacheSchemaVersioning.test.ts`.)*
- [x] Clear orphaned legacy MMKV stores on bump (one-time `clearAll()` on the old store id). *(Not needed: envelope versioning supersedes store-id bumps going forward — `…-cache-v2` ids stay stable and stale envelopes read as misses; instantiating guessed legacy store ids just to clear them would create empty store files.)*

### T035 [P] · Fix staleness indicators — §4.8 `P2` `S`
**Files:** `src/screens/MapViewScreen.tsx` (line ~107), `src/hooks/queries/useVenuesQuery.ts`, `src/screens/EventSchedulingScreen.tsx`
- [x] Surface a real `fromCache` from `useVenuesQuery` (the queryFn knows when it served cache on error) and feed the existing banner — delete `const fromCache = false;`. *(Query data is now `{venues, fromCache}` internally; the hook's public shape is unchanged plus a `fromCache` field. Cache-first hydration via `initialData` deliberately does NOT trigger the banner — only a failed delta sync does.)*
- [x] EventSchedulingScreen: only `setEventsError(true)` when `events.length === 0`; with cached data visible, render a "showing cached data" banner above the list instead of replacing it. *(Tracks `servedFromCache` per fetch; failures with cached data on screen show the `offlineData` banner instead of the full-screen ErrorState.)*
- [ ] Optional: small global offline banner in the `(tabs)` layout driven by `useOfflineQueue().isOnline`. *(Skipped — optional; the per-surface banners cover the offline story.)*

### T036 [P] · Offline queue unit tests — §3.6 `P1` `S`
**Files:** `src/lib/__tests__/offlineQueue.test.ts` (new), `src/contexts/__tests__/OfflineQueueProvider.test.tsx` (new)
- [x] `offlineQueue`: enqueue dedups same (entityType, entityId, operation) keeping newest payload; dequeue by id; corrupted JSON returns `[]`; clear() empties; attempts/dead-letter from T033. *(`src/lib/__tests__/offlineQueue.test.ts` — 11 tests incl. cap-drops-oldest and legacy-entry attempts backfill.)*
- [x] Provider (capture the NetInfo mock callback from jest.setup): offline→online flushes; handler `{error}` or throw leaves item queued; success dequeues; concurrent flush no-ops; mount-with-pending flushes (T006); pendingCount updates. *(`OfflineQueueProvider.test.tsx` — 8 tests driving `onlineManager` (the provider's actual signal since T005) incl. dead-letter drop + missing-handler retention; plus `SessionProvider.signout.test.tsx` for the T033 cleanup.)*

---

## Phase 4 — Performance

### T040 · Map clustering with supercluster — §6.1, §8.4 `P1` `M`

> **REVERTED 2026-06-11 (Tavi's call):** clustering removed after iOS field testing — react-native-maps 1.x has no Fabric-native iOS impl, and the cluster↔pin marker churn during zoom both crashed the interop layer (fixed via `patches/react-native-maps+1.20.1.patch`, kept) and made pins fade/remount. The map now renders ALL pins with stable per-venue identity: no region listener, pan/zoom re-renders nothing, repaints only on per-pin content change. `supercluster` removed from deps.
**Files:** `src/screens/MapViewScreen.tsx`, `package.json`, `jest.setup.js`, `improvements.md`
- [x] `npm uninstall react-native-map-clustering`; delete its jest mock; correct the stale "4.3 Done" entry in `improvements.md`.
- [x] Add `supercluster`: build a memoized index from `venues`; recompute visible clusters in `onRegionChangeComplete` (the Android shim already translates it — `react-native-maps.android.js:151-165`); render cluster bubbles (count) vs venue pins; tap-to-zoom on clusters. *(`src/components/VenueMarkers.tsx` — memoized index, region→zoom/bbox helpers, sized count bubbles, `getClusterExpansionZoom` tap-to-zoom; the screen also updates region state directly on cluster taps/city switches since some shims fire `onRegionChangeComplete` late.)*
- [x] Works identically across Apple Maps / MapLibre shim / Leaflet shim since it feeds plain Markers. Fallback if descoped: cap rendered markers to the viewport bbox. *(Plain Markers; the bbox clamp is inherent — only clusters/pins inside the padded viewport render. Cluster/expand behavior unit-tested in `VenueMarkers.test.tsx` with a 30-venue dense blob.)*
- [ ] Validate with the Berlin seed (~951 venues): pan/zoom stays smooth on a mid-range Android device. **(Needs device: run the Berlin seed + a mid-range Android phone.)**

### T041 [P] · Map screen re-render hygiene — §6.2, §6.3 `P1` `M`
**Files:** `src/screens/MapViewScreen.tsx`
- [x] Remove the `key={`map-${selectedCity?.id}`}` from MapView — rely on the existing `animateToRegion` effect (lines 144–148); verify callout/selection state across city switches (expose a cheap `clearSelection` if needed). *(Removed; the city-switch effect now also seeds the region state for clustering. No persistent selection state exists — callouts are transient — so no `clearSelection` needed.)*
- [x] Extract a `React.memo` `VenueMarkers` component keyed on debounced/filter inputs; consider not filtering **markers** by search text at all (only the list needs it). *(Adopted: markers get `chipFilteredVenues` (no search text); the list keeps chip+search+sort.)*
- [x] Move the search TextInput + state into a `SearchBar` child reporting debounced changes up. *(`src/components/MapSearchBar.tsx` — owns keystroke state + the 150ms debounce; parent only sees settled queries.)*
- [x] Replace the friend-presence `useEffect`→`useState` copies (lines 83–84, 154–158) with `useMemo` derivations; memoize the FlatList row component. *(`VenueListRow` memo with precomputed label props.)*
- [x] Add a render-count test to `src/__tests__/perf/` asserting markers don't re-render per keystroke. *(`mapMarkers.perf.test.tsx` — 4 keystrokes + debounce settle, marker render count must not move.)*

### T042 [P] · Events list virtualization — §6.4 `P2` `M`
**Files:** `src/screens/EventSchedulingScreen.tsx`
- [x] Convert the ScrollView + `events.map` to FlashList: `ListHeaderComponent` for the sub-tab bar + challenge banner, memoized `EventCard` row with primitive props, `onEndReached={loadMorePastEvents}` gated to the past tab. *(One always-mounted FlashList serving regular AND amatur tabs — `ListEmptyComponent` carries loading/error/empty so the tab bar never remounts across state transitions (a remount broke tab presses mid-load). Entering animations removed from rows per T046.)*
- [x] Delete the manual `onScroll` distance-from-bottom pagination. *(Replaced by `onEndReached` @ 0.6 threshold, past tab only.)*
- [x] Audit Favorites/PlayHistory/Friends for the same conversion where lists exceed ~30 rows. *(Audited: Favorites/Friends are small user-bounded lists (ScrollView+map is fine); PlayHistory accumulates 20-row pages and IS a candidate — deferred to its T050 react-query migration so the list+data layer convert in one pass.)*

### T043 [P] · Events query: respect cache, trim payload — §6.5 `P2` `S`
**Files:** `src/screens/EventSchedulingScreen.tsx`, `src/services/events.ts`
- [x] Focus handler: `fetchEvents(false)` so the 60s TTL fast-path applies on tab toggles (or fold into a `useEventsQuery` hook per T050).
- [x] Replace `select('*')` with the explicit columns `EventListItem` uses; cap the participants embed `.limit(6, { referencedTable: 'event_participants' })` + `event_participants(count)` for the spots text; fetch the current user's own participant row via a filtered embed alias (the `ep_filter` pattern at `events.ts:24`). *(`participants_count` + `my_participation` aliases; the screen now passes userId for every tab so joined-state/myRow read the filtered alias instead of scanning the (now capped) embed; spots text uses the count aggregate.)*

### T044 [P] · Exclude MapLibre from iOS builds — §6.7 `P1` `S`
**Files:** `react-native.config.js`, `app.json`
- [x] Add `'@maplibre/maplibre-react-native': { platforms: { ios: null } }`. *(react-native.config.js — the reciprocal of the existing maps/Android exclusion.)*
- [x] Check the config plugin (app.json:121) — if it writes iOS settings, scope it to Android. *(It does — dSYM build settings, signature stripping, a Podfile `$MLRN.post_install` hook. Replaced with `plugins/withMapLibreAndroidOnly.js`, which inlines upstream v11.0.1's gradle-properties half (the package's exports map blocks deep-importing it).)*
- [x] Verify: `npx expo prebuild -p ios` → `grep -i maplibre ios/Podfile.lock` is empty; record the IPA size delta. *(Verified at the layer prebuild consumes: `expo-modules-autolinking react-native-config` shows MapLibre excluded on iOS / present on Android, and a `--clean` prebuild produces zero maplibre refs in Podfile + pbxproj. Podfile.lock + IPA delta need a working CocoaPods — the local Ruby 4.0 install is incompatible with CocoaPods 1.16; the next EAS build will confirm.)*

### T045 [P] · Lazy locale loading — §6.8 `P2` `S`
**Files:** `src/contexts/I18nProvider.tsx`
- [x] Keep `en.json` static (fallback); switch the other 7 to inline `require()` in a switch keyed by selected language (Hermes defers parse until first require). The active language is known synchronously from MMKV, so the active locale loads with no fallback flash.
- [x] Web: dynamic `import()` so locales become split chunks. *(Web starts on the en fallback and swaps when the chunk lands; verified via a green `expo export --platform web`.)*
- [x] Update I18nProvider tests. *(Existing suite passes unchanged — it exercises the sync native path.)*

### T046 [P] · Entering-animation fixes on lists — §6.9 `P2` `S`
**Files:** `src/screens/MapViewScreen.tsx`, `src/screens/EventSchedulingScreen.tsx`, `src/screens/LeaderboardsScreen.tsx`
- [x] Gate `FadeInDown` stagger to the initial reveal (hasAnimated ref / animate only `index < initialNumToRender`). *(MapViewScreen's FlatList: `listRevealedRef` + `index < 8`, done with T041.)*
- [x] Remove entering animations from FlashList rows entirely (recycling breaks the semantics). *(EventSchedulingScreen rows lost them in the T042 conversion; LeaderboardsScreen rows stripped here.)*

### T047 [P] · Move sync SQLite KV caches to MMKV — §6.10 `P2` `M`
**Files:** `src/lib/offline-cache.ts`, `src/lib/cacheUtils.ts`
- [x] Swap `getCacheItem`/`setCacheItem` internals from sync expo-sqlite to MMKV (same exported signatures — the venues cache already shows the pattern); one-time migration read from the old SQLite db. *(`offline-kv-cache` MMKV store, `{v, t}` envelopes; one-time SQLite row copy guarded by a migrated flag; legacy rows freed after copy. Bonus: the cache now works on web too (SQLite was a no-op there). Jest needed a between-test MMKV reset (`jest.setup.afterEnv.js`) — the cache became real under tests and cache-first screens were short-circuiting fetches.)*
- [x] Coordinate with T034 (do the version envelope in the same pass). *(Schema-version row carried over; mismatch wipes the MMKV store.)*
- [x] Alternative if MMKV size limits bite: switch to async SQLite API and make `loadCached*` awaitable. *(N/A — MMKV path taken.)*

### T048 [P] · Bundle Leaflet on web (drop unpkg runtime injection) — §8.6 `P2` `S`
**Files:** `src/shims/react-native-maps.web.js`, `package.json`, `index.html` cleanup via T026
- [x] Add `leaflet@1.9.4` as a root dependency; `import L from 'leaflet'` + `import 'leaflet/dist/leaflet.css'` in the shim; delete the `createElement('script')` injection. *(JS bundled via a lazy require — leaflet touches `window` at module scope, which broke expo-router's static-render pass. The CSS is vendored as a string module (`src/shims/leafletCss.js`): Metro web can't resolve the stylesheet's relative `url(images/…)` refs, which back controls the app never renders. Also fixed the shim's `animateToRegion` fixed-zoom-14 so T040's cluster tap-to-zoom works on web.)*
- [x] If CDN must stay for some reason: pinned SRI hashes + `crossorigin` + onerror fallback to jsdelivr. *(N/A — fully bundled.)*
- [x] Verify the web map renders offline-from-CDN-perspective (only GitHub Pages + tile server needed). *(`expo export --platform web` green with zero `unpkg` references in the emitted bundles.)*

---

## Phase 5 — Architecture & code quality (rolling)

### T050 · Standardize data access on react-query hooks — §5.1 `P2` `L` *(screen-by-screen; each bullet is independently shippable)*
**Pattern:** the `useLeaderboardQuery` shape — queryFn calls the service and mirrors to the domain cache via `saveCached*`; `initialData` seeds from `loadCached*`; invalidation through one helper.
- [x] Add `invalidateDomain(qc, key)` helper that invalidates both the react-query key and the domain cache; move `cachedInvalidate` calls out of services into mutation `onSettled`. *(Helper in cacheUtils; the onSettled migration happens per-screen as each converts.)*
- [ ] FriendsScreen → the already-written `useFriendsQuery`/`usePendingFriendRequestsQuery` (first move the requester/addressee→`friend` normalization from `FriendsScreen.tsx:101-105` into the hook/service). *(Hook half DONE: `normalizeFriendships` lives in useFriendsQuery, both hooks mirror to friendsCache + hydrate initialData — the screen rewire (incl. playing-friends derivation) remains.)*
- [ ] ProfileScreen + PlayerProfileScreen → `useProfileQuery`/`useProfileStatsQuery` (already written, zero consumers). *(Hooks upgraded to the blessed shape (cache mirror + hydration); screen rewires remain.)*
- [ ] EventSchedulingScreen → new `useEventsQuery` (hardest: fetch-sequencing refs + past-tab pagination → `useInfiniteQuery`; coordinate with T042/T043).
- [ ] PlayHistoryScreen, EquipmentScreen, AdminModerationScreen (with T053) — one at a time.
- [ ] Delete the per-screen `loadCached → setState → fetch → saveCached` orchestration as each screen migrates.

### T051 [P] · Generated Supabase types — §5.3 `P2` `M`
**Files:** `src/lib/supabase.ts`, `src/types/supabase.ts` (generated), `src/types/database.ts`, `package.json`, CI
- [x] `supabase gen types typescript --project-id vzewwlaqqgukjkqjyfoq --schema public > src/types/supabase.ts`; `createClient<Database>(...)`. *(IMPORTANT: types are generated from the prod-parity CONTAINER (replay script + `PUBLISH_PORT=54329` + `--db-url`), NOT from prod — prod still lacks 082–095, so prod-generated types are missing the RPCs the client already calls. After the prod push, `npm run gen:types` (project-id form) becomes correct. Typing the client surfaced and fixed 27 real mismatches: ~16 null-vs-undefined RPC args, 6 hand-written row types wrong about NOT NULL columns (Venue.city/address/lat/lng, Review.body, Profile.lang), SessionProvider's profile upserts could never legally insert (username NOT NULL since 036) → switched to update().eq(), and `flagReview` called an RPC that exists NOWHERE (not prod, not migrations) with zero consumers → deleted. Bonus drift report — prod-only: close_event, get_venues_in_bounds/viewport, haversine_m + 8 legacy tables (check_ins, *_old, messages…); feeds T021.)*
- [x] Re-export legacy names from `types/database.ts` as aliases of `Tables<'...'>` (no big-bang rename). *(Kept the hand-written interfaces but corrected them against the generated truth — services compile against both; full alias swap can follow gradually.)*
- [x] Add the gen command as an npm script; regenerate whenever migrations change *(CI freshness check deferred → C007)*. *(`npm run gen:types`.)*
- [ ] Burn down `useState<any[]>` by typing service returns; enable `@typescript-eslint/no-explicit-any: warn` to stop new growth (209 occurrences today — track the count). *(Count at 2026-06-11: 208 `: any` annotations outside tests. Rule NOT enabled yet — it would add ~200 warnings and drown the 2-warning lint baseline; enable once the count drops meaningfully.)*

### T052 [P] · Split AdminModerationScreen; shared venue form — §5.4 `P2` `L`
**Files:** `src/screens/AdminModerationScreen.tsx` → `src/screens/AdminModeration/*`, `src/components/VenueFormFields.tsx` (new), `src/hooks/useVenueForm.ts` (new), `src/screens/AddVenueScreen.tsx`
- [ ] Extract per-tab files (PendingVenuesTab, FlaggedReviewsTab, ReportsTab, ChangeRequestsTab, FeedbackTab, ModeratorsModal, VenueEditModal); shell keeps only the tab enum. *(First slice DONE: the four memoized cards + format helpers + option constants moved to `AdminModeration/cards.tsx` — screen 1656→1318 lines, gate green. The per-tab/fetch/modal split remains; it shares one closure of state + handlers and should ride along with the react-query conversion below.)*
- [ ] Extract `VenueFormFields` + `useVenueForm` (state, validation, AddressPickerField wiring) shared by AddVenueScreen, the admin edit modal, and VenueChangeRequestModal — kills the ~22-field duplication.
- [ ] Convert per-tab list state to react-query hooks (pairs with T050).

### T053 [P] · Typed routes: kill the 51 `as any` href casts — §5.5 `P2` `S`
- [x] Replace template-string hrefs with `router.push({ pathname, params })` typed objects (51 sites; mechanical). *(All 51 gone: static literals just dropped the cast (typed routes validate them), dynamic hrefs became `{ pathname: '/x/[id]', params }`, and the 6 runtime-validated strings (sanitizeRoute, notification routes, +not-found recovery) use `as Href` instead of `as any`.)*
- [x] ESLint `no-restricted-syntax` rule banning `as any` inside `router.push/replace` args.
- [x] Verify route typegen runs under `npm run typecheck`. *(tsconfig includes `.expo/types/**` — the typed-object literals failed compilation until they matched real routes, which is the proof.)*

### T054 [P] · Cross-platform dialogs lib — §5.6 `P2` `M`
**Files:** `src/lib/dialogs.ts` (new), 82 call sites in 23 files
- [x] `showAlert(title, msg)` and `showConfirm(title, msg, {confirmLabel, destructive}) → Promise<boolean>`; native → `Alert.alert`, web → `window.alert`/`window.confirm` (or the existing bottom-sheet confirm for visual parity). *(`src/lib/dialogs.ts`.)*
- [x] Codemod: 1–2-arg alerts are mechanical; the ~15 button-callback confirms become `if (await showConfirm(...))`. *(73 mechanical conversions across 21 files; 8 button-callback confirms converted to `await showConfirm` — logout, delete-all-notifications, admin feedback delete, delete account, block user, already-checked-in, add-friend, stop-recurrence. Alert spies in tests keep working since showAlert/showConfirm delegate to Alert.alert on native.)*
- [x] ESLint `no-restricted-imports` for `Alert` outside `lib/dialogs.ts`; remove the ad-hoc web fallbacks in DeleteAccountScreen/BlockedUsersScreen/VenueDetailScreen. *(All three ad-hoc fallbacks (incl. two SELF-RECURSIVE local showAlert wrappers the codemod exposed) deleted. One legit Alert remains: VenueDetail's dynamic review action-sheet (has its own web prompt fallback) — inline-disabled.)*
- [ ] Manually verify event cancel + admin venue delete confirms on web. **(Needs browser session — `npx expo start` → web.)*

### T055 [P] · Dead-code removal + guard — §5.7 `P2` `S`
- [x] Decide the activity-feed chain: route it (a `features_suggestions.md` item resurrects it for Session Moments) **or** delete screen+hook+service+cache. Don't leave it orphaned. *(Decision: KEEP, documented in a header note in the screen — the chain is tested, was just migrated to the 083 RPC, and the roadmap reuses it for Session Moments. Routing it is a product call; delete the chain if Session Moments is descoped.)*
- [x] Delete: `screens/ForgotPasswordScreen.tsx` (static mock), `SignupLoginScreen.tsx`, `SplashScreen.tsx`, `HeaderProfileIcon`/`ProfilePopover`, `lib/perf.ts`, and their barrel exports. Keep `ShareCard` only if the features roadmap is imminent — otherwise delete (it's in git history). *(All deleted incl. ShareCard + their orphaned tests — EXCEPT `lib/perf.ts`, which the doc miscalled: it's imported by the two perf bench tests. Kept.)*
- [x] `favoritesCache`: either seed `useFavoritesQuery` with `initialData` from `loadCachedFavorites` (matching the blessed pattern) or delete the unused load/save. *(Wired in: initialData hydration + save-on-fetch.)*
- [x] Add `knip` (or `ts-prune`) as an npm script and run it after the purge *(CI enforcement deferred → C007)*. *(`npm run deadcode`.)*

### T056 [P] · De-duplicate AddressPickerField — §5.8 `P2` `M`
- [ ] Extract `useAddressPicker(props)` (shared state + geocode/search/city-match, leaning on `lib/addressSearch.ts`) and a shared `SuggestionsList`. *(NOT STARTED — deliberate: 1161 lines of interactive map UI with platform drift and thin jest coverage; doing it at the tail of this large pass risks the add-venue flow. Needs a focused session with on-device verification.)*
- [ ] Slim platform files to map rendering + gestures only (`AddressPickerMap.tsx` / `.ios.tsx`, ~100–150 lines each) under a single `AddressPickerField.tsx`.
- [ ] Reconcile the drift first (non-iOS `setParentScrollEnabled`/`reverseGeocodeLatLng` vs iOS marker-drag) so the hook covers both.

### T057 [P] · Move the 4 fat route files into `src/screens/` — §5.9 `P2` `S`
- [x] `app/sign-in.tsx` (776), `app/(protected)/create-event.tsx` (680 + styles), `app/reset-password.tsx` (556), `app/forgot-password.tsx` (290) → `src/screens/*`, leaving 5-line route wrappers. (Delete the dead ForgotPasswordScreen mock first — T055.) *(Named exports in src/screens, default-re-exporting wrappers in app/ — external importers (auth-edge-cases tests) keep working unchanged.)*
- [x] Move their tests next to the other screen tests. *(14 test files moved; mock depths fixed; the i18n-completeness audit now points at the screen files.)*

### T058 [P] · Consolidate the challenges domain — §5.10 `P2` `S`
- [x] Move `lib/challenges.ts` → `features/challenges/monthlyChallenges.ts` and `lib/badgeChallenges.ts` → `features/challenges/badgeDefinitions.ts`; fold cache usage behind the feature's hooks; re-export via the existing barrel. *(10 importers rewritten; the lib test moved alongside.)*
- [x] Document `src/features/` as the pattern for future domains in `CLAUDE.md` (or, if the team prefers, dissolve `features/challenges` instead — pick one, don't keep both). *(Chose features/; CLAUDE.md manual section now documents it plus the data-access pattern, the test commands, and the migrations-frozen rule.)*

### T059 [P] · Audit remaining service-layer cache invalidation drift — §5.1/§5.2 follow-up `P2` `S`
- [x] After T008/T050 land, grep for remaining direct service mutations from screens that skip both invalidation systems; convert or document each. *(Full audit of ~20 mutation call sites across 9 domains: 8 domains were already class-1 (both systems). Fixed: condition `submitVote` invalidated NOTHING → now invalidates venue detail; Settings `updateProfile` ×2 skipped react-query → now invalidates `profileQueryKey`. Documented: BlockedUsers unblock uses local state + refetch-on-mount deliberately.)*

---

## Phase 6 — UX, i18n & accessibility

### T060 · i18n: create-event screen — §7.1 `P1` `M`
**Files:** `src/app/(protected)/create-event.tsx` (then `src/screens/CreateEventScreen.tsx` after T057), `src/locales/*.json`, `src/screens/PlayerProfileScreen.tsx`
- [x] Extract all ~25 Romanian literals to en.json keys (title, placeholders, type/duration/recurrence options, validation alerts, submit states); translate into the 7 locales. *(26 keys ×8 locales; option arrays became `t`-parameterized builders. Non-en machine-translated — flag for native review.)*
- [x] Replace the hardcoded `'ro-RO'` date locale with `getDateLocale(lang)` (already imported); same fix in `PlayerProfileScreen.tsx:214`.
- [x] Grep the repo for remaining `'ro-RO'` literals and quoted Romanian strings in JSX; fix or ticket each. *(Last one was AdminModerationScreen's `Intl.DateTimeFormat('ro-RO')` → device locale. Zero `ro-RO` literals left outside I18nProvider's locale table.)*

### T061 · Shareable links + universal/app links — §7.2 `P1` `M`
**Files:** `src/lib/shareLinks.ts` (new), `src/screens/VenueDetailScreen.tsx`, `src/screens/EventDetailScreen.tsx`, `src/components/ShareCard.tsx`, `src/components/CheckinSuccessSheet.tsx`, `app.json`
- [x] `shareLinks.ts`: `venueUrl(id)` / `eventUrl(id)` → `${DEFAULT_WEB_APP_URL}/venue/${id}` etc.; append to every `Share.share` message (and `url` field on iOS). *(VenueDetail share + CheckinSuccessSheet share both carry the link now.)*
- [x] Add a share button to EventDetail for public events. *(Header share icon; gated off for friends/private events so visibility-scoped content doesn't leak via copy-paste.)*
- [x] `app.json`: `ios.associatedDomains: ['applinks:www.ttportal.org']` + host an AASA file; `android.intentFilters` for the web-app paths — coordinate with the planned ttportal.org DNS work (appstore list). *(Config added for /venue + /event paths. **Operator: host the AASA file + assetlinks.json on ttportal.org** — until then links open in the browser (web app), which still works.)*
- [ ] Test: shared venue link opens the venue in-app on a device with the app, and on web for everyone else. **(Needs device + hosted AASA.)**

### T062 [P] · Preserve `returnTo` through sign-up + onboarding — §7.4 `P1` `S`
**Files:** `src/app/sign-in.tsx` (line ~104), `src/screens/OnboardingScreen.tsx` (lines ~51–57)
- [x] Signup branch: `router.replace({ pathname: '/onboarding', params: { returnTo } })`.
- [x] Onboarding: read `returnTo` via `useLocalSearchParams`; `finish()`/skip → `router.replace(sanitizeRoute(returnTo) ?? '/(tabs)/')`.
- [x] Test: anonymous user taps check-in → registers → completes onboarding → lands back on the venue. *(OnboardingScreen tests: finish + skip honor `returnTo: '/venue/42'`; hostile values sanitize to the tabs root.)*

### T063 [P] · Plural rules for count strings — §7.5 `P2` `M`
**Files:** `src/contexts/I18nProvider.tsx`, `src/locales/*.json`
- [x] Add `sn(key, count, ...args)` using `Intl.PluralRules(getDateLocale(lang)).select(count)` resolving `key_one/key_few/key_many/key_other` with bare-key fallback.
- [x] Migrate the ~10 count keys (cityModalCityCount, cityModalVenueCount, cityHeaderPlacesMapped, eventInvitedFriendsCount, challengeCompletedCount, challengeMoreToEarn, locationSelectorShowing, cityModalShowingCities, …) and add plural variants in all 8 locales — Polish/Czech need few/many forms (machine-translate, flag for native review per the i18n memory). *(Audited: only 4 of the listed keys have live consumers (eventInvitedFriendsCount, challengeMoreToEarn, challengeCompletedCount, cityModalVenueCount) — those migrated with `_one` everywhere + `_few`/`_many` for ro/pl/cs (ro bare keys gained the "de" 20+ forms). The dormant keys migrate when their UI returns. Locale parity tests now compare BASE keys since variants are language-specific.)*
- [x] Unit tests: en 1/2, pl 1/2/5 select the right forms. *(Plus bare-key fallback.)*

### T064 [P] · Fix light-theme `textFaint` contrast — §7.6 `P1` `S`
**Files:** `src/theme.ts` (line ~86)
- [x] Either darken `textFaint` to ~`#6b736a` (≈4.6:1 on white), or split tokens: `textFaint` stays for decorative strokes, new `textSubtle` for placeholders/timestamps/inactive-tab tint — then update the ~40 placeholder + tab-bar usages. *(Took the one-line darken — all ~140 usages fixed at once, decorative strokes merely get slightly darker.)*
- [x] Verify against `bg`, `bgAlt`, and `primaryPale` chips with a contrast checker; eyeball dark theme unchanged. *(Computed: 4.90:1 on white, 4.52:1 on bgAlt, 4.13:1 on bgMid; dark theme untouched at 5.51:1.)*

### T065 [P] · Screen-reader pass on chrome + sheets — §7.7 `P2` `M`
**Files:** `src/components/NotificationBellButton.tsx`, `FullscreenImageViewer.tsx`, `DraggableSheet.tsx`, `CityPickerModal.tsx`, `InitialLocationSetupModal.tsx`, `NotificationInboxModal.tsx`, `CheckinSuccessSheet.tsx`
- [x] Bell: `accessibilityRole="button"`, label including unread count.
- [x] Image-viewer close: role + `s('close')` label.
- [x] DraggableSheet handle: `accessibilityRole="adjustable"` + `onAccessibilityAction` increment/decrement mapped to the 3 snap points (this is the only way AT users can expand the venue list). *(With `accessibilityValue` min/max/now and a localized `sheetHandleLabel` key ×8 locales.)*
- [x] Sweep the four prop-less modals for roles/labels on rows and buttons. *(NotificationInboxModal rows/accept/decline/header actions + CheckinSuccessSheet buttons; CityPicker/InitialLocationSetup render via LocationSelector, whose touchables predate this pass — swept the named surfaces.)*
- [ ] Verify with VoiceOver (iOS) and TalkBack (Android) on the map + notification flows. **(Needs device.)**

### T066 [P] · Map pins: colorblind-safe + labeled — §7.8 `P2` `S`
**Files:** `src/screens/MapViewScreen.tsx`
- [x] Marker child View: `accessibilityLabel={\`${venue.name}, ${typeLabel}, ${condInfo.label}\`}` (all computed already at lines 287–289). *(In VenueMarkers since the T040 extraction.)*
- [x] Enrich list-row labels (line ~479) with type/condition/rating so the sheet is a complete non-visual alternative.
- [x] Redundant visual cue for condition (small glyph or ring pattern per tier) so good/degraded isn't green-vs-red only; update the legend to match. *(Per-tier glyph badge on pins — check/minus/alert-triangle — mirrored in the legend.)*

### T067 [P] · Default-locale fallback — §7.9 `P1` `S`
**Files:** `src/contexts/I18nProvider.tsx` (line ~80), `src/contexts/__tests__`
- [x] `DEFAULT_LANG = 'en'`; optionally keep `ro` only when `Localization.getLocales()[0]?.regionCode === 'RO'`. *(Both: en default, ro kept for unsupported-language devices physically in Romania.)*
- [x] Update provider tests. *(Fallback test flipped to en + new RO-region and hostile cases.)*

### T068 [P] · Pull-to-refresh + focus refetch on Challenges & EventDetail — §7.10 `P2` `S`
**Files:** `src/screens/ChallengeScreen.tsx`, `src/screens/EventDetailScreen.tsx`
- [x] ChallengeScreen: RefreshControl wired to the existing loaders + `useFocusEffect` refetch (mirror EventSchedulingScreen's pattern). *(Both `refreshProgress` + `refreshChoices`; first-focus skipped like the events screen.)*
- [x] EventDetailScreen: RefreshControl on its ScrollView calling the existing loader — organizers can pull to see new RSVPs.

---

## Phase 7 — Testing depth & remaining deps

### T070 · Service-layer tests for the 11 untested modules — §3.4 `P1` `M`
**Files:** `src/test-utils/supabaseMock.ts` (new), `src/services/__tests__/*`
- [x] Extract the duplicated ~25-line `createQueryChain` mock into a shared util; refactor existing tests to use it. *(`src/test-utils/supabaseMock.ts`; all 7 duplicating suites migrated.)*
- [x] Add tests in priority order: `venuesDelta`/`citiesDelta`/`equipmentDelta` (watermark passed, upserts/tombstones merged, watermark advances only on success), `account.ts` (grace date set/cleared, errors propagate), `moderation.ts` (RPC names/params, self-block rejection), `pushTokens.ts` (upsert, removal on logout), then `notifications`/`favorites`/`leaderboard`/`conditions`/`equipment`. *(9 new suites / 49 tests; watermark-advance logic lives in the persistent caches (their own suites) — delta tests pin RPC names/params/passthrough. `imageEvidence` remains untested (image-pipeline mocking; small).)*

### T071 [P] · Real-QueryClient tests for query hooks — §3.5 `P2` `M`
**Files:** `src/hooks/queries/__tests__/` (new)
- [x] `jest.requireActual('@tanstack/react-query')` + real `QueryClient` (`retry: false`) via `renderHook` wrapper — bypassing the global mock for this directory. *(`jest.unmock` per-file; clients cleared/unmounted in afterEach so jest exits cleanly.)*
- [x] First targets: `useFavoritesQuery` optimistic add/remove + rollback on error + invalidate on settle (assert real cache state, not spies); `useVenuesQuery`/`useVenueDetailQuery` key correctness. *(14 tests: optimistic add/remove/rollback/offline-queue against real cache state; venue-detail user-scoped keys, prefix invalidation across user variants, and the fromCache offline fallback.)*
- [ ] Longer term: `renderWithProviders(ui, {queryClient})` util and migrate screen tests suite-by-suite off the global mock.

### T072 · ~~Coverage measurement in CI~~ → **moved to [cicd_tasks.md](cicd_tasks.md) C005** (deferred)
*(The `jest.config.js` `collectCoverageFrom`/reporters change can land any time independently — it makes local `npm run test:coverage` honest even without CI.)*

### T073 · Repair + de-prod the Maestro suite — §3.3 `P1` `L`
**Files:** `.maestro/**`
- [x] **Immediately:** remove the committed credentials from `helpers/login.yaml` (env-inject `${E2E_EMAIL}`/`${E2E_PASSWORD}`) and rotate the `andrei@test.com` password — it's live against prod. *(Creds removed from login.yaml + flows 02/20. **Operator: rotate the password — it's in git history.**)*
- [x] Fix flow 01 (drop/flag-guard the google/apple-button assertions); triage the remaining 19 flows locally. *(Flow 01 social assertions removed (SOCIAL_AUTH_ENABLED=false). 19-flow triage needs a simulator — known-broken text-taps documented in `.maestro/README.md`, incl. the T067 English-default impact.)*
- [ ] Replace text taps with testIDs; force a fixed locale via launch arguments. **(Needs simulator runs to verify each change.)**
- [x] Point E2E at `supabase start` local stack (or a staging project) with a seeded E2E user/venue — no more prod check-ins from test runs. *(Documented in `.maestro/README.md` — the target is baked into the installed build's env, so this is a build-time setting, not a flow change.)*
- [ ] Add flows for post-March surfaces: create+join event, challenge cooldown, venue change request, onboarding, notification inbox. **(Write alongside the simulator triage — flows authored blind can't be trusted.)**
- [ ] Run the suite locally (`npm run e2e`) as the verification gate for now *(nightly CI smoke deferred → C006)*.

### T074 [P] · `@types/jest` downgrade — §8.8 `P2` `S`
- [x] `"@types/jest": "^29.5.0"` + `npm install`; revisit when jest-expo ships jest 30. *(→ 29.5.14; suite + typecheck green.)*

### T075 [P] · Materialized-view refresh off the write path — §2.3 `P1` `M`
*(Listed here so the perf-sensitive DB change ships with tests; do before the OSM imports scale venues.)*
**Files:** `supabase/migrations/094_async_stats_refresh.sql`
- [x] Drop the AFTER-trigger calls to `refresh_stats()` from reviews (028) and profile renames (018). *(NEW migration `096_async_stats_refresh.sql` — 018/028 untouched per the frozen rule.)*
- [x] pg_cron job refreshing the 4 matviews every 2–5 minutes; or, if venue detail needs immediacy, an incremental `venue_stats_live` table maintained by per-row triggers with matviews cron-refreshed for leaderboards only. *(pg_cron `*/3` chosen; ≤3-min rating staleness accepted. Bonus finding: check-ins NEVER triggered a refresh before — leaderboard_checkins only updated when an unrelated review/rename fired; the cron fixes that uniformly.)*
- [x] Verify: review submit latency drops; rating on venue detail updates within the chosen staleness window; concurrent review writes no longer serialize. *(Container-verified: triggers gone, job scheduled alongside the 7 existing cron jobs, review insert runs without inline refresh — `99_assertions_096.sql`. Prod latency numbers measurable after the push.)*

---

## Phase 8 — Operational & strategic gaps (§9)

### T080 · Crash reporting (Sentry) — §9.1 `P0 before store launch` `M`
- [x] ~~`@sentry/react-native`~~ **Constraint applied (Tavi, 2026-06-11): stay on the current stack, no new monitoring vendors.** Implemented on the existing Grafana pipeline instead: `src/lib/telemetry.ts` installs global JS error handlers (ErrorUtils native / window error+unhandledrejection web) with PII scrub (emails/JWTs/UUIDs), MMKV-persisted queue, batched to a new `ingest-telemetry` Edge Function → Loki (`job=ttportal_app`). Dev builds keep the red box.
- [ ] EAS source-map upload; alert rule → Discord. *(Source maps N/A without Sentry — stacks arrive Hermes-mangled; symbolicate offline against the build's sourcemap when needed. **Operator: add a Grafana alert on `{job="ttportal_app", kind="crash"}` → the existing Discord contact point.**)*
- [x] Add Sentry to the Edge Functions per the same spec. *(Edge Functions already ship to Loki via `_shared/logger.ts` — nothing to add.)*

### T081 [P] · Product analytics events — §9.2 `P1` `M`
- [x] Decide the sink (extend the existing `trackProductEvent → logger.track → Grafana` pipeline vs PostHog). The B2B analytics in mspec need real collection plumbing — design the event schema (check-in funnel, venue-open→check-in conversion, event join funnel, retention cohort marker) once and reuse for both product decisions and future venue dashboards. *(Decision per stack constraint: extended the existing pipeline — `trackProductEvent` now ships to Loki via the telemetry queue in prod (console-only in dev). Schema: snake_case names, flat id-only payloads, client-side PII scrub, GDPR opt-out gated.)*
- [x] Instrument the 8–10 core events; build one retention/funnel dashboard. *(Events live: map_venue_opened → checkin_completed/checkin_queued_offline (conversion), signup_completed → onboarding_completed (acquisition), session_start (retention cohorts), event_opened/event_joined/event_created (events funnel), review_submitted, share_initiated + the existing challenge events. **Operator: build the Grafana dashboard over `{job="ttportal_app", kind="event"}` once events flow.**)*

### T082 [P] · GDPR export + retention policy — §9.3 `P1` `M`
- [x] Implement the mspec §11 "Your Data" settings section: download-my-data (Edge Function bundling profile, check-ins, reviews, events, equipment as JSON → signed URL) + the analytics opt-out toggle. *(`export-my-data` Edge Function (JWT-verified, 16 data sections, service-role reads, direct JSON download — no storage round-trip needed at current sizes) + Settings rows: share-usage-data toggle (crash reports stay, PII-scrubbed) and Download-my-data (Share on native, Blob download on web).)*
- [x] Decide and document a check-in retention window (or justification for indefinite retention); add a purge/anonymize cron if a window is chosen. *(`docs/data-retention.md`: indefinite-while-active with justification (badges/leaderboards/history read full history) + the compensating controls; notifications 90d and action_log 30d crons already existed.)*

### T083 [P] · Automated offsite backups — §9.4 `P1` `S`
- [x] Scheduled GitHub Action (daily): `supabase db dump` (schema + data) → encrypted artifact to private storage (e.g. age-encrypted to a private repo/release or S3/R2). *(`.github/workflows/db-backup.yml`: daily 02:40 UTC, schema+data+roles, size sanity check, age-encrypted, 90-day artifact. **Operator: set `SUPABASE_DB_URL`, `BACKUP_AGE_PUBLIC_KEY` (age-keygen; private key in the password manager) and `DISCORD_WEBHOOK_URL` secrets, run once, do a test decrypt.**)*
- [x] Document restore drill in `docs/db-restore.md`; alert on job failure (Discord). *(Runbook extended with the automated-backup restore path + a drill log table; Discord alert step in the workflow.)*

### T084 · Privacy controls — covered by **T018** (Phase 1). 

### T085 [P] · Support & feedback discoverability — §9.6 `P1` `S`
- [x] Settings row opening the existing `UserFeedbackModal`; add a "Contact support" row (mailto `ttportal.info@gmail.com` until ttportal.org/support exists — that page is already on the appstore checklist). *(New Support section in Settings; keys ×8 locales.)*

### T086 [P] · Notification preference center — §9.7 `P1` `M`
- [x] `profiles.notification_prefs jsonb` (or per-category columns) for: friend check-ins (exists — migrate it in), event updates/reminders/invites, reviews-on-my-venue, friend requests. *(Migration `097`: sparse jsonb (only disabled categories stored), legacy `notify_friend_checkins` backfilled AND still authoritative; column-grants extended per 085's pattern.)*
- [x] Consult prefs inside the trigger fan-out (one helper function all triggers call before insert/push). *(Every fan-out path already funnels through `create_and_send_notification` — recreated with a `notification_pref_enabled()` gate (signature unchanged, so all 8 triggers + 3 crons inherit it). Unmapped types fail-open. Container-verified incl. choke-point delivery/suppression: `99_assertions_097.sql`.)*
- [x] Settings UI: per-category toggles replacing the single toggle. *(4 new category toggles beside the existing check-ins one; keys ×8 locales. Deploy 097 with/before this client.)*

### T087 [P] · Egress/cost guardrail — §9.8 `P1` `S`
- [x] Implement the already-specced monitoring Phase 5 item: daily GitHub Action hitting the Supabase usage API, alert on >5× day-over-day egress to Discord; do this **before** the Berlin-scale OSM imports. *(`.github/workflows/egress-guardrail.yml`; degrades to a loud Discord warning if the usage-API shape changes. **Operator: set `SUPABASE_ACCESS_TOKEN` secret.**)*

### T088 [P] · SMTP production-readiness — §9.9 `P0 before launch` `S`
- [ ] Check the Supabase dashboard auth-email settings; configure a real SMTP provider (Resend/Postmark/SES) for confirmation + reset emails; mirror config notes into `supabase/config.toml` comments and docs. **(Operator/dashboard-only — full runbook written: `docs/smtp-production.md`, free-tier providers listed per the no-paid constraint, DNS coordinated with the AASA work.)**
- [ ] Load-test: 10 password resets in an hour all arrive. **(Operator, after SMTP config — procedure in the runbook.)**

### T089 [P] · Trust & safety groundwork — §9.10 `P2` `M`
- [x] Add an abuse audit-trail table (moderation actions: who, what, when) written by the admin RPCs. *(Migration `098`: `moderation_audit_log` written by SECURITY DEFINER triggers on the moderated transitions (venue approve/reject, flagged-review keep/delete, report resolution, moderator grant/revoke) — DB-side with `auth.uid()`, so no client can skip logging. Admin/moderator read-only RLS.)*
- [x] Keyword/URL filter helper for UGC inserts (reviews, change-request notes) as a soft flag into the reports queue — not a block. *(`ugc_suspicious()` against an admin-extendable `moderation_keywords` table (seeded with URL/telegram/whatsapp spam patterns); suspicious reviews auto-set `flagged` → they land in the EXISTING admin flagged queue + an audit row. Write never blocked. Container-verified: `99_assertions_098.sql`.)*
- [x] Pre-requisite for the DM/Moments/Board features; coordinate with T052's admin-screen split. *(Audit log + keyword infra in place; an admin UI for the audit log can ride T052's remaining split.)*

---

## Dependency graph (critical path)

```
T001 (fix tests — keeps the manual pre-push gate honest; also unblocks C001 later)
T003, T004 (independent, ship this week)
T005 → (T006 already independent)
T020 (db reset + pgTAP, local) ──┬── T010–T016 RLS series (each adds a pgTAP test)
                                 └── T021 drift reconciliation → T022 provenance
T023 signing → T024 OTA   (build automation deferred → C004)
T030 → T031 (offline write paths)
T050 ←→ T042/T043 (events screen: migrate + virtualize + trim in one pass if convenient)
T012 ←→ T017 (storage policies before/with condition-vote photo fix)
T018 before any presence-broadcasting feature from features_suggestions.md

Deferred CI/CD chain (see cicd_tasks.md): T001 → C001 → C002/C005/C007; T021 → C003; T023 → C004; T073 → C006
```

**Suggested first sprint (matches §"Suggested sequencing" week 1, minus the deferred CI gate):** T001, T003, T004, T005, T006, T007, T008, T009 — all `S` except T004 (`M`); two people can clear this in under a week. Until C001 lands, treat `npm test && npm run lint && npm run typecheck` as a mandatory manual pre-push gate — the deploy workflow publishes unchecked.
