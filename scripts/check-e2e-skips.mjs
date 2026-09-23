// Playwrightはtest.skip()で終了しても、プロセスの終了コードは0（成功）のままになる。
// 仕様書TCの一部が実行時のデータ条件不足で無検証のまま「成功」に見えることを防ぐため、
// JSON reporterの出力を読み、skipped件数が1件でもあればCIを失敗させる。
import { readFileSync } from "node:fs";

const resultsPath = process.argv[2] ?? "playwright-results.json";

let report;
try {
  report = JSON.parse(readFileSync(resultsPath, "utf-8"));
} catch (error) {
  console.error(`E2E結果ファイルの読み込みに失敗しました: ${resultsPath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const stats = report.stats ?? {};
const passed = stats.expected ?? 0;
const skipped = stats.skipped ?? 0;

console.log(`E2E passed: ${passed}`);
console.log(`E2E skipped: ${skipped}`);

if (skipped > 0) {
  console.error(
    "skippedが1件以上あります。データ条件不足などにより一部のTCが検証されていません。",
  );
  process.exit(1);
}

process.exit(0);
