import { readFileSync } from "node:fs";
import { extractPrBodyFields } from "./pr-body-fields.mjs";

/**
 * PR本文に必須4項目（変更内容・関連Issue・テスト内容・補足）が
 * 正しく記載されているかを検証する。
 *
 * 使い方: node scripts/check-pr-body.mjs <pr-body.jsonのパス>
 */

function fail(errors) {
  console.error("::error::PR本文チェック失敗:");
  for (const message of errors) {
    console.error(`::error::- ${message}`);
  }
  process.exit(1);
}

function main() {
  const path = process.argv[2];
  if (!path) {
    fail(["引数でpr-body.jsonのパスを指定してください。"]);
  }

  let raw;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (error) {
    fail([`pr-body.jsonの読み込みに失敗しました: ${error.message}`]);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    fail([`pr-body.jsonのJSONパースに失敗しました: ${error.message}`]);
  }

  const body = typeof data.body === "string" ? data.body : "";
  const { errors } = extractPrBodyFields(body);

  if (errors.length > 0) {
    fail(errors);
  }

  console.log("PR本文チェック: 問題ありません。");
}

main();
