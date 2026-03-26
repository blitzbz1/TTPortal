# Progress Log

Iteration learnings and patterns discovered during implementation.

---

## Iteration 1 - T001
- Expo project was already initialized with SDK 55, TypeScript, expo-router tabs template, and `src/app/` routing structure. Verified all quality gates pass (typecheck, lint, export).
- ESLint was auto-configured on first `npm run lint` run — it installs `eslint` and `eslint-config-expo` automatically and creates `eslint.config.js`. Fixed pre-existing lint errors (unescaped `"` in JSX) in scaffold screens.
- Push blocked: SSH key `tavigm` lacks write access to `blitzbz1/TTPortal.git`. Need repo access or correct remote URL before pushing.
- Useful commands: `npx expo export --platform web` for non-interactive build validation.
---

## Iteration 2 - T002
- Installed `@supabase/supabase-js`, `expo-sqlite`, `react-native-url-polyfill`, `expo-apple-authentication`. `expo-font` was already present from the initial Expo template.
- `expo doctor` is now `npx expo-doctor` (local CLI doesn't support `expo doctor`). Only failure was pre-existing Xcode version incompatibility (SDK 55 requires Xcode >=26.0.0), unrelated to installed packages.
- Push still blocked: SSH key `tavigm` lacks write access to `blitzbz1/TTPortal.git`. `gh auth` not configured either. This must be resolved before any iteration can push.
- Commit saved locally: `853bcb2 feat(T002): install core auth dependencies`
---

## Iteration 3 - T003, T004, T005
- Configured jest with jest-expo preset, installed @testing-library/react-native. Created Supabase client with expo-sqlite storage adapter. Extracted i18n strings from js/ui.js to JSON locale files with all auth keys from ui-contracts.md.
- Gotcha: `react-test-renderer` must be pinned to match exact react version (19.2.0) or npm ERESOLVE fails. Also, env vars for Supabase must be set in a jest setupFiles script (jest.setup.js) — setting them at top of test file runs too late because ES imports are hoisted above assignments.
- Push still blocked: SSH key `tavigm` lacks write access to `blitzbz1/TTPortal.git`. Commit saved locally: `0f477df`.
---

