// メモ・お気に入りのServer Actionで共通して使う、画面向けエラーメッセージ。
// "use server" のファイルは async 関数以外を export できないため、別ファイルに置く。
export const AUTH_ERROR_MESSAGE =
  "ログイン状態を確認できませんでした。再度ログインしてください。";
export const INVALID_STORE_ERROR_MESSAGE = "店舗情報を確認できませんでした。";
// アカウント削除（U08）の失敗時。内部エラーの内容は画面に出さず、この固定の文言だけを表示する
export const DELETE_ACCOUNT_ERROR_MESSAGE =
  "アカウントを削除できませんでした。時間をおいてもう一度お試しください。";
// 保護対象のアカウント（共有デモアカウント）が削除を要求したとき、およびU08の注意文に表示する固定の文言
export const PROTECTED_ACCOUNT_ERROR_MESSAGE = "デモアカウントは削除できません";
