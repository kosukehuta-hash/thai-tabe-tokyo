import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// SignupForm が読み込む Server Action（実体はサーバー用Supabaseクライアントを使う）は、モックに差し替える
vi.mock("./actions", () => ({ signup: vi.fn() }));

import { SignupForm } from "./SignupForm";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";

describe("SignupForm のパスワード入力欄の最小文字数", () => {
  it("パスワード欄の minLength は、共通の MIN_PASSWORD_LENGTH と同じ値（8）", () => {
    const html = renderToStaticMarkup(<SignupForm />);
    const input = html.match(/<input[^>]*type="password"[^>]*>/);
    expect(input, "パスワード入力欄が見つかりません").not.toBeNull();
    const match = (input as RegExpMatchArray)[0].match(/\sminLength="(\d+)"/);
    expect(
      match,
      "パスワード入力欄に minLength が設定されていません",
    ).not.toBeNull();
    expect(Number((match as RegExpMatchArray)[1])).toBe(MIN_PASSWORD_LENGTH);
    expect(Number((match as RegExpMatchArray)[1])).toBe(8);
  });
});
