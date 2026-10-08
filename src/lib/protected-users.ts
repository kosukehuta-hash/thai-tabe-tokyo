import "server-only";

/**
 * 削除から保護するユーザー（共有デモアカウント）の判定。
 *
 * 保護対象のユーザーIDは、サーバー専用の環境変数 PROTECTED_USER_IDS で指定する
 * （要件仕様書 Ver2 18_環境変数・セキュリティ EV05・ES56・ES57）。
 * このファイルが PROTECTED_USER_IDS を読み込む唯一の場所であり、次を守る。
 *   - server-only により、Client Component・ブラウザ向けコードからのimportはビルドエラーになる
 *   - NEXT_PUBLIC_ を付けない。画面（Client Component）へ渡してよいのは判定結果の真偽値だけ
 *   - 呼び出しごとに環境変数を読み込み、IDの一覧を保持・export しない
 *   - ユーザーIDの実値は、コード・ログ・画面に出さない
 */

/**
 * 指定したユーザーIDが保護対象かどうかを返す。
 *
 * - PROTECTED_USER_IDS はカンマ区切りで複数指定できる。各値は trim() する
 * - 大文字小文字の正規化は行わず、渡されたユーザーIDと完全一致で比較する（部分一致はしない）
 * - 未設定・空・空白だけの場合、および空の要素は、保護対象なしとして扱う
 * - 渡すユーザーIDは、ログイン中ユーザーの検証済みJWTから取得したIDだけにすること
 */
export function isProtectedUserId(userId: string): boolean {
  const raw = process.env.PROTECTED_USER_IDS;
  if (!raw) {
    return false;
  }
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "")
    .includes(userId);
}
