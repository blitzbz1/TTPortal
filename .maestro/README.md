# Maestro E2E suite

## Running

```bash
# iOS simulator with the app installed (dev build, not Expo Go)
maestro test -e E2E_EMAIL=<e2e-user-email> -e E2E_PASSWORD=<e2e-user-password> .maestro/flows
```

Credentials are **environment-injected** (`${E2E_EMAIL}` / `${E2E_PASSWORD}`)
— never commit them. The previously committed `andrei@test.com` password was
removed from the repo in T073 and **must be rotated** (it was live against
prod and is in git history).

## Target environment

The app reads `EXPO_PUBLIC_SUPABASE_URL` at build time, so flows run against
whatever backend the installed build points at. **Do not run the suite
against prod** — flows check in, create venues, and write reviews. Until a
staging project exists, run against the local stack:

```bash
supabase start                          # local API on http://127.0.0.1:54321
# seed an E2E user + a venue, then build with:
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
EXPO_PUBLIC_SUPABASE_ANON_KEY=<local anon key> \
npx expo run:ios
```

Note: a fresh `supabase db reset` does not replay cleanly inside frozen
migrations 000–081 — use `supabase/.migration-test/replay_prod_parity.sh`
semantics or wait for the T021 prod baseline dump.

## Known state (T073 triage, 2026-06)

- `helpers/login.yaml`, flows 02 & 20: credentials env-injected ✓
- Flow 01: social-button assertions removed (hidden behind
  `SOCIAL_AUTH_ENABLED=false` since 9a48d1e) ✓
- Remaining 19 flows: **untriaged since March** — several tap Romanian UI
  text (`"Adaugă"`, `"Anulează"`) and will break under T067's new
  English-default first launch. When triaging on a simulator: replace text
  taps with testIDs and pin the locale (set the app language to `ro` via the
  in-app selector at flow start, or assert on testIDs only).
- Missing flows for post-March surfaces: create+join event, challenge
  cooldown, venue change request, onboarding, notification inbox.
