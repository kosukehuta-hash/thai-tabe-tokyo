import { readFileSync, writeFileSync } from "node:fs";

/**
 * PRマージ時にdocs/PR一覧.mdを更新するスクリプト。
 * 推測でカテゴリ・内容を補完せず、必須情報が欠けている場合や
 * 未知のカテゴリが指定された場合はエラー終了する（ファイルは変更しない）。
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

/** PR本文の「## PR一覧用情報」セクションから各項目を取得する。 */
function extractPrListInfo(body) {
  const blockMatch = body.match(
    /##\s*PR一覧用情報\s*\n([\s\S]*?)(?:\n##\s|\n?$)/,
  );
  if (!blockMatch) {
    fail(
      "PR本文に「## PR一覧用情報」セクションが見つかりません。テンプレートに従って記載してください。",
    );
  }
  const blockText = blockMatch[1];

  function getField(label) {
    // \sは改行も含むため、値が空の場合に次の行を巻き込まないよう
    // 行内の空白（[ \t]）だけに限定する。
    const m = blockText.match(
      new RegExp(`^-[ \\t]*${label}[：:][ \\t]*(.*)$`, "m"),
    );
    return m ? m[1].trim() : "";
  }

  const mainSummary = getField("主な対応内容");
  const relatedIssue = getField("関連Issue") || "―";
  const categoryRaw = getField("カテゴリ") || "―";
  const note = getField("備考");

  if (!mainSummary) {
    fail(
      "PR本文の「主な対応内容」が空です。docs/PR一覧.mdへ反映する内容を記載してください。",
    );
  }

  return { mainSummary, relatedIssue, categoryRaw, note };
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

/** docs/PR一覧.mdのテキストを解析し、PR一覧表とカテゴリ別集計表を取り出す。 */
function parsePrListMarkdown(content) {
  const lines = content.split("\n");

  const prTableHeadingIndex = lines.findIndex(
    (line) => line.trim() === "## PR一覧",
  );
  const categoryHeadingIndex = lines.findIndex(
    (line) => line.trim() === "## カテゴリ別集計",
  );
  if (prTableHeadingIndex === -1 || categoryHeadingIndex === -1) {
    fail(
      "docs/PR一覧.mdの構成（## PR一覧 / ## カテゴリ別集計）が想定と異なります。",
    );
  }

  // PR一覧表: prTableHeadingIndex以降で最初に見つかる「| PR#」ヘッダー行から、
  // categoryHeadingIndexより前の最後の表行まで。
  let prHeaderIndex = -1;
  for (let i = prTableHeadingIndex; i < categoryHeadingIndex; i += 1) {
    if (lines[i].trim().startsWith("| PR#")) {
      prHeaderIndex = i;
      break;
    }
  }
  if (prHeaderIndex === -1) fail("PR一覧表のヘッダー行が見つかりません。");

  const prSeparatorIndex = prHeaderIndex + 1;
  let prLastRowIndex = prSeparatorIndex;
  for (let i = prSeparatorIndex + 1; i < categoryHeadingIndex; i += 1) {
    if (parseRow(lines[i])) {
      prLastRowIndex = i;
    } else if (lines[i].trim() === "") {
      break;
    }
  }

  const prRows = [];
  for (let i = prSeparatorIndex + 1; i <= prLastRowIndex; i += 1) {
    const cells = parseRow(lines[i]);
    if (!cells) continue;
    const [prNumber, title, description, issue, state, mergedDate, note] =
      cells;
    prRows.push({
      prNumber: Number(prNumber),
      title,
      description,
      issue,
      state,
      mergedDate,
      note: note ?? "",
    });
  }

  // カテゴリ別集計表: categoryHeadingIndex以降で最初に見つかる「| カテゴリ」ヘッダー行から。
  let categoryHeaderIndex = -1;
  for (let i = categoryHeadingIndex; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith("| カテゴリ")) {
      categoryHeaderIndex = i;
      break;
    }
  }
  if (categoryHeaderIndex === -1)
    fail("カテゴリ別集計表のヘッダー行が見つかりません。");

  const categorySeparatorIndex = categoryHeaderIndex + 1;
  let categoryLastRowIndex = categorySeparatorIndex;
  for (let i = categorySeparatorIndex + 1; i < lines.length; i += 1) {
    if (parseRow(lines[i])) {
      categoryLastRowIndex = i;
    } else {
      break;
    }
  }

  const categoryRows = [];
  for (let i = categorySeparatorIndex + 1; i <= categoryLastRowIndex; i += 1) {
    const cells = parseRow(lines[i]);
    if (!cells) continue;
    const [category, count, prNumbers] = cells;
    categoryRows.push({
      category,
      count: Number(count),
      prNumbers: prNumbers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  // 冒頭の概要行（"GitHub上のPull Request（#1〜#68、実PR44件）..."）の行番号
  const summaryLineIndex = lines.findIndex((line) =>
    line.includes("GitHub上のPull Request"),
  );
  if (summaryLineIndex === -1) fail("冒頭の概要行が見つかりません。");

  // 末尾の注記行（"※1つのPRが複数カテゴリに..."）の行番号
  const footnoteLineIndex = lines.findIndex((line) =>
    line.startsWith("※1つのPRが複数カテゴリ"),
  );
  if (footnoteLineIndex === -1) fail("末尾の注記行が見つかりません。");

  return {
    lines,
    summaryLineIndex,
    prHeaderIndex,
    prSeparatorIndex,
    prFirstRowIndex: prSeparatorIndex + 1,
    prLastRowIndex,
    prRows,
    categoryHeaderIndex,
    categorySeparatorIndex,
    categoryFirstRowIndex: categorySeparatorIndex + 1,
    categoryLastRowIndex,
    categoryRows,
    footnoteLineIndex,
  };
}

function main() {
  const prEventPath = process.argv[2];
  if (!prEventPath) {
    fail("引数でpr-event.jsonのパスを指定してください。");
  }

  const prEvent = loadPrEvent(prEventPath);
  const { mainSummary, relatedIssue, categoryRaw, note } = extractPrListInfo(
    prEvent.body,
  );

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
    description: mainSummary,
    issue: relatedIssue,
    state: "Merged",
    mergedDate,
    note,
  };

  const updatedPrRows = [...parsed.prRows, newRow].sort(
    (a, b) => a.prNumber - b.prNumber,
  );

  // カテゴリの検証・更新（推測で新規カテゴリを作らない）。
  const updatedCategoryRows = parsed.categoryRows.map((row) => ({
    ...row,
    prNumbers: [...row.prNumbers],
  }));

  if (categoryRaw !== "―") {
    const categoryNames = categoryRaw
      .split(/[、,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const categoryName of categoryNames) {
      const target = updatedCategoryRows.find(
        (row) => row.category === categoryName,
      );
      if (!target) {
        const known = updatedCategoryRows.map((row) => row.category).join(", ");
        fail(
          `未知のカテゴリ「${categoryName}」が指定されました。docs/PR一覧.mdの既存カテゴリのいずれかを使用してください。既存カテゴリ: ${known}`,
        );
      }
      const prLabel = `#${newRow.prNumber}`;
      if (!target.prNumbers.includes(prLabel)) {
        target.prNumbers.push(prLabel);
        target.count = target.prNumbers.length;
      }
    }
  }

  // ここまでで問題がなければ、ファイル内容をメモリ上で完成させる。
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
      row.description,
      row.issue,
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

  // PR一覧表の行数が変わった分だけ、カテゴリ表の行番号をずらす。
  const rowCountDelta = newPrRowLines.length - parsed.prRows.length;
  const categoryFirstRowIndex = parsed.categoryFirstRowIndex + rowCountDelta;
  const categoryLastRowIndex = parsed.categoryLastRowIndex + rowCountDelta;
  const footnoteLineIndex = parsed.footnoteLineIndex + rowCountDelta;

  const newCategoryRowLines = updatedCategoryRows.map((row) =>
    buildTableRow([row.category, String(row.count), row.prNumbers.join(", ")]),
  );
  lines.splice(
    categoryFirstRowIndex,
    categoryLastRowIndex - categoryFirstRowIndex + 1,
    ...newCategoryRowLines,
  );

  // カテゴリ別集計は行数（カテゴリ数）自体を変えないため、追加のズレは発生しない。
  lines[footnoteLineIndex] = lines[footnoteLineIndex].replace(
    /PR総数（\d+）/,
    `PR総数（${totalCount}）`,
  );

  const updatedContent = lines.join("\n");
  writeFileSync(PR_LIST_PATH, updatedContent, "utf-8");
  console.log(`PR #${prEvent.number} をdocs/PR一覧.mdへ追加しました。`);
}

main();
