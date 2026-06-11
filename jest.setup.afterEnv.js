// Runs after the test framework loads (setupFilesAfterEnv), so beforeEach
// is available — jest.setup.js runs earlier via setupFiles, where it isn't.
//
// MMKV persists across tests within a file (offline-cache became
// MMKV-backed in T047) — without a reset, cache-first screens would
// short-circuit the fetches later tests assert on. Tests that exercise
// persistence write and read within a single test body, so a between-test
// reset is safe.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMMKV } = require('react-native-mmkv');
  createMMKV.__resetAllStores?.();
});
