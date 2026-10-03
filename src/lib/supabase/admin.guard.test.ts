import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 秘密キー（SUPABASE_SECRET_KEY）の使用範囲を、ソースコードの静的な検査で守る。
 * 対応TC: TC-SEC-25（使用範囲）・TC-SEC-26（使用するAdmin API）
 * 対応仕様: 要件仕様書 Ver2 16_技術構成 TF13、18_環境変数・セキュリティ ES48〜ES52
 *
 * 管理者用キーを使ってよいのは、アカウント削除（U08）のサーバー側だけである。
 * 後から別の場所で使われたり、ブラウザ向けコードに混ざったりしたら、このテストが失敗する。
 */

const ROOT = path.resolve(__dirname, "../../..");
const ADMIN_MODULE = "src/lib/supabase/admin.ts";
const ADMIN_IMPORTER = "src/app/account/delete/actions.ts";

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

// アプリのソース（テストを除く）
const appSourceFiles = walk(path.join(ROOT, "src")).filter(
  (f) => isSource(f) && !isTestFile(f),
);
const read = (file: string) => readFileSync(file, "utf-8");

describe("SUPABASE_SECRET_KEY の使用範囲（サーバー専用モジュール1か所だけ）", () => {
  it("SUPABASE_SECRET_KEY を参照するアプリのソースは、サーバー専用のAdminモジュール1つだけである", () => {
    const users = appSourceFiles
      .filter((f) => read(f).includes("SUPABASE_SECRET_KEY"))
      .map(rel);
    expect(users).toEqual([ADMIN_MODULE]);
  });

  it("e2eのソースでは、アプリ用の変数としてSUPABASE_SECRET_KEYを参照しない（テスト専用の変数名だけを使う）", () => {
    const e2eFiles = walk(path.join(ROOT, "e2e")).filter(isSource);
    const users = e2eFiles
      .filter((f) => /process\.env\.SUPABASE_SECRET_KEY/.test(read(f)))
      .map(rel);
    expect(users).toEqual([]);
  });

  it("旧キー（SUPABASE_SERVICE_ROLE_KEY）はどこでも使われていない", () => {
    const targets = [
      ...appSourceFiles,
      ...walk(path.join(ROOT, "e2e")).filter(isSource),
    ];
    const users = targets
      .filter((f) => read(f).includes("SERVICE_ROLE_KEY"))
      // この検査自体は除く
      .filter((f) => rel(f) !== "src/lib/supabase/admin.guard.test.ts")
      .map(rel);
    expect(users).toEqual([]);
  });

  it("秘密キーの環境変数に NEXT_PUBLIC_ を付けていない（コード・.env.example）", () => {
    const targets = [
      ...appSourceFiles,
      ...walk(path.join(ROOT, "e2e")).filter(isSource),
      path.join(ROOT, ".env.example"),
    ];
    const bad = targets
      .filter((f) => /NEXT_PUBLIC_[A-Z_]*SECRET/.test(read(f)))
      .filter((f) => rel(f) !== "src/lib/supabase/admin.guard.test.ts")
      .map(rel);
    expect(bad).toEqual([]);
  });

  it(".env.example には SUPABASE_SECRET_KEY の名前だけがあり、値は空である", () => {
    const lines = read(path.join(ROOT, ".env.example"))
      .split(/\r?\n/)
      .filter((l) => l.trim() !== "");
    expect(lines).toContain("SUPABASE_SECRET_KEY=");
    for (const line of lines) {
      expect(line).toMatch(/^[A-Z_]+=$/);
    }
  });
});

describe("Adminモジュール（src/lib/supabase/admin.ts）", () => {
  const source = read(path.join(ROOT, ADMIN_MODULE));

  it('"server-only" を読み込む（クライアント側からimportするとビルドエラーになる）', () => {
    expect(source).toMatch(/^import "server-only";/m);
  });

  it('"use client" ではない', () => {
    expect(source).not.toMatch(/^["']use client["']/m);
  });

  it("使うAdmin APIは auth.admin.deleteUser() だけである", () => {
    const calls = [...source.matchAll(/\.auth\.admin\.(\w+)\s*\(/g)].map(
      (m) => m[1],
    );
    expect(calls).toEqual(["deleteUser"]);
  });
});

describe("Adminモジュールの利用箇所", () => {
  it("アプリのソースで auth.admin.* を呼ぶのは、Adminモジュールだけである", () => {
    const users = appSourceFiles
      .filter((f) => /\.auth\.admin\./.test(read(f)))
      .map(rel);
    expect(users).toEqual([ADMIN_MODULE]);
  });

  it("Adminモジュールをimportするのは、アカウント削除のServer Actionだけである", () => {
    const importers = appSourceFiles
      .filter((f) => /from\s+["']@\/lib\/supabase\/admin["']/.test(read(f)))
      .map(rel);
    expect(importers).toEqual([ADMIN_IMPORTER]);
  });

  it("Adminモジュールを読み込むServer Actionは、ファイル全体がServer Action（use server）である", () => {
    const source = read(path.join(ROOT, ADMIN_IMPORTER));
    expect(source).toMatch(/^"use server";/m);
  });

  it("Client Component（use client）やproxy.tsは、Adminモジュールをimportしない", () => {
    const offenders = appSourceFiles
      .filter((f) => {
        const text = read(f);
        const isClient = /^\s*["']use client["']/m.test(
          text.split("\n").slice(0, 5).join("\n"),
        );
        const isProxy = /(^|\/)proxy\.ts$/.test(rel(f));
        const importsAdmin = /supabase\/admin["']/.test(text);
        return (isClient || isProxy) && importsAdmin;
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
