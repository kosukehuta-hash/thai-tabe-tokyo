import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 依存の向きを、ソースコードの静的な検査で守る。
 * src/components（共通部品）は、src/app（画面ごとのコード）を import しない。
 * 再利用する Server Action は src/actions、共通の定数・処理は src/lib に置く。
 * 後から src/components が src/app を参照したら失敗する。
 */

const ROOT = path.resolve(__dirname, "../..");

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
const isSource = (file: string) => /\.(ts|tsx)$/.test(file);

// import・vi.mock のどちらでも、"@/app/..." や相対パスの "../app/..." を指していたら見つける
const APP_REFERENCE = /["'](?:@\/app\/|(?:\.\.\/)+app\/)/;

describe("src/components の依存の向き", () => {
  const componentFiles = walk(path.join(ROOT, "src/components")).filter(
    isSource,
  );

  it("検査の対象ファイルが1件以上ある（検査が空振りしていない）", () => {
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  it("src/components は src/app 配下を import しない（テストの vi.mock を含む）", () => {
    const offenders = componentFiles
      .filter((f) => APP_REFERENCE.test(readFileSync(f, "utf-8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("検査用の正規表現が、想定の書き方を見つけられる", () => {
    expect(
      APP_REFERENCE.test('import { x } from "@/app/logout/actions";'),
    ).toBe(true);
    expect(
      APP_REFERENCE.test('vi.mock("../app/favorites/actions", () => ({}))'),
    ).toBe(true);
    expect(APP_REFERENCE.test('import { x } from "@/actions/logout";')).toBe(
      false,
    );
  });
});
