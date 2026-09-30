// メモ・お気に入りのServer Actionで共通して使う、画面向けエラーメッセージ。
// "use server" のファイルは async 関数以外を export できないため、別ファイルに置く。
export const AUTH_ERROR_MESSAGE =
  "ログイン状態を確認できませんでした。再度ログインしてください。";
export const INVALID_STORE_ERROR_MESSAGE = "店舗情報を確認できませんでした。";
