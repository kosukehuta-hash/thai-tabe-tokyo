import { readFileSync, writeFileSync } from "node:fs";
import { extractPrBodyFields } from "./pr-body-fields.mjs";

/**
 * PRマージ時にdocs/PR一覧.mdを更新するスクリプト。
 * 推測で内容を補完せず、必須情報が欠けている場合はエラー終了する（ファイルは変更しない）。
 *
 * 使い方: node scripts/update-pr-history.mjs <pr-event.jsonのパス>
 */

const PR_LIST_PATH = "docs/PR一覧.md";

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function loadPrEvent(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (error) {
    fail(`pr-event.jsonの読み込みに失敗しました: ${error.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    fail(`pr-event.jsonのJSONパースに失敗しました: ${error.message}`);
  }
  const { number, title, body, merged_at } = data;
  if (typeof number !== "number") fail("pr-event.jsonにnumberがありません");
  if (typeof title !== "string") fail("pr-event.jsonにtitleがありません");
  if (typeof merged_at !== "string")
    fail("pr-event.jsonにmerged_atがありません");
  return { number, title, body: body ?? "", merged_at };
}

/** UTCのISO8601文字列をAsia/TokyoのYYYY-MM-DDへ変換する。 */
function toJstDate(isoString) {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // sv-SEロケールはYYYY-MM-DD形式を返す
}

/** Markdownテーブルの1行（|区切り）をセル配列にパースする。 */
function parseRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
  return cells;
}

function buildTableRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

/** docs/PR一覧.mdのテキストを解析し、PR一覧表を取り出す。 */
function parsePrListMarkdown(content) {
  const lines = content.split("\n");

  const prTableHeadingIndex = lines.findIndex(
    (line) => line.trim() === "## PR一覧",
  );
  if (prTableHeadingIndex === -1) {
    fail("docs/PR一覧.mdの構成（## PR一覧）が想定と異なります。");
  }

  let prHeaderIndex = -1;
  for (let i = prTableHeadingIndex; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith("| PR#")) {
      prHeaderIndex = i;
      break;
    }
  }
  if (prHeaderIndex === -1) fail("PR一覧表のヘッダー行が見つかりません。");

  const prSeparatorIndex = prHeaderIndex + 1;
  let prLastRowIndex = prSeparatorIndex;
  for (let i = prSeparatorIndex + 1; i < lines.length; i += 1) {
    if (parseRow(lines[i])) {
      prLastRowIndex = i;
    } else {
      break;
    }
  }

  const prRows = [];
  for (let i = prSeparatorIndex + 1; i <= prLastRowIndex; i += 1) {
    const cells = parseRow(lines[i]);
    if (!cells) continue;
    const [
      prNumber,
      title,
      changes,
      relatedIssue,
      testContent,
      state,
      mergedDate,
      note,
    ] = cells;
    prRows.push({
      prNumber: Number(prNumber),
      title,
      changes,
      relatedIssue,
      testContent,
      state,
      mergedDate,
      note: note ?? "",
    });
  }

  // 冒頭の概要行（"GitHub上のPull Request（#1〜#70、実PR46件）..."）の行番号
  const summaryLineIndex = lines.findIndex((line) =>
    line.includes("GitHub上のPull Request"),
  );
  if (summaryLineIndex === -1) fail("冒頭の概要行が見つかりません。");

  return {
    lines,
    summaryLineIndex,
    prHeaderIndex,
    prSeparatorIndex,
    prFirstRowIndex: prSeparatorIndex + 1,
    prLastRowIndex,
    prRows,
  };
}

function main() {
  const prEventPath = process.argv[2];
  if (!prEventPath) {
    fail("引数でpr-event.jsonのパスを指定してください。");
  }

  const prEvent = loadPrEvent(prEventPath);
  const { errors, changes, relatedIssue, testContent, note } =
    extractPrBodyFields(prEvent.body);

  if (errors.length > 0) {
    fail(`PR本文の必須項目が不足しています: ${errors.join(" / ")}`);
  }

  const original = readFileSync(PR_LIST_PATH, "utf-8");
  const parsed = parsePrListMarkdown(original);

  // 既に同じPR番号が存在する場合は何もせず正常終了する（冪等性の担保）。
  if (parsed.prRows.some((row) => row.prNumber === prEvent.number)) {
    console.log(
      `PR #${prEvent.number} は既にdocs/PR一覧.mdに存在します。更新をスキップします。`,
    );
    process.exit(0);
  }

  const mergedDate = toJstDate(prEvent.merged_at);

  const newRow = {
    prNumber: prEvent.number,
    title: prEvent.title,
    changes,
    relatedIssue,
    testContent,
    state: "Merged",
    mergedDate,
    note,
  };

  const updatedPrRows = [...parsed.prRows, newRow].sort(
    (a, b) => a.prNumber - b.prNumber,
  );

  const lines = [...parsed.lines];

  const totalCount = updatedPrRows.length;
  const maxPrNumber = updatedPrRows[updatedPrRows.length - 1].prNumber;

  lines[parsed.summaryLineIndex] = lines[parsed.summaryLineIndex].replace(
    /GitHub上のPull Request（#1〜#\d+、実PR\d+件）/,
    `GitHub上のPull Request（#1〜#${maxPrNumber}、実PR${totalCount}件）`,
  );

  const newPrRowLines = updatedPrRows.map((row) =>
    buildTableRow([
      String(row.prNumber),
      row.title,
      row.changes,
      row.relatedIssue,
      row.testContent,
      row.state,
      row.mergedDate,
      row.note,
    ]),
  );
  lines.splice(
    parsed.prFirstRowIndex,
    parsed.prLastRowIndex - parsed.prFirstRowIndex + 1,
    ...newPrRowLines,
  );

  const updatedContent = lines.join("\n");
  writeFileSync(PR_LIST_PATH, updatedContent, "utf-8");
  console.log(`PR #${prEvent.number} をdocs/PR一覧.mdへ追加しました。`);
}

main();
