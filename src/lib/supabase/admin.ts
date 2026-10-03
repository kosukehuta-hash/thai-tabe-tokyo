import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

/**
 * 管理者用のSupabaseクライアント（Auth Admin API）。
 *
 * アカウント削除（U08）に限り、SUPABASE_SECRET_KEY をサーバー側でのみ使用してよい
 * （要件仕様書 Ver2 16_技術構成 TF13・18_環境変数・セキュリティ ES48〜ES54）。
 * このファイルが SUPABASE_SECRET_KEY を読み込む唯一の場所であり、次を守る。
 *   - server-only により、Client Component・ブラウザ向けコードからのimportはビルドエラーになる
 *   - NEXT_PUBLIC_ を付けない。proxy.ts・他の機能では使わない
 *   - 使うAdmin APIは auth.admin.deleteUser() のみ
 *   - 呼び出しごとにキーを読み込み、クライアントやキーを保持・export しない
 *   - エラーの詳細（message等）は返さない（秘密キー・ユーザー情報を画面・ログへ出さないため）
 */

export type DeleteUserResult = {
  // 成功時は null。失敗時はエラーコードだけを返す（詳細メッセージは返さない）
  error: { code: string | null } | null;
};

/**
 * 指定したユーザーのアカウントを削除する（Auth Admin API: auth.admin.deleteUser）。
 * 削除対象のIDは、呼び出し側が「ログイン中ユーザーの検証済みJWT」から取得した本人のIDだけを渡すこと。
 * メモ・お気に入りは ON DELETE CASCADE で連動して削除される（このファイルでは何もしない）。
 * 例外は投げず、失敗は { error } で返す。
 */
export async function deleteUserAsAdmin(
  userId: string,
): Promise<DeleteUserResult> {
  try {
    const url = requireEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    );
    const secretKey = requireEnv(
      process.env.SUPABASE_SECRET_KEY,
      "SUPABASE_SECRET_KEY",
    );

    const admin = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 第2引数 false は物理削除（論理削除にしない）。同じメールアドレスで再登録できるようにする
    const { error } = await admin.auth.admin.deleteUser(userId, false);
    if (error) {
      return { error: { code: error.code ?? null } };
    }
    return { error: null };
  } catch {
    return { error: { code: "admin_client_error" } };
  }
}
