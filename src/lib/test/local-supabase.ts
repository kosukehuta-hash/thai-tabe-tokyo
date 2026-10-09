import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * ローカルSupabase（`supabase start`で起動したこのプロジェクト専用インスタンス）に対する
 * Vitest用の共通ヘルパー。本番Supabaseの接続情報（.env.local / NEXT_PUBLIC_SUPABASE_URL等）は
 * 一切参照せず、service_role / Secret key も使用しない。
 *
 * is_publishedの変更・件数確認など、authenticated/anonロールに権限がない操作は、
 * ローカルDBコンテナへdocker exec psqlで直接接続して行う。
 */

export const LOCAL_SUPABASE_URL =
  process.env.TEST_LOCAL_SUPABASE_URL ?? "http://127.0.0.1:54321";
// ローカルSupabase既定のanon（公開）キー。本番の値ではない
export const LOCAL_SUPABASE_ANON_KEY =
  process.env.TEST_LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const LOCAL_DB_CONTAINER =
  process.env.TEST_LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_thai-tabe-tokyo";

export const TEST_PASSWORD = "TestPassword123!";

export function newAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
}

/** ローカルDBでSQLを実行する（出力は捨てる） */
export function runPsql(sql: string): void {
  execFileSync(
    "docker",
    [
      "exec",
      LOCAL_DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-c",
      sql,
    ],
    { stdio: "ignore", timeout: 10_000 },
  );
}

/** ローカルDBでSQLを実行し、結果を「列は | 区切り・行は改行区切り」の文字列で返す（読み取り確認用） */
export function queryPsql(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      LOCAL_DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-F",
      "|",
      "-c",
      sql,
    ],
    { encoding: "utf8", timeout: 10_000 },
  ).trim();
}

/**
 * 環境変数 REQUIRE_LOCAL_SUPABASE=1 のときは「ローカルSupabaseが使えない場合にskipせず失敗させる」モード。
 * CIの統合テストjobで、43件が静かにスキップされることを防ぐために設定する。
 * 値は呼び出し時に読む（テストで切り替えられるようにするため）。
 */
export function isLocalSupabaseRequired(): boolean {
  return process.env.REQUIRE_LOCAL_SUPABASE === "1";
}

/** URLのホストが 127.0.0.1 / localhost / [::1] のいずれかか（クラウドSupabaseへの誤接続防止） */
export function isLoopbackUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "127.0.0.1" ||
      hostname === "localhost" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

/**
 * ローカルDBの管理者用キー（TEST_LOCAL_ADMIN_KEY）を返す。
 * 必須モードで未設定の場合は、skipせずエラーにする。
 */
export function getLocalAdminKey(): string | undefined {
  const key = process.env.TEST_LOCAL_ADMIN_KEY;
  if (!key && isLocalSupabaseRequired()) {
    throw new Error(
      "REQUIRE_LOCAL_SUPABASE=1 ですが、TEST_LOCAL_ADMIN_KEY が設定されていません。",
    );
  }
  return key || undefined;
}

/**
 * ローカルSupabase・Dockerが利用できるか。
 * 通常は、利用できない場合 false を返し、テストはスキップされる。
 * REQUIRE_LOCAL_SUPABASE=1 のときは、利用できない場合 false を返さずエラーにする（skipさせない）。
 * 接続先がローカル（127.0.0.1 / localhost）でない場合は、どちらのモードでも使用しない
 * （管理者権限でクラウドSupabaseへ接続しないため）。
 */
export async function isLocalSupabaseAvailable(): Promise<boolean> {
  const required = isLocalSupabaseRequired();

  function unavailable(reason: string): false {
    if (required) {
      throw new Error(
        `REQUIRE_LOCAL_SUPABASE=1 ですが、ローカルSupabaseを使用できません: ${reason}`,
      );
    }
    return false;
  }

  if (!isLoopbackUrl(LOCAL_SUPABASE_URL)) {
    return unavailable(
      "接続先URLがローカル（127.0.0.1 / localhost）ではありません。",
    );
  }
  if (required && !process.env.TEST_LOCAL_SUPABASE_ANON_KEY) {
    return unavailable("TEST_LOCAL_SUPABASE_ANON_KEY が設定されていません。");
  }

  let failure: string | null = null;
  try {
    const res = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) {
      failure = `ヘルスチェックが失敗しました（HTTP ${res.status}）。`;
    } else {
      runPsql("select 1;");
    }
  } catch {
    failure = "ローカルSupabaseまたはDocker（DBコンテナ）へ接続できません。";
  }
  return failure === null ? true : unavailable(failure);
}

/** テスト用ユーザーを新規登録する。登録直後にログイン済みのクライアントとuserIdを返す */
export async function signUpTestUser(
  email: string,
): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const client = newAnonClient();
  const { data, error } = await client.auth.signUp({
    email,
    password: TEST_PASSWORD,
  });
  if (error || !data.user) {
    throw new Error(`テストユーザー作成に失敗（${email}）: ${error?.message}`);
  }
  return { client, userId: data.user.id };
}

/** メールアドレスが like パターンに一致するテストユーザーを削除する（紐づくメモ・お気に入りはcascadeで削除される） */
export function deleteTestUsersByEmailLike(emailLikePattern: string): void {
  runPsql(`delete from auth.users where email like '${emailLikePattern}';`);
}
