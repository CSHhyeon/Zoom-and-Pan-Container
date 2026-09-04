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
  // ── FSD 레이어 경계: shared ← entities ← features ← widgets (import는 항상 아래 방향으로만) ──
  {
    // shared는 도메인 무지 — 상위 레이어 전부 금지
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/entities",
                "**/entities/**",
                "**/features",
                "**/features/**",
                "**/widgets",
                "**/widgets/**",
                "**/app",
                "**/app/**",
              ],
              message: "shared는 상위 레이어를 import할 수 없습니다.",
            },
          ],
        },
      ],
    },
  },
  {
    // entities/range는 순수 로직(구 core) — 상위 레이어 금지 + Recharts/React 의존 금지
    files: ["src/entities/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/features",
                "**/features/**",
                "**/widgets",
                "**/widgets/**",
                "**/app",
                "**/app/**",
              ],
              message: "entities는 상위 레이어를 import할 수 없습니다.",
            },
            {
              group: [
                "recharts",
                "recharts/**",
                "**/recharts",
                "**/recharts/**",
              ],
              message:
                "entities/range는 Recharts를 import할 수 없습니다. Recharts 결합 코드는 widgets의 ui에 두세요.",
            },
            {
              group: ["react", "react-dom", "react/**", "react-dom/**"],
              message:
                "entities/range는 React에 의존하지 않는 순수 로직이어야 합니다.",
            },
          ],
        },
      ],
    },
  },
  {
    // features는 widgets/app을 모른다
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/widgets", "**/widgets/**", "**/app", "**/app/**"],
              message: "features는 상위 레이어를 import할 수 없습니다.",
            },
          ],
        },
      ],
    },
  },
  ...storybook.configs["flat/recommended"],
]);
