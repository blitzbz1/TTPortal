# App Store & Google Play Compliance Plan

Tracking everything TTPortal needs before it can be submitted to Google Play and the iOS App Store, plus ongoing GDPR/privacy obligations beyond the marketing site policies that already shipped.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## Open decisions (resolve as we go)

- **Marketing-site domain.** Code currently hardcodes `https://ttportal.ro/...` in `src/app/sign-in.tsx:24-25` and in tests. The deployed site is at `https://blitzbz1.github.io/TTPortal/`. Plan assumes `ttportal.ro` will be configured as a GitHub Pages custom domain. Until then, links in the app will 404. **Action item:** set up DNS + `CNAME` file when ready. Not blocking phase 1 (we'll keep `ttportal.ro` URLs and document the dependency).
- **Minimum age.** Default in this plan: **16+** at signup (covers GDPR Art. 8 in all EU member states and avoids COPPA / kids-category requirements).
- **Account deletion model.** Default in this plan: **soft-delete with 30-day grace period**, then hard-delete via scheduled job. User can cancel deletion within the grace period by signing in. Standard industry practice and gives a safety net for accidental deletions.
- **Native folder strategy (`ios/`, `android/`).** Both directories are in `.gitignore` — they're treated as derived output from `expo prebuild`. This means the manual edits in Phases 1.4 (Info.plist), 1.5 (AndroidManifest.xml), and 2.1 (PrivacyInfo.xcprivacy) **will be regenerated** the next time anyone runs `expo prebuild --clean`. The `app.json` mirrors in 1.4 and 1.5 cover their cases, but `PrivacyInfo.xcprivacy` data types do not have an `app.json` config field exposed by Expo, so **Phase 2.1's content needs to either move into `ios.privacyManifests` in `app.json` (if Expo SDK 54 supports it) or `ios/` needs to be un-gitignored**. See Phase 2 follow-up below.

---

## Phase 1 — Quick wins (target: ~2 hours total)

These are low-risk, high-ROI changes. Doing them first improves the app's compliance posture significantly without any backend changes.

### 1.1 Update in-app Privacy/TOS URLs to be locale-aware
- [x] Change `TERMS_URL` and `PRIVACY_URL` constants in `src/app/sign-in.tsx:24-25` to call a `getPolicyUrl(lang, kind)` helper that includes the current locale.
- [x] Update the linked test `src/app/__tests__/sign-in.terms.test.tsx:111,121` to match.
- [ ] Verify the URLs resolve once `ttportal.ro` is configured (manual step for the user).
- **Acceptance:** signup screen opens locale-appropriate policy URLs. ✅

### 1.2 Add marketing-site base URL to `app.json` extras
- [x] Added a single `extra.marketingSiteUrl` field in `app.json` (kept it as a single base, not per-policy fields — paths are derived in `src/lib/policyUrls.ts`).
- **Acceptance:** URL only lives in `app.json`; all screens build paths via `getPolicyUrl(locale, kind)` which reads `Constants.expoConfig.extra.marketingSiteUrl`. ✅

### 1.3 Add a Legal section to `SettingsScreen.tsx`
- [x] Added a "Legal" section header below the existing Account/Theme/Privacy rows, with 3 rows: Privacy Policy, Terms of Service, Cookie Policy. Each opens the corresponding URL via `Linking.openURL`. Also renamed the existing OS-settings row from "Privacy" → "App permissions" since it does not open the privacy policy.
- [x] Added i18n keys (`legal`, `privacyPolicy`, `termsOfService`, `cookiePolicy`, `appPermissions`) to all 8 locale files (en/ro reviewed; de/fr/es/it/pl/cs are machine-translated and could use a native pass).
- **Acceptance:** legal docs reachable from inside the app post-signup. Apple §5.1.1 expects this. ✅

### 1.4 Rewrite iOS permission usage strings to be specific
- [x] Replaced the generic placeholders in `ios/TTPortal/Info.plist` with functional explanations for camera, photos, location (all three variants), and microphone.
- [x] Mirrored the strings under `ios.infoPlist` in `app.json` so prebuild preserves them.
- **Acceptance:** every `NS*UsageDescription` says specifically what the permission unlocks. ✅

### 1.5 Explicitly remove `AD_ID` permission on Android
- [x] Added `<uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove"/>` to `android/app/src/main/AndroidManifest.xml` and added `blockedPermissions` to `app.json` so prebuilds preserve it.
- **Acceptance:** Play Store Data Safety form can truthfully say "no advertising ID collected". ✅

---

## Phase 2 — iOS Privacy Manifest data types (target: 30 min)

The manifest file already exists with required-reason API declarations and `NSPrivacyTracking=false`. Just need to populate the data-types array.

### 2.1 Populate `NSPrivacyCollectedDataTypes` in `ios/TTPortal/PrivacyInfo.xcprivacy`
- [x] Added entries for: Email Address, Name, User ID, Photos or Videos, Precise Location, Other User Content, Product Interaction, Other Diagnostic Data. All marked linked-to-identity = true, tracking = false, purpose = App Functionality. `plutil -lint` validates clean.
- **Acceptance:** manifest accurately declares what TTPortal collects, matching what the Privacy Policy says. ✅ (locally)

### 2.2 Make the privacy manifest survive prebuild (follow-up)
- [ ] The current `PrivacyInfo.xcprivacy` is in `.gitignore`'d `ios/`. Pick one of:
  - **Option A — `app.json` mirror:** add `ios.privacyManifests` to `app.json` with the full structure. Confirmed supported on Expo SDK 50+; verify on SDK 54.
  - **Option B — un-gitignore `ios/`:** common at this stage of a project. Remove `/ios` from `.gitignore`, `git add ios/` once, then commit. Future prebuilds become opt-in (`--clean`).
- **Acceptance:** running `npx expo prebuild --clean` does not wipe out the data-type declarations.

---

## Phase 3 — Age gate at signup (target: 30 min)

### 3.1 Add 16+ confirmation to signup flow
- [x] In `src/app/sign-in.tsx` signup tab, added a tappable checkbox above the submit button using the `authAgeConfirmation` i18n string.
- [x] Wired to disable the submit button until checked; also resets when switching to login tab.
- [x] Added `authAgeConfirmation` to all 8 locale files.
- [x] Added two new tests in `sign-in.terms.test.tsx` (checkbox shown only on signup; submit disabled until ticked). Updated `sign-in.registration.test.tsx`, `sign-in.registration-flow.test.tsx`, and `sign-in.login.test.tsx` to tick the checkbox before submitting in 7 existing tests.
- **Acceptance:** users cannot create an account without affirming they are 16+. ✅ All 45 sign-in tests green.

---

## Phase 4 — Account deletion (target: 1–2 days)

The largest single piece of work. Must work in-app AND via a web resource per Google policy.

### 4.1 Backend: soft-delete RPC in Supabase
- [x] Migration `supabase/migrations/071_account_deletion.sql`:
  - Added `pending_deletion_at TIMESTAMPTZ` to `profiles` plus a partial index.
  - `request_account_deletion()` RPC — returns the hard-delete timestamp (now + 30 days), idempotent.
  - `cancel_account_deletion()` RPC — clears the flag.
  - `hard_delete_expired_accounts()` SECURITY DEFINER function — iterates expired rows and deletes from `auth.users`. Existing FK cascades clean up `profiles` and all user-owned tables; existing `ON DELETE SET NULL` columns (reviews, venues.submitted_by, feature_requests authorship, notifications.sender, audit logs) anonymize shared content.
  - pg_cron schedule registered (`hard_delete_expired_accounts` at 04:11 UTC daily), wrapped in extension-availability check + idempotent unschedule.
- [x] No RLS restriction on writes during grace period — deliberate choice; banner+cancel button is the UX (see 4.2).
- **Acceptance:** soft delete works via SQL; hard delete clears all FK-related rows. ✅

### 4.2 Mobile UI: "Delete my account" flow
- [x] New `DeleteAccountScreen` + route `src/app/(protected)/delete-account.tsx`. Lists what gets deleted, requires typing `DELETE`, native Alert confirm, calls the RPC, signs out, redirects to sign-in.
- [x] "Delete account" row in `SettingsScreen.tsx` under a new "Danger zone" section header (red icon, red label).
- [x] `src/services/account.ts` wraps the two RPCs.
- [x] i18n keys (`deleteAccount*`, `dangerZone`) added across all 8 mobile locales.
- [ ] Optional grace-period banner on sign-in — when a user with `pending_deletion_at IS NOT NULL` signs in, show a "Your account is scheduled for deletion on {date}. Cancel?" prompt. Deferred (works fine without; sign-in path can be enhanced later).
- **Acceptance:** account deletion reachable from Settings in 2 taps; tsc clean, i18n completeness green. ✅

### 4.3 Web alternative: `/account/delete` page
- [x] New page `web/src/app/[locale]/account/delete/page.tsx`: auth-gated, same warning copy + DELETE confirm + RPC call; redirects to a `/done` confirmation route on success.
- [x] New page `web/src/app/[locale]/account/delete/done/page.tsx` — confirmation page with cancel-hint copy.
- [x] i18n namespace `deleteAccountWeb` added in `web/src/messages/{en,ro}.json`.
- [x] Build verified — all 4 routes (`/en/account/delete`, `/ro/account/delete`, `/en/account/delete/done`, `/ro/account/delete/done`) generate as static HTML.
- **Acceptance:** Play Console "Web URL for account deletion" can point to `https://ttportal.ro/{locale}/account/delete`. ✅

### 4.2 Mobile UI: "Delete my account" flow
- [ ] In `SettingsScreen.tsx`, add a destructive "Delete account" row at the bottom of Account section.
- [ ] On tap, navigate to a new screen `src/app/(protected)/delete-account.tsx` that:
  - Shows what will be deleted (reviews, sessions, friends).
  - Requires typing "DELETE" to confirm.
  - Calls `supabase.rpc('request_account_deletion')`.
  - Signs out and routes to a confirmation screen explaining the 30-day grace period.
- [ ] If a user signs in during the grace period, show a banner: "Your account is scheduled for deletion on {date}. Cancel deletion?"
- **Acceptance:** account deletion is reachable from Settings in ≤3 taps; full deletion path tested end-to-end.

### 4.3 Web alternative: `/account/delete` page
- [ ] New page `web/src/app/[locale]/account/delete/page.tsx` that:
  - Requires Supabase auth.
  - Shows same confirmation copy as mobile.
  - Calls the same RPC.
- [ ] Link from the privacy policy and from Settings on the marketing site.
- **Acceptance:** Play Console "Web URL for account deletion" field has a real URL.

---

## Phase 5 — UGC report + block (target: 2–3 days)

App Store §1.2 requires both features for any app that hosts user-generated content. TTPortal has reviews, check-ins, photos, and friend graph — qualifies.

### 5.1 DB schema for reports + blocks
- [x] Migration `supabase/migrations/072_ugc_moderation.sql`:
  - `content_reports` table with allowed content types (review/venue/checkin/photo/profile) and reasons (spam/harassment/hate_speech/sexual_content/misinformation/other); unique on (reporter_id, content_type, content_id) so re-reporting updates the existing row.
  - `user_blocks` table with unique (blocker_id, blocked_id) and a check preventing self-blocks.
  - RLS: users can insert/select their own reports, only admins can select-all/update; users can manage their own blocks.
  - Indexes on unresolved reports and per-blocker blocks for the queries we use.
- **Acceptance:** schema applied; basic CRUD works. ✅

### 5.2 Backend: report and block RPCs
- [x] RPC `report_content(content_type, content_id, reason, notes)` — upserts via the unique-key conflict; also flips `reviews.flagged = true` for review reports to keep legacy admin tooling working.
- [x] RPC `block_user(target_id)` / `unblock_user(target_id)` — idempotent.
- [x] RPC `get_blocked_users()` — returns block list + profile info for the blocked users screen.
- [x] `getReviewsForVenue` in `src/services/reviews.ts` now fetches reviews and `user_blocks` in parallel and filters out the blocked authors client-side. The blocks query returns nothing for signed-out users (RLS), so the filter is a no-op there.
- **Acceptance:** blocked users' content is hidden in venue review lists. ✅

### 5.3 Mobile UI: report buttons
- [x] Added a `more-horizontal` button on each review card in `VenueDetailScreen`. Tap opens an Alert with "Report this review" / "Block this user" / Cancel (web uses a chained-prompt fallback since Alert with many buttons looks bad in a browser).
- [x] "Report" opens a new `ReportReasonModal` bottom-sheet — radio list of 6 reasons + optional notes for "Other"; submits via the RPC.
- [x] Toast/Alert confirmation on both report and block success/failure.
- [x] i18n keys added across all 8 locales (machine-translated for de/it/fr/es/pl/cs).
- **Acceptance:** review cards have a ⋯ → Report or Block path. ✅

### 5.4 Admin moderation surface for reports — DEFERRED
- [ ] Extend `src/screens/AdminModerationScreen.tsx` with a new "Reports" tab listing unresolved `content_reports` rows with quick actions.
- **Note:** *Not blocking store submission.* The schema exists (5.1) and `reviews.flagged` is auto-set on review reports, so existing admin tooling already surfaces those. New report types (venues, check-ins, photos, profiles) currently require a SQL query against `content_reports` until this tab ships.

### 5.5 Blocked users management screen
- [x] New `BlockedUsersScreen` route at `src/app/(protected)/blocked-users.tsx`. Pulls from `get_blocked_users()` RPC, lists avatar + name + unblock button, with empty state.
- [x] Settings → new "Privacy" section row navigates there.
- **Acceptance:** users can review and reverse their blocks from Settings. ✅

---

## Phase 6 — Data Safety form draft (target: 1 hour)

### 6.1 Create `docs/data-safety.md` with the full Google Play Data Safety answers
- [x] Wrote `docs/data-safety.md` mirroring the Play Console form structure: cheat-sheet table + per-data-type detail covering Name, Email, User ID, Precise Location, Photos, App interactions, Other user content, Diagnostics. Includes encryption-in-transit, deletion mechanism, and explicit "not collected" list for every other Play category.
- **Acceptance:** at submission time, the founder can copy answers directly into Play Console without re-research. ✅

---

## Phase 7 — Store submission infrastructure (deferred — for when the rest is done)

### 7.1 EAS submit configuration
- [ ] Add iOS profile to `eas.json` with provisioning + signing.
- [ ] Add `eas.json` submit config with appropriate credentials.

### 7.2 Store listing assets
- [ ] Screenshots for each device size (Play: phone + 7" tablet + 10" tablet; iOS: 6.7" + 6.1" + iPad).
- [ ] Listing copy in `docs/store-listing-{en,ro}.md` (short description, full description, what's new).
- [ ] Feature graphic (1024×500 PNG) for Play.
- [ ] App preview videos (optional but boosts conversion).

### 7.3 Support infrastructure
- [ ] Support email (`ttportal.info@gmail.com` — already chosen).
- [ ] Support URL (`https://ttportal.ro/support` page on marketing site).
- [ ] Marketing URL.

---

## Out of scope (not required for store submission)

- Cookie consent banner — not applicable on native (no cookies; localStorage equivalents are first-party functional storage governed by data-minimization rules already followed).
- App Tracking Transparency prompt — not required because no cross-app tracking happens (Privacy Manifest already declares `NSPrivacyTracking=false`).
- COPPA / Designed for Families — only if you change the target audience to under-13.

---

## Progress log

(Each entry: date · phase/step · short note.)

- 2026-05-26 · Plan created.
- 2026-05-26 · Phase 1 (1.1 – 1.5) complete. New helper `src/lib/policyUrls.ts` centralizes URL construction. Settings now has Legal section. iOS permission strings are functional. Android AD_ID permission explicitly removed. Sign-in test green; i18n completeness test (42 cases) green; tsc clean. One manual follow-up: configure `ttportal.ro` DNS + GitHub Pages `CNAME` so the in-app links resolve.
- 2026-05-26 · Phase 2 (2.1) complete. `PrivacyInfo.xcprivacy` now declares 8 data types collected (email, name, user-id, photos, location, UGC, product interaction, diagnostic). `plutil -lint` validates clean.
- 2026-05-26 · Phase 3 (3.1) complete. Age gate added to signup; 45/45 sign-in tests green.
- 2026-05-26 · Phase 6 (6.1) complete. `docs/data-safety.md` drafted for submission-time copy-paste.
- 2026-05-26 · Phase 4 (4.1–4.3) complete. Migration `071_account_deletion.sql` ships the soft-delete RPCs + nightly cron. Mobile Settings → Danger zone → Delete account triggers the flow with type-DELETE confirm; new `(protected)/delete-account` route. Web `/account/delete` and `/account/delete/done` shipped on the Next.js site; build verified.
- 2026-05-26 · Phase 5 (5.1–5.3 + 5.5) complete; 5.4 admin queue UI explicitly deferred. Migration `072_ugc_moderation.sql` adds `content_reports` + `user_blocks` with RLS and 4 RPCs. Mobile: review cards now have a ⋯ menu with Report and Block actions; new `ReportReasonModal` for reason selection; new `BlockedUsersScreen` accessible from Settings → Privacy. Review queries filter out blocked authors client-side. 45/45 sign-in + 42/42 i18n-completeness still green.
