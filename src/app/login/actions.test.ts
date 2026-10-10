import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, createClient } = vi.hoisted(() => ({
  redirect: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { login } from "./actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";

/**
 * ログイン（login）の入力チェック。クラウドSupabaseには接続せず、Supabaseクライアントはモックで差し替える。
 * 対応仕様: 要件仕様書 Ver2 08_1_U04ログイン（メールアドレス形式、パスワードは8文字以上）
 */

const PASSWORD_TOO_SHORT_MESSAGE = "パスワードは8文字以上で入力してください。";
const EMAIL_FORMAT_MESSAGE = "メールアドレスの形式が正しくありません。";
const initialState = { error: null };

function formWith(email?: string, password?: string, next?: string): FormData {
  const formData = new FormData();
  if (email !== undefined) {
    formData.set("email", email);
  }
  if (password !== undefined) {
    formData.set("password", password);
  }
  if (next !== undefined) {
    formData.set("next", next);
  }
  return formData;
}

function supabaseAuth() {
  const signInWithPassword = vi
    .fn()
    .mockResolvedValue({ data: { session: {}, user: {} }, error: null });
  createClient.mockResolvedValue({ auth: { signInWithPassword } });
  return { signInWithPassword };
}

beforeEach(() => {
  // Next.js の redirect() と同じく、呼び出したらそれ以降の処理を続けない（例外で中断する）
  redirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("login のパスワードの長さチェック（最小長は MIN_PASSWORD_LENGTH）", () => {
  it("最小長の1文字手前（7文字）→ 拒否。共通のエラーメッセージを返し、認証処理は呼ばない", async () => {
    const { signInWithPassword } = supabaseAuth();
    const password = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(password).toHaveLength(7);
    const result = await login(
      initialState,
      formWith("user@example.com", password),
    );
    expect(result).toEqual({ error: PASSWORD_TOO_SHORT_MESSAGE });
    expect(result.error).toBe(
      `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`,
    );
    expect(createClient).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("ちょうど最小長（8文字）→ 入力チェックを通り、認証処理へ進む（成功時は元の画面へ）", async () => {
    const { signInWithPassword } = supabaseAuth();
    const password = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(password).toHaveLength(8);
    await expect(
      login(initialState, formWith("user@example.com", password)),
    ).rejects.toThrow("NEXT_REDIRECT:/");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password,
    });
  });

  it("ログイン後の移動先は、検証済みの next（不正な値は /）", async () => {
    supabaseAuth();
    await expect(
      login(
        initialState,
        formWith("user@example.com", "a".repeat(8), "/notes"),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/notes");
    await expect(
      login(
        initialState,
        formWith("user@example.com", "a".repeat(8), "https://evil.example"),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("パスワードが空・未指定 → 『パスワードを入力してください。』（最小長のメッセージではない）", async () => {
    supabaseAuth();
    const empty = await login(initialState, formWith("user@example.com", ""));
    expect(empty).toEqual({ error: "パスワードを入力してください。" });
    const missing = await login(initialState, formWith("user@example.com"));
    expect(missing).toEqual({ error: "パスワードを入力してください。" });
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("login のメールアドレスの形式チェック（EMAIL_PATTERN）", () => {
  it.each(["", "plain", "a@b", "a@@b.co", "a b@c.co", "@b.co"])(
    "無効なメールアドレス（%j）→ 拒否。認証処理は呼ばない",
    async (email) => {
      supabaseAuth();
      const result = await login(initialState, formWith(email, "a".repeat(8)));
      expect(result.error).toBe(
        email === ""
          ? "メールアドレスを入力してください。"
          : EMAIL_FORMAT_MESSAGE,
      );
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it.each(["user@example.com", "a@b.co", "user.name+tag@example.co.jp"])(
    "有効なメールアドレス（%s）→ 入力チェックを通る",
    async (email) => {
      const { signInWithPassword } = supabaseAuth();
      await expect(
        login(initialState, formWith(email, "a".repeat(8))),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(signInWithPassword).toHaveBeenCalledTimes(1);
    },
  );
});
