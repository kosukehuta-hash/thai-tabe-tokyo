import { describe, expect, it } from "vitest";
import { NOTE_MAX_LENGTH, TOO_LONG_NOTE_ERROR_MESSAGE } from "./note-limits";

describe("メモの文字数上限（note-limits）", () => {
  it("上限は500文字（要件仕様書 Ver2 の仕様値。変更するときは、仕様書・DBのCHECK制約も同時に変える）", () => {
    expect(NOTE_MAX_LENGTH).toBe(500);
  });

  it("超過時のエラーメッセージは、上限の定数から作られる（数字の直書きではない）", () => {
    expect(TOO_LONG_NOTE_ERROR_MESSAGE).toBe(
      `メモは${NOTE_MAX_LENGTH}文字以内で入力してください。`,
    );
    expect(TOO_LONG_NOTE_ERROR_MESSAGE).toContain(String(NOTE_MAX_LENGTH));
  });

  it("画面に表示する文言は、従来と同じ『メモは500文字以内で入力してください。』", () => {
    expect(TOO_LONG_NOTE_ERROR_MESSAGE).toBe(
      "メモは500文字以内で入力してください。",
    );
  });
});
