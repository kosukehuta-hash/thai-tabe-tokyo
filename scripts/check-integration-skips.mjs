// ローカルSupabaseが必要な統合テスト（Vitest）が、CIで「全件実行され、全件成功した」ことを保証する。
// Vitestは describe.skipIf などでスキップされたテストがあっても、終了コードは0（成功）のままになる。
// 静かにスキップされたまま「成功」に見えることを防ぐため、JSON reporterの出力を読み、
// 想定件数と一致しない・skipped（pending）が1件でもある・failedが1件でもある場合にCIを失敗させる。
import { readFileSync } from "node:fs";

// 対象は次の3ファイルの合計。テストを追加・削除したときは、ここも更新する。
//   src/lib/queries/favorites.security.test.ts          : 22件
//   src/lib/queries/notes.security.test.ts              :  7件
//   src/app/account/delete/account-delete.security.test.ts : 14件
const EXPECTED_TOTAL = 43;

const resultsPath = process.argv[2] ?? "vitest-integration-results.json";

let report;
try {
  report = JSON.parse(readFileSync(resultsPath, "utf-8"));
} catch (error) {
  console.error(
    `統合テストの結果ファイルの読み込みに失敗しました: ${resultsPath}`,
  );
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const total = report.numTotalTests ?? 0;
const passed = report.numPassedTests ?? 0;
const failed = report.numFailedTests ?? 0;
const skipped = (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0);

console.log(`Integration total: ${total} (expected ${EXPECTED_TOTAL})`);
console.log(`Integration passed: ${passed}`);
console.log(`Integration failed: ${failed}`);
console.log(`Integration skipped: ${skipped}`);

const problems = [];
if (skipped > 0) {
  problems.push(
    "skippedが1件以上あります。ローカルSupabaseを使うテストが実行されていません。",
  );
}
if (failed > 0) {
  problems.push("failedが1件以上あります。");
}
if (total !== EXPECTED_TOTAL || passed !== EXPECTED_TOTAL) {
  problems.push(
    `成功件数が想定（${EXPECTED_TOTAL}件）と一致しません（total=${total}, passed=${passed}）。`,
  );
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(1);
}

process.exit(0);
