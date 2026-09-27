/**
 * PR本文の「## 変更内容」「## 関連Issue」「## テスト内容」「## 補足」を
 * 抽出・検証する共通ロジック。
 * PR本文チェック（check-pr-body.mjs）とPR履歴更新（update-pr-history.mjs）の
 * 両方から利用する。
 */

const FIELD_DEFS = [
  { key: "changes", heading: "変更内容" },
  { key: "relatedIssue", heading: "関連Issue" },
  { key: "testContent", heading: "テスト内容" },
  { key: "note", heading: "補足" },
];

function extractSection(body, heading) {
  const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?:\\n##\\s|$)`);
  const m = body.match(re);
  return m ? m[1] : null;
}

function splitLines(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

function isFilled(text) {
  if (text == null) return false;
  return splitLines(text).length > 0;
}

/** 表セルなどに載せる1行の値へまとめる（複数行の箇条書きは「、」区切り）。 */
function joinLines(text) {
  return splitLines(text ?? "").join("、");
}

/**
 * PR本文を解析し、4項目それぞれの値と検証エラーを返す。
 * エラーがある場合、値は空文字またはnullの可能性がある。
 */
export function extractPrBodyFields(body) {
  const sections = {};
  for (const { key, heading } of FIELD_DEFS) {
    sections[key] = extractSection(body, heading);
  }

  const errors = [];
  for (const { key, heading } of FIELD_DEFS) {
    if (sections[key] == null) {
      errors.push(`「## ${heading}」セクションが見つかりません`);
    } else if (!isFilled(sections[key])) {
      errors.push(`${heading}が未記入です`);
    }
  }

  return {
    errors,
    changes: joinLines(sections.changes),
    relatedIssue: joinLines(sections.relatedIssue),
    testContent: joinLines(sections.testContent),
    note: joinLines(sections.note),
  };
}
