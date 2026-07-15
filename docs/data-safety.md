# Google Play Data Safety — TTPortal Submission Answers

This document mirrors the answers required by the Google Play **Data safety** form in Play Console (App content → Data safety). The structure below matches Play Console's question flow so the founder can copy answers directly at submission time.

**Last updated:** 2026-05-26 · **App version covered:** 1.0.0

---

## Quick reference — every data type at a glance

| Category | Type | Collected? | Shared? | Optional? | Encrypted in transit? | Can users request deletion? | Linked to identity? | Purposes |
|---|---|---|---|---|---|---|---|---|
| Personal info | Name | Yes | No | Required | Yes | Yes | Yes | App functionality, Account management |
| Personal info | Email address | Yes | No | Required | Yes | Yes | Yes | App functionality, Account management |
| Personal info | User IDs | Yes | No | Required | Yes | Yes | Yes | App functionality, Account management |
| Location | Approximate location | No | No | – | – | – | – | – |
| Location | Precise location | Yes | No | Optional | Yes | Yes | Yes | App functionality |
| Photos and videos | Photos | Yes | No | Optional | Yes | Yes | Yes | App functionality |
| Photos and videos | Videos | No | No | – | – | – | – | – |
| Audio files | Voice/sound recordings | No | No | – | – | – | – | – |
| Files and docs | Files and docs | No | No | – | – | – | – | – |
| App activity | App interactions | Yes | No | Required | Yes | Yes | Yes | App functionality, Analytics |
| App activity | Other user-generated content | Yes | No | Optional | Yes | Yes | Yes | App functionality |
| Web browsing | Web browsing history | No | No | – | – | – | – | – |
| App info and performance | Crash logs | No | No | – | – | – | – | – |
| App info and performance | Diagnostics | Yes | No | Required | Yes | Yes (90-day max retention) | Yes | App functionality, Fraud prevention, security, and compliance |
| App info and performance | Other app performance data | No | No | – | – | – | – | – |
| Device or other IDs | Device or other IDs | No | No | – | – | – | – | – |
| Financial info | All sub-types | No | No | – | – | – | – | – |
| Health and fitness | All sub-types | No | No | – | – | – | – | – |
| Messages | All sub-types | No | No | – | – | – | – | – |
| Contacts | Contacts | No | No | – | – | – | – | – |
| Calendar | Calendar events | No | No | – | – | – | – | – |

**Headline answers to top-level form questions:**

- *Does your app collect or share any of the required user data types?* **Yes — collect. No — share.**
- *Is all of the user data collected by your app encrypted in transit?* **Yes.**
- *Do you provide a way for users to request that their data is deleted?* **Yes — in-app under Settings → Delete account, and via the web at `https://ttportal.org/{locale}/account/delete`.** (See `appstore_requirements.md` Phase 4 — implementation in progress as of this revision.)

---

## Per-type detail (the Play Console wizard order)

### Personal info → Name
- **Collected:** Yes.
- **Why collected:** App functionality (displaying your name on your profile, reviews, and check-ins); Account management (sign-up, sign-in).
- **Required or optional:** Required to create an account.
- **Source:** User-provided at signup, or imported from Google/Apple OAuth if the user signs in with those providers.

### Personal info → Email address
- **Collected:** Yes.
- **Why collected:** App functionality (account identifier, email verification, password reset); Account management.
- **Required or optional:** Required.
- **Source:** User-provided at signup or supplied by Google/Apple OAuth.

### Personal info → User IDs
- **Collected:** Yes.
- **Why collected:** App functionality (Supabase user ID is the primary key for every row of UGC the user creates).
- **Required or optional:** Required.
- **Source:** Server-generated UUID at signup.

### Location → Precise location
- **Collected:** Yes.
- **Why collected:** App functionality (show table tennis venues near the user, suggest closest places to play, support check-in to a venue).
- **Required or optional:** **Optional.** Foreground only. Permission is requested at first use of the map screen and is fully revocable from OS settings without breaking the app (the user can still browse venues without location).
- **Source:** Device GPS / network location via the OS permission system. Never queried in the background.

### Photos and videos → Photos
- **Collected:** Yes (when the user voluntarily attaches a photo).
- **Why collected:** App functionality (let users illustrate venue reviews, condition reports, and check-ins with photos).
- **Required or optional:** Optional. No automatic photo capture.
- **Source:** User-selected from photo library or taken with the camera, both via the OS permission system.

### App activity → App interactions
- **Collected:** Yes — check-ins, session durations, event attendance, leaderboard activity.
- **Why collected:** App functionality (display history, streaks, leaderboards); Analytics (own product analytics — counts, aggregations — see "no third-party analytics" note below).
- **Required or optional:** Required to use the corresponding features (no check-ins data without check-in feature use).

### App activity → Other user-generated content
- **Collected:** Yes — venue reviews, ratings, equipment notes, feature requests, friend graph.
- **Why collected:** App functionality (display reviews to other users, equipment to friends, etc.).
- **Required or optional:** Optional. Users can use the app without writing reviews.

### App info and performance → Diagnostics
- **Collected:** Yes (server side).
- **Why collected:** App functionality (debugging); Fraud prevention, security, and compliance (rate limiting, abuse detection).
- **Required or optional:** Required — automatic when the app makes a network request.
- **Retention:** Maximum 90 days.
- **What's in it:** IP address, HTTP request metadata (path, method, status, latency), browser/device User-Agent.

---

## Data sharing — none

TTPortal does **not** share user data with third parties under Google's definition (transferring data to a third party for that party's own use). Specifically:

- **Supabase** (database, auth, file storage) is a **processor** acting on TTPortal's behalf under a Data Processing Agreement (GDPR Art. 28). Not "sharing".
- **Google Sign-In / Apple Sign-In**, when used, exchange auth tokens with Google/Apple. This is user-initiated and only happens for users who pick that sign-in path. Google's Data Safety form does not require this to be listed as "sharing" because the data flow is to the identity provider the user actively chose.

---

## Encryption in transit

**Yes — all user data is encrypted in transit.** Every request from the app goes to `https://*.supabase.co` over TLS 1.2+ enforced by Supabase. The app's Android cleartext-traffic flag is disabled in release builds; iOS App Transport Security defaults block non-HTTPS traffic.

---

## Encryption at rest

Supabase encrypts all data at rest using AES-256 on managed storage. Backups inherit the same encryption.

---

## Deletion

Users can request deletion of their data in two ways:

1. **In-app.** Settings → Delete account triggers a soft-delete with a 30-day grace period. After 30 days, all rows owned by the user (profile, check-ins, reviews, photos, friends, events, equipment) are hard-deleted via a Supabase scheduled job. Server logs (diagnostics) roll off independently at the 90-day retention boundary.
2. **Web.** `https://ttportal.org/{locale}/account/delete` (Next.js page, same RPC backend). Required by Google Play policy — must be reachable without installing the app.

Both flows call the same Postgres RPC `request_account_deletion()`. Implementation detail: see `appstore_requirements.md` Phase 4 and `supabase/migrations/0XX_account_deletion.sql` once landed.

---

## What we do NOT collect (and therefore should be marked "Not collected" in the form)

- Approximate location (we only use precise when the user opts in)
- Race, ethnicity, sexual orientation, political/religious views
- Financial info (no payments)
- Health/fitness data
- Messages, calls, contacts, calendar
- Audio recordings
- Files or documents outside the photo library
- Web browsing history
- Device or other IDs (no IDFA, no AAID — see Phase 1.5 in the compliance plan for the explicit Android `AD_ID` removal)
- Crash logs (no Sentry or equivalent yet; if added later this form needs updating)

---

## Cross-references

- **iOS Privacy Manifest** (`ios/TTPortal/PrivacyInfo.xcprivacy`) declares the same 8 collected data types with linked = true, tracking = false, purpose = App Functionality.
- **Marketing-site Privacy Policy** at `https://ttportal.org/{locale}/privacy` is the public-facing version of this document.
- **Cookie Policy** at `https://ttportal.org/{locale}/cookies` covers in-browser storage on the web app.

---

## Maintenance

Update this document whenever:

- A new data type starts being collected (e.g., adding Sentry → adds Crash logs; adding a phone-verification step → adds Phone number; etc.)
- A processor changes (e.g., moving auth off Supabase).
- The retention policy changes.
- The deletion mechanism changes.

After updating, also update:

- `web/src/messages/{en,ro}.json` Privacy Policy strings.
- `ios/TTPortal/PrivacyInfo.xcprivacy` (or its `app.json` equivalent).
- The Play Console Data Safety form itself.
