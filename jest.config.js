/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // App tests live under src. Supabase Edge Function tests use Deno and are
  // intentionally run by `npm run test:functions`, never by Jest.
  roots: ['<rootDir>/src'],
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['./jest.setup.afterEnv.js'],
  // Edge Function tests are Deno tests — run them via `npm run test:functions`.
  testPathIgnorePatterns: ['/node_modules/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@supabase/supabase-js|@unimodules/.*|unimodules-.*|sentry-expo|native-base|react-native-svg)',
  ],
};
