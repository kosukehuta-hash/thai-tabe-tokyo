import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 保護対象ユーザー（共有デモアカウント）の環境変数 PROTECTED_USER_IDS の使用範囲を、
 * ソースコードの静的な検査で守る。
 * 対応TC: TC-SEC-29・TC-SEC-30
 * 対応仕様: 要件仕様書 Ver2 18_環境変数・セキュリティ EV05・ES56・ES57
 *
 * PROTECTED_USER_IDS を読んでよいのは、サーバー専用の判定モジュールだけである。
 * 後から別の場所で読まれたり、ブラウザ向けの公開変数になったりしたら、このテストが失敗する。
 */

const ROOT = path.resolve(__dirname, "../..");
const PROTECTED_MODULE = "src/lib/protected-users.ts";
const ENV_NAME = "PROTECTED_USER_IDS";

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

function rel(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

const isTestFile = (file: string) => /\.(test|spec)\.[tj]sx?$/.test(file);
const isSource = (file: string) => /\.(ts|tsx|js|jsx|mjs|css)$/.test(file);
const read = (file: string) => readFileSync(file, "utf-8");

// アプリのソース（テストを除く）
const appSourceFiles = walk(path.join(ROOT, "src")).filter(
  (f) => isSource(f) && !isTestFile(f),
);

describe("PROTECTED_USER_IDS の使用範囲（サーバー専用モジュール1か所だけ）", () => {
  it("PROTECTED_USER_IDS を参照するアプリのソースは、サーバー専用モジュール1つだけである（server-only）", () => {
    const users = appSourceFiles
      .filter((f) => read(f).includes(ENV_NAME))
      .map(rel);
    expect(users).toEqual([PROTECTED_MODULE]);

    const source = read(path.join(ROOT, PROTECTED_MODULE));
    // クライアント側からimportするとビルドエラーになる
    expect(source).toMatch(/^import "server-only";/m);
    expect(source).not.toMatch(/^["']use client["']/m);
  });

  it("PROTECTED_USER_IDS に NEXT_PUBLIC_ を付けていない（コード・.env.example）", () => {
    const targets = [
      ...appSourceFiles,
      ...walk(path.join(ROOT, "e2e")).filter(isSource),
      path.join(ROOT, ".env.example"),
    ];
    const bad = targets
      .filter((f) => /NEXT_PUBLIC_[A-Z_]*PROTECTED/.test(read(f)))
      .map(rel);
    expect(bad).toEqual([]);
  });

  it(".env.example には PROTECTED_USER_IDS の名前だけがあり、値は空である", () => {
    const lines = read(path.join(ROOT, ".env.example"))
      .split(/\r?\n/)
      .filter((l) => l.trim() !== "");
    expect(lines).toContain(`${ENV_NAME}=`);
    for (const line of lines) {
      expect(line).toMatch(/^[A-Z_]+=$/);
    }
  });
});
