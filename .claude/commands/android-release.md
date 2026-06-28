---
description: Build, publish, and wire up a new Android ALPHA APK release for TTPortal — bumps the version in all three places, builds a release APK with the local Android SDK, creates the GitHub release with the APK attached, and repoints the web download link. Use when asked to cut/ship/build an Android release, make a new alpha APK, or publish v0.0.X-alpha.
---

## User Input

```text
$ARGUMENTS
```

The argument is the new marketing version (e.g. `0.0.11`). If empty, derive it by
bumping the PATCH of the current `package.json` `version`. The tag / APK / release
name is always `v<VERSION>-alpha`.

# Android alpha release

End-to-end procedure to cut a new Android alpha release. Mirrors exactly how
`v0.0.10-alpha` was shipped. Run the steps in order; verify each before moving on.
Do the git/GitHub steps yourself — do not ask for confirmation mid-flow unless a
gate fails.

## 0. Resolve the version, versionCode, branch

- `VERSION` — from the user input, else bump the patch of `package.json` `version`
  (e.g. `0.0.10` → `0.0.11`).
- `VERSION_CODE` — read the current `versionCode` from `android/app/build.gradle`
  and **add 1** (must strictly increase or Android refuses the upgrade-install;
  v0.0.10 = versionCode 3).
- `BRANCH` — `git branch --show-current`.

If the version was NOT explicitly provided, state the computed `VERSION` /
`VERSION_CODE` and proceed (it's a safe patch bump).

## 1. Bump the version in all THREE places (keep in sync)

1. `android/app/build.gradle` — `versionName "<old>"` → `"<VERSION>"` and
   `versionCode <old>` → `<VERSION_CODE>`.
   ⚠️ `android/` is **gitignored** (`.gitignore: /android`) — an `expo prebuild`
   output, hand-maintained locally. This edit is **local only / never committed**,
   but it is what the build actually reads.
2. `package.json` — `"version": "<VERSION>"`. (committed)
3. `app.json` — `expo.version` → `"<VERSION>"` and `expo.android.versionCode`
   → `<VERSION_CODE>` (add the key if missing — keeps a future `expo prebuild`
   regen in sync instead of regressing). (committed)

Sanity-check app.json parses:
`node -e "const j=require('./app.json'); console.log(j.expo.version, j.expo.android.versionCode)"`.

## 2. Build the release APK (local Android SDK)

```bash
cd android && ANDROID_HOME=~/Library/Android/sdk \
  ./gradlew :app:assembleRelease -x lint --console=plain
```

Run in the **background** and poll the log for `BUILD SUCCESSFUL` (re-bundles JS
via Hermes; ~1–2 min). Output:
`android/app/build/outputs/apk/release/app-release.apk`.

It is **debug-signed** (the `release` build type uses `debug.keystore` — fine for
alpha, NOT Play-Store prod) and a **universal** APK (all 4 ABIs, ~195 MB).

## 3. Name + verify the APK

```bash
cp android/app/build/outputs/apk/release/app-release.apk ttportal-v<VERSION>-alpha.apk
AAPT=$(ls -t ~/Library/Android/sdk/build-tools/*/aapt | head -1)
"$AAPT" dump badging ttportal-v<VERSION>-alpha.apk | grep "package: name"
```

The repo root holds the versioned APKs (alongside the prior
`ttportal-v0.0.*-alpha.apk`; gitignored). Confirm `aapt` shows
`versionName='<VERSION>'` and `versionCode='<VERSION_CODE>'`.

## 4. Commit + push the version bump

`android/build.gradle` is gitignored, so stage only the committed markers:

```bash
git add package.json app.json
git commit -m "chore(release): bump to v<VERSION>-alpha"
git push origin <BRANCH>
```

## 5. Create the GitHub release + upload the APK

Build `NOTES` as a short changelog of user-facing changes since the last tag
(`git log v<prev>-alpha..HEAD --oneline`). Then:

```bash
gh release create v<VERSION>-alpha ttportal-v<VERSION>-alpha.apk \
  --target <BRANCH> --title "v<VERSION>-alpha" --notes "<NOTES>"
```

- Do **not** pass `--prerelease` — the convention is `isPrerelease: false` even
  for `-alpha` (matches v0.0.9 / v0.0.10).
- **Target:** older releases targeted `main`, but target the branch that actually
  contains the commit the APK was built from (v0.0.10 targeted the feature branch
  because `main` lacked the code). If the work is already on `main`, use
  `--target main`.

Verify the upload:

```bash
gh release view v<VERSION>-alpha --json assets --jq '.assets[] | {name, size, state}'
```

`state` must be `uploaded`, `size` must equal `stat -f%z ttportal-v<VERSION>-alpha.apk`.

## 6. Repoint the web download link

`web/src/components/GetStartedModal.tsx` holds the only hard-coded APK URL (the
`href` on the Android download `<a>`). Update it to:

```
https://github.com/blitzbz1/TTPortal/releases/download/v<VERSION>-alpha/ttportal-v<VERSION>-alpha.apk
```

Check for stale refs (`grep -rn "v0\.0\." web/src web/public`), confirm it
resolves (`curl -sI -L -o /dev/null -w '%{http_code}\n' <url>` → `200`), then:

```bash
git add web/src/components/GetStartedModal.tsx
git commit -m "chore(web): point Android download at v<VERSION>-alpha release"
git push origin <BRANCH>
```

## Done — report the final checklist

- [ ] `build.gradle` (local) + `package.json` + `app.json` all at `<VERSION>` / `<VERSION_CODE>`
- [ ] `ttportal-v<VERSION>-alpha.apk` built + `aapt`-verified in repo root
- [ ] release bump committed + pushed
- [ ] GitHub release `v<VERSION>-alpha` created, asset `state: uploaded`, size matches, Latest
- [ ] `GetStartedModal.tsx` URL updated, resolves 200, committed + pushed
