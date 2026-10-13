import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH } from "./auth-rules";
import { NOTE_MAX_LENGTH } from "./note-limits";

/**
 * 入力の制約（仕様値）が、コード・DB・Supabaseの設定で食い違わないことを、静的な検査で守る。
 * - メモの文字数上限（NOTE_MAX_LENGTH）: 画面・Server Action・DBのCHECK制約
 * - パスワードの最小長（MIN_PASSWORD_LENGTH）: 画面・Server Action・Supabaseの設定（config.toml）
 * - メールアドレスの形式（EMAIL_PATTERN）: ログイン・サインアップで同じ定義を使う
 *
 * 対応仕様: 要件仕様書 Ver2 08_U03店舗詳細（メモ1〜500文字）、09_DB設計（CHECK制約）、
 *           08_1・08_2（パスワード8文字以上）、16_技術構成（最小パスワード長の統一）
 *
 * 値を変えるときは、定数・DB（新しいmigration）・config.toml（と本番のAuth設定）・仕様書を、同時に変える。
 * 片方だけ変えると、このテストが失敗する。
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
const read = (file: string) => readFileSync(file, "utf-8");
const isTestFile = (file: string) => /\.(test|spec)\.[tj]sx?$/.test(file);
const isSource = (file: string) => /\.(ts|tsx)$/.test(file);

const appSourceFiles = walk(path.join(ROOT, "src")).filter(
  (f) => isSource(f) && !isTestFile(f),
);

/** 指定した名前の定数を「定義（const NAME =）」しているアプリのソース */
function definersOf(name: string): string[] {
  const pattern = new RegExp(`\\bconst\\s+${name}\\s*(:[^=]+)?=`);
  return appSourceFiles.filter((f) => pattern.test(read(f))).map(rel);
}

describe("メモの文字数上限（NOTE_MAX_LENGTH）", () => {
  it("定義は src/lib/note-limits.ts の1か所だけ（画面・Server Actionに、同じ定数を持たない）", () => {
    expect(definersOf("NOTE_MAX_LENGTH")).toEqual(["src/lib/note-limits.ts"]);
  });

  it("画面（StoreVisitNote）とServer Action（saveNote）は、どちらも共通の定義を使っている", () => {
    for (const file of [
      "src/components/StoreVisitNote.tsx",
      "src/app/store/[storeId]/actions.ts",
    ]) {
      expect(read(path.join(ROOT, file)), file).toMatch(
        /from\s+["']@\/lib\/note-limits["']/,
      );
    }
    // 画面の maxLength に、数字を直書きしていない
    expect(read(path.join(ROOT, "src/components/StoreVisitNote.tsx"))).toMatch(
      /maxLength=\{NOTE_MAX_LENGTH\}/,
    );
  });

  it("DBのCHECK制約（store_visit_notes_note_text_length_check）の上限が、NOTE_MAX_LENGTH と同じ", () => {
    const migrationsDir = path.join(ROOT, "supabase/migrations");
    const files = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    // 制約を定義・変更したmigrationのうち、最後（最新）のもの
    const limits: number[] = [];
    for (const name of files) {
      const sql = read(path.join(migrationsDir, name));
      const match = sql.match(
        /store_visit_notes_note_text_length_check\s+check\s*\(\s*char_length\s*\(\s*btrim\s*\(\s*note_text\s*\)\s*\)\s*between\s+1\s+and\s+(\d+)\s*\)/i,
      );
      if (match) {
        limits.push(Number(match[1]));
      }
    }
    expect(
      limits.length,
      "migration内に、メモの文字数のCHECK制約が見つかりません（SQLの書き方を変えた場合は、この検査も直す）",
    ).toBeGreaterThan(0);
    expect(limits[limits.length - 1]).toBe(NOTE_MAX_LENGTH);
  });
});

describe("パスワードの最小長（MIN_PASSWORD_LENGTH）", () => {
  it("定義は src/lib/auth-rules.ts の1か所だけ（画面・Server Actionに、同じ定数を持たない）", () => {
    expect(definersOf("MIN_PASSWORD_LENGTH")).toEqual([
      "src/lib/auth-rules.ts",
    ]);
  });

  it("ログイン・サインアップの画面とServer Actionは、どれも共通の定義を使っている", () => {
    for (const file of [
      "src/app/login/LoginForm.tsx",
      "src/app/login/actions.ts",
      "src/app/signup/SignupForm.tsx",
      "src/app/signup/actions.ts",
    ]) {
      const source = read(path.join(ROOT, file));
      expect(source, file).toMatch(/from\s+["']@\/lib\/auth-rules["']/);
      // 数字（8）の直書きがない
      expect(source, file).not.toMatch(/minLength=\{\d+\}/);
      expect(source, file).not.toMatch(/8文字以上/);
    }
    for (const file of [
      "src/app/login/LoginForm.tsx",
      "src/app/signup/SignupForm.tsx",
    ]) {
      expect(read(path.join(ROOT, file)), file).toMatch(
        /minLength=\{MIN_PASSWORD_LENGTH\}/,
      );
    }
  });

  it("Supabaseの設定（supabase/config.toml の minimum_password_length）が、MIN_PASSWORD_LENGTH と同じ", () => {
    const toml = read(path.join(ROOT, "supabase/config.toml"));
    const match = toml.match(/^\s*minimum_password_length\s*=\s*(\d+)/m);
    expect(
      match,
      "config.toml に minimum_password_length が見つかりません",
    ).not.toBeNull();
    expect(Number((match as RegExpMatchArray)[1])).toBe(MIN_PASSWORD_LENGTH);
  });
});

describe("メールアドレスの形式（EMAIL_PATTERN）", () => {
  it("定義は src/lib/auth-rules.ts の1か所だけ", () => {
    expect(definersOf("EMAIL_PATTERN")).toEqual(["src/lib/auth-rules.ts"]);
  });

  it("ログイン・サインアップのServer Actionは、どちらも共通の定義を使っている", () => {
    for (const file of [
      "src/app/login/actions.ts",
      "src/app/signup/actions.ts",
    ]) {
      const source = read(path.join(ROOT, file));
      expect(source, file).toMatch(
        /EMAIL_PATTERN[\s\S]*from\s+["']@\/lib\/auth-rules["']/,
      );
    }
  });
});

describe("共通の定数ファイルは、クライアント・サーバーのどちらからも安全に読み込める", () => {
  it.each(["src/lib/note-limits.ts", "src/lib/auth-rules.ts"])(
    "%s は、server-only・秘密・環境変数・Node専用APIを含まない",
    (file) => {
      // コメントを除いたコードだけを検査する
      const code = read(path.join(ROOT, file))
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(code).not.toMatch(/server-only/);
      expect(code).not.toMatch(/process\.env/);
      expect(code).not.toMatch(/from\s+["']node:/);
      expect(code).not.toMatch(/SECRET|SERVICE_ROLE/);
      expect(code).not.toMatch(/^\s*["']use (server|client)["']/m);
      // 他のモジュールを読み込まない（値だけの、単独で読み込めるファイル）
      expect(code).not.toMatch(/^\s*import\s/m);
    },
  );
});
