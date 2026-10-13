import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * sessionStorage のキー文字列と操作が、共通ファイルだけに定義されていることを
 * ソースコードの静的な検査で守る（src 配下のみ。E2Eテストのリテラルは対象外）。
 * 後から別のファイルにキーが重複定義されたり、直接 sessionStorage を触ったりしたら失敗する。
 */

const ROOT = path.resolve(__dirname, "../..");
const FROM_SEARCH_MODULE = "src/lib/from-search-mark.ts";
const SEARCH_SCROLL_MODULE = "src/lib/search-scroll.ts";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const rel = (file: string) =>
  path.relative(ROOT, file).split(path.sep).join("/");
const isTestFile = (file: string) => /\.(test|spec)\.[tj]sx?$/.test(file);
const isSource = (file: string) => /\.(ts|tsx|js|jsx|mjs)$/.test(file);
const read = (file: string) => readFileSync(file, "utf-8");

const appSourceFiles = walk(path.join(ROOT, "src")).filter(
  (f) => isSource(f) && !isTestFile(f),
);

const usersOf = (needle: string) =>
  appSourceFiles
    .filter((f) => read(f).includes(needle))
    .map(rel)
    .sort();

describe("sessionStorage キーの定義場所", () => {
  it("「検索結果から来た」印のキー文字列は共通ファイル1か所だけ", () => {
    expect(usersOf("thai-tabe-tokyo:from-search")).toEqual([
      FROM_SEARCH_MODULE,
    ]);
  });

  it("スクロール位置のキー文字列は共通ファイル1か所だけ", () => {
    expect(usersOf("thai-tabe-tokyo:search-scroll-y:")).toEqual([
      SEARCH_SCROLL_MODULE,
    ]);
  });

  it("sessionStorage を直接触るのは共通ファイルだけ", () => {
    expect(usersOf("sessionStorage.")).toEqual([
      FROM_SEARCH_MODULE,
      SEARCH_SCROLL_MODULE,
    ]);
  });

  it("src/components は FROM_SEARCH_STORAGE_KEY や BackToSearchLink を参照しない", () => {
    const offenders = appSourceFiles
      .filter((f) => rel(f).startsWith("src/components/"))
      .filter((f) => /FROM_SEARCH_STORAGE_KEY|BackToSearchLink/.test(read(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
