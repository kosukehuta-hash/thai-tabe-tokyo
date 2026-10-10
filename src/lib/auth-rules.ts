// ログイン（U04）・サインアップ（U05）の入力の制約。
// 画面（Client Component の minLength）とサーバー（Server Action の検証）の両方がこの値を使い、
// 片方だけ変わって食い違うことを防ぐ。
// ブラウザ側にも出てよい仕様値だけを置く（server-only・秘密・環境変数・Node専用APIは含めない）。
//
// 仕様: 要件仕様書 Ver2 08_1_U04ログイン・08_2_U05新規登録（8文字以上）、16_技術構成（最小パスワード長）
// Supabase Auth 側の最小パスワード長（supabase/config.toml の minimum_password_length と、
// 本番のAuth設定）も、同じ値にそろえる
// （config.toml との一致は src/lib/validation-constants.guard.test.ts が確認する）。
export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_TOO_SHORT_ERROR_MESSAGE = `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`;

// メールアドレスの形式の簡易チェック（空白・@を含まない文字列＋@＋ドットを含むドメイン）。
// g・y フラグは付けない（test() が呼び出しごとに状態を持たないようにするため）。
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
