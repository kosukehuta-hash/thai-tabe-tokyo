import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  // account-delete.spec.ts は、アカウントを実際に削除するため、ローカルSupabaseだけで実行する。
  // CIでは「スキップが1件でもあれば失敗」とする検査（scripts/check-e2e-skips.mjs）があるため、
  // スキップ扱いにせず、CIでは最初から実行対象に含めない
  testIgnore: isCI ? ["**/account-delete.spec.ts"] : [],
  fullyParallel: true,
  retries: 0,
  reporter: isCI
    ? [
        ["list"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
        ["json", { outputFile: "playwright-results.json" }],
      ]
    : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
