# TTPortal — CI/CD Tasks (deferred)

Extracted from [improvement_suggestions_tasks.md](improvement_suggestions_tasks.md) on 2026-06-10 — pipeline/automation work deferred by decision. Source findings live in [improvement_suggestions.md](improvement_suggestions.md). Original task IDs are noted; the main doc keeps one-line stubs so cross-references stay valid.

**Scope note:** only pipeline work moved here. The scheduled *operational* automations stayed in the main doc because they're data-safety/monitoring items that merely happen to use GitHub Actions: T083 (offsite backups) and T087 (egress/cost alert).

**While this is deferred, two manual disciplines replace the missing gates:**
1. Run `npm test && npm run lint && npm run typecheck` before every push — `deploy.yml` still publishes the web app to GitHub Pages on **every push** to `001-user-auth` with no checks (§3.1/§8.5).
2. Run `supabase db reset` locally after authoring any migration (local replayability is task T020 in the main doc and is **not** deferred — only its CI enforcement is).

---

## C001 · CI quality gates + deploy pipeline *(was T002)* — §3.1, §8.5 `S`
**Depends on:** T001 (the 2 failing tests must be fixed first so CI starts green).
**Files:** `.github/workflows/ci.yml` (new), `.github/workflows/deploy.yml`
- [ ] New `ci` job on `push` + `pull_request`: `actions/setup-node@v4` (npm cache, `cache-dependency-path: ['package-lock.json', 'web/package-lock.json']`) → `npm ci` → `npm run typecheck` → `npm run lint` → `npx jest --ci`.
- [ ] Make deploy depend on it: either move deploy into the same workflow with `needs: ci`, or trigger deploy via `workflow_run` on CI success.
- [ ] Replace `npm install` with `npm ci` in `deploy.yml` (lines 26 and 55) so builds are lockfile-reproducible.
- [ ] Add `paths-ignore: ['supabase/**', 'docs/**', '**.md']` to the deploy trigger.
- [ ] Merge `001-user-auth` → `main`; switch the deploy trigger branch to `main`; run CI on all PRs. Delete the `# Change this to match your current branch` comment.

**Done when:** a push with a failing test/type error cannot deploy; deploy runs from `main` only; lockfile is enforced.

## C002 · `db-test` CI job *(was part of T020)* — §3.2 `S`
**Depends on:** T020 (chain must replay locally; pgTAP suite must exist) · C001.
**Files:** `.github/workflows/ci.yml`
- [ ] Add a `db-test` job: `supabase start` (supabase/setup-cli action) → `supabase db reset` → `supabase test db`.
- [ ] Run the `deno test` suite for `supabase/functions/_shared` and `amatur-proxy` in the same job.
- [ ] Trigger on PRs and pushes touching `supabase/**` (plus a weekly full run).

**Done when:** a migration that breaks replay, or a change that violates the pgTAP invariants (realtime publication membership, RLS smoke, `handle_new_user`, delta watermark), fails CI before merge.

## C003 · Scheduled prod↔repo drift check *(was part of T021)* — §2.2 `S`
**Depends on:** T021 (initial drift must be reconciled first, or the job is red from day one).
**Files:** `.github/workflows/drift-check.yml` (new)
- [ ] Weekly scheduled job: `supabase db dump --schema public` from prod (access token secret) → diff against a clean chain replay → fail + Discord alert on drift.
- [ ] Document the triage runbook: every diff means either an unauthorized prod change or a migration applied out-of-band — both need a back-ported migration.

## C004 · EAS profiles + tag-triggered build automation *(was T025)* — §3.8 `S`
**Depends on:** T023 (release signing/versioning) · C001.
**Files:** `eas.json`, `.github/workflows/release.yml` (new)
- [ ] Add a `development` profile (`developmentClient: true`, `distribution: internal`) and per-profile `env` (so preview can later point at a staging Supabase project).
- [ ] Tag-triggered workflow (`on: push: tags: 'v*'`): `npx eas-cli build --profile production --platform all --non-interactive --no-wait` with `EXPO_TOKEN` secret, `needs:` the CI job.
- [ ] Once T024 (OTA) lands: add an `eas update --channel preview` step for JS-only releases.

## C005 · Coverage measurement in CI *(was T072)* — §3.7 `S`
**Depends on:** C001. **Pairs with:** the `jest.config.js` changes (collectCoverageFrom/reporters), which can land any time independently.
**Files:** `jest.config.js`, `.github/workflows/ci.yml`
- [ ] `collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**', '!src/**/*.d.ts']`, reporters `['text-summary','lcov','json-summary']`.
- [ ] Run `npx jest --ci --coverage` in the CI job; print the json-summary in the job output.
- [ ] Directory-scoped `coverageThreshold` on `src/services` and `src/lib` at current levels; ratchet up over time — no global threshold (screens/shims would drag it).

## C006 · Nightly Maestro smoke in CI *(was part of T073)* — §3.3 `M`
**Depends on:** T073 (suite repaired, de-prodded, testID-based, pointed at a local/staging stack) · C001.
**Files:** `.github/workflows/e2e.yml` (new)
- [ ] Nightly job on a `macos-14` runner (`xcrun simctl boot` + `maestro test`) or Maestro Cloud, running a 3–5-flow smoke subset (auth, map→venue, check-in, create+join event).
- [ ] Inject `E2E_EMAIL`/`E2E_PASSWORD` via secrets; spin up `supabase start` with the seeded E2E fixtures from T073.
- [ ] Report failures to the existing Discord alert channel.

## C007 · CI hygiene checks *(extracted bullets from T051, T055)* `S`
**Depends on:** C001, plus the respective main-doc tasks having landed their local tooling.
- [ ] **Types freshness** (from T051): run the `supabase gen types typescript` npm script in CI and `git diff --exit-code src/types/supabase.ts` — fails when a migration changed the schema without regenerating types.
- [ ] **Dead-code guard** (from T055): run `knip` (or `ts-prune`) in CI once the initial dead-code purge is done, so orphaned modules fail the build instead of accumulating.

---

## Sequencing

```
T001 (main doc) → C001 → C002 (needs T020) 
                       → C005
                       → C007 (needs T051/T055 local parts)
                       → C004 (needs T023) → eas update step (needs T024)
T021 → C003
T073 → C006
```

C001 is the keystone — everything else bolts onto its workflow. When CI/CD work resumes, do C001 + C002 together first: they convert the two riskiest standing hazards (ungated deploys, unreplayable migrations) into enforced invariants.
