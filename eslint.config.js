// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "storybook-static"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // src/core는 순수 로직 — Recharts/React 의존 금지
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "recharts",
                "recharts/**",
                "**/recharts",
                "**/recharts/**",
              ],
              message:
                "src/core는 Recharts를 import할 수 없습니다. Recharts 결합 코드는 src/recharts에 두세요.",
            },
            {
              group: ["react", "react-dom", "react/**", "react-dom/**"],
              message:
                "src/core는 React에 의존하지 않는 순수 로직이어야 합니다.",
            },
          ],
        },
      ],
    },
  },
  ...storybook.configs["flat/recommended"],
]);
