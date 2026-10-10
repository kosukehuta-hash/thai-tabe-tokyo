// 店舗メモ（U03「行ったお店のメモ」）の入力の制約。
// 画面（Client Component の maxLength）とサーバー（Server Action の検証）の両方がこの値を使い、
// 片方だけ変わって食い違うことを防ぐ。
// ブラウザ側にも出てよい仕様値だけを置く（server-only・秘密・環境変数・Node専用APIは含めない）。
//
// 仕様: 要件仕様書 Ver2 08_U03店舗詳細（メモの文字数）、09_DB設計（CHECK制約）
// DB側（supabase/migrations の store_visit_notes_note_text_length_check）の上限も、同じ値にそろえる
// （食い違わないことは src/lib/validation-constants.guard.test.ts が確認する）。
export const NOTE_MAX_LENGTH = 500;

export const TOO_LONG_NOTE_ERROR_MESSAGE = `メモは${NOTE_MAX_LENGTH}文字以内で入力してください。`;
