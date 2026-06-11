// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    settings: {
      "import/resolver": {
        node: {
          paths: ["."],
          extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
        },
      },
    },
    rules: {
      "import/no-unresolved": ["error", { ignore: ["^@/"] }],
    },
  },
  {
    files: ["**/__tests__/**", "**/*.test.*", "jest.setup.*"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/first": "off",
    },
  },
  {
    files: ["src/lib/haptics.ts", "src/lib/offline-cache.ts", "src/lib/supabase.ts", "src/contexts/SessionProvider.tsx", "src/screens/VenueDetailScreen.tsx", "src/shims/**"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // T054: Alert.alert is a silent no-op on web — all dialogs go through
    // lib/dialogs (showAlert/showConfirm). The dynamic action-sheet in
    // VenueDetailScreen carries an inline disable with its web fallback.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/dialogs.ts", "src/**/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "react-native",
          importNames: ["Alert"],
          message: "Use showAlert/showConfirm from src/lib/dialogs — Alert is a no-op on web.",
        }],
      }],
      // T053: typed routes are on — an `as any` href silently defeats them.
      // Runtime-validated strings (sanitizeRoute etc.) use `as Href` instead.
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.property.name=/^(push|replace|navigate)$/] TSAsExpression > TSAnyKeyword",
        message: "No `as any` inside router.push/replace — use a typed { pathname, params } object or `as Href`.",
      }],
    },
  },
  {
    files: ["src/shims/**"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  },
]);
