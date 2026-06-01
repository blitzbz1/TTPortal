import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "i18next/no-literal-string": "off",
      "max-lines-per-function": "off",
      "sonarjs/no-all-duplicated-branches": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];

export default config;
