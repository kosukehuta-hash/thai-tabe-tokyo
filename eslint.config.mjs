import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // E2Eのテストは、画像通信の検証（e2e/fixtures.ts）を必ず経由させるため、
  // @playwright/test を直接 import させない。
  {
    files: ["e2e/**/*.ts"],
    ignores: [
      // 共通部品の本体。@playwright/test を再エクスポートする
      "e2e/fixtures.ts",
      // ブラウザを使わず、DBのAPI（REST）だけを確認するため、画像通信がない
      "e2e/security.spec.ts",
      // CIの対象外。ローカルSupabaseだけで動かし、Storage画像がない
      "e2e/account-delete.spec.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@playwright/test",
              message:
                "e2e/fixtures.ts から import してください（画像通信の検証を有効にするため）。",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
