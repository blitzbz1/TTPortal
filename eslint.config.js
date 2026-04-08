// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["**/__tests__/**", "**/*.test.*", "jest.setup.*"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/first": "off",
    },
  },
  {
    files: ["src/lib/haptics.ts", "src/lib/offline-cache.ts", "src/lib/supabase.ts", "src/contexts/SessionProvider.tsx", "src/screens/VenueDetailScreen.tsx", "src/components/ShareCard.tsx", "src/shims/**"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["src/shims/**"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  },
]);
