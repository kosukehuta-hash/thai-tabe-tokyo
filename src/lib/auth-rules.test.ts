import { describe, expect, it } from "vitest";
import {
  EMAIL_PATTERN,
  MIN_PASSWORD_LENGTH,
  PASSWORD_TOO_SHORT_ERROR_MESSAGE,
} from "./auth-rules";

// 共通化する前に、ログイン・サインアップのServer Actionへ、それぞれ直書きされていた正規表現。
// 共通化しても判定が変わっていないことを確かめるために、元の定義をここに残す
const ORIGINAL_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

describe("パスワードの最小長（auth-rules）", () => {
  it("最小長は8文字（要件仕様書 Ver2 の仕様値。変更するときは、仕様書・Supabaseの設定も同時に変える）", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it("エラーメッセージは、最小長の定数から作られる（数字の直書きではない）", () => {
    expect(PASSWORD_TOO_SHORT_ERROR_MESSAGE).toBe(
      `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`,
    );
    expect(PASSWORD_TOO_SHORT_ERROR_MESSAGE).toContain(
      String(MIN_PASSWORD_LENGTH),
    );
  });

  it("画面に表示する文言は、従来と同じ『パスワードは8文字以上で入力してください。』", () => {
    expect(PASSWORD_TOO_SHORT_ERROR_MESSAGE).toBe(
      "パスワードは8文字以上で入力してください。",
    );
  });
});

describe("メールアドレスの形式（EMAIL_PATTERN）", () => {
  it("共通化前の正規表現と、まったく同じ（内容・フラグとも変更なし）", () => {
    expect(EMAIL_PATTERN.source).toBe(ORIGINAL_EMAIL_PATTERN.source);
    expect(EMAIL_PATTERN.flags).toBe(ORIGINAL_EMAIL_PATTERN.flags);
  });

  it("g・yフラグがなく、続けて使っても判定が変わらない（状態を持たない）", () => {
    expect(EMAIL_PATTERN.global).toBe(false);
    expect(EMAIL_PATTERN.sticky).toBe(false);
    expect(EMAIL_PATTERN.test("user@example.com")).toBe(true);
    expect(EMAIL_PATTERN.test("user@example.com")).toBe(true);
  });

  it.each([
    "user@example.com",
    "a@b.co",
    "user.name+tag@example.co.jp",
    "UPPER@EXAMPLE.COM",
    "日本語@例え.jp",
  ])("有効なメールアドレス（%s）は、許可される", (email) => {
    expect(EMAIL_PATTERN.test(email)).toBe(true);
    expect(ORIGINAL_EMAIL_PATTERN.test(email)).toBe(true);
  });

  it.each([
    "",
    "plain",
    "a@b",
    "a@@b.co",
    "@b.co",
    "a@.co",
    "a@b.",
    "a b@c.co",
    "a@b .co",
    " a@b.co",
    "a@b.co ",
    "a@b.co\n",
  ])("無効なメールアドレス（%j）は、拒否される", (email) => {
    expect(EMAIL_PATTERN.test(email)).toBe(false);
    expect(ORIGINAL_EMAIL_PATTERN.test(email)).toBe(false);
  });
});
