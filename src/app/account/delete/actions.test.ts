import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  createClient: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
  deleteUserAsAdmin: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/auth", () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}));
vi.mock("@/lib/supabase/admin", () => ({
  deleteUserAsAdmin: mocks.deleteUserAsAdmin,
}));

import { deleteAccount } from "./actions";

const AUTH_MESSAGE =
  "ログイン状態を確認できませんでした。再度ログインしてください。";
const DELETE_ERROR_MESSAGE =
  "アカウントを削除できませんでした。時間をおいてもう一度お試しください。";
const initialState = { error: null };

// 秘密キー・内部エラーの詳細に見立てた値（画面・ログに出ないことを確認する）
const FAKE_SECRET = "sb_secret_FAKE_VALUE_FOR_TEST";
const INTERNAL_DETAIL = "internal detail: database connection refused";

let consoleError: ReturnType<typeof vi.spyOn>;

function loggedText(): string {
  return consoleError.mock.calls
    .flat()
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
    .join("\n");
}

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("SUPABASE_SECRET_KEY", FAKE_SECRET);
  mocks.createClient.mockResolvedValue({ auth: { signOut: mocks.signOut } });
  mocks.getAuthenticatedUserId.mockResolvedValue("user-1");
  mocks.deleteUserAsAdmin.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  // Next.js の redirect() と同じく、呼び出したらそれ以降の処理を続けない（例外で中断する）
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("deleteAccount（認証・削除対象）", () => {
  it("未ログイン → 削除処理を実行せず、認証エラーを返す（サインアウト・移動もしない）", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const result = await deleteAccount(initialState);
    expect(result).toEqual({ error: AUTH_MESSAGE });
    expect(mocks.deleteUserAsAdmin).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("削除対象は、検証済みJWTから取得した本人のIDだけである", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue("verified-user-id");
    await expect(deleteAccount(initialState)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUserAsAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUserAsAdmin).toHaveBeenCalledWith("verified-user-id");
  });

  it("フォーム値（FormData）に他人のIDが含まれていても、使わない", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue("verified-user-id");
    const forged = new FormData();
    forged.set("userId", "someone-else");
    forged.set("user_id", "someone-else");
    forged.set("id", "someone-else");
    // 本来は引数を受け取らない関数に、攻撃を想定して余計な引数を渡す
    const call = deleteAccount as unknown as (
      ...args: unknown[]
    ) => Promise<unknown>;
    await expect(call(initialState, forged)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.deleteUserAsAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUserAsAdmin).toHaveBeenCalledWith("verified-user-id");
    expect(mocks.deleteUserAsAdmin).not.toHaveBeenCalledWith("someone-else");
  });

  it("前回のstateにIDらしき値が入っていても、使わない", async () => {
    const forgedState = { error: null, userId: "someone-else" };
    await expect(deleteAccount(forgedState)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.deleteUserAsAdmin).toHaveBeenCalledWith("user-1");
  });
});

describe("deleteAccount（成功）", () => {
  it("削除成功 → セッション破棄 → 画面の再取得 → /?withdrawn=1 へ遷移する（この順序）", async () => {
    await expect(deleteAccount(initialState)).rejects.toThrow(
      "NEXT_REDIRECT:/?withdrawn=1",
    );
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mocks.redirect).toHaveBeenCalledWith("/?withdrawn=1");

    const order = [
      mocks.deleteUserAsAdmin,
      mocks.signOut,
      mocks.revalidatePath,
      mocks.redirect,
    ].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(order.every((n) => typeof n === "number")).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("成功時は異常ログを出さない", async () => {
    await expect(deleteAccount(initialState)).rejects.toThrow("NEXT_REDIRECT");
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("deleteAccount（削除の失敗）", () => {
  beforeEach(() => {
    mocks.deleteUserAsAdmin.mockResolvedValue({
      error: { code: "unexpected_failure" },
    });
  });

  it("Admin APIが失敗 → 画面用の一般的なエラーだけを返す（移動・サインアウトはしない）", async () => {
    const result = await deleteAccount(initialState);
    expect(result).toEqual({ error: DELETE_ERROR_MESSAGE });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("画面用のエラーに、内部エラーの詳細・ユーザーID・秘密キーを含めない", async () => {
    mocks.deleteUserAsAdmin.mockResolvedValue({
      error: { code: "unexpected_failure", message: INTERNAL_DETAIL },
    });
    const result = (await deleteAccount(initialState)) as { error: string };
    expect(result.error).toBe(DELETE_ERROR_MESSAGE);
    expect(JSON.stringify(result)).not.toContain(INTERNAL_DETAIL);
    expect(JSON.stringify(result)).not.toContain("user-1");
    expect(JSON.stringify(result)).not.toContain(FAKE_SECRET);
  });

  it("ログにはエラーコードだけを記録し、ユーザーID・詳細メッセージ・秘密キーを出さない", async () => {
    mocks.deleteUserAsAdmin.mockResolvedValue({
      error: { code: "unexpected_failure", message: INTERNAL_DETAIL },
    });
    await deleteAccount(initialState);
    expect(consoleError).toHaveBeenCalledTimes(1);
    const text = loggedText();
    expect(text).toContain("unexpected_failure");
    expect(text).toContain("deleteAccount.deleteUser");
    expect(text).not.toContain("user-1");
    expect(text).not.toContain(INTERNAL_DETAIL);
    expect(text).not.toContain(FAKE_SECRET);
  });

  it("失敗後に再度実行すると、もう一度削除を試せる", async () => {
    await deleteAccount(initialState);
    mocks.deleteUserAsAdmin.mockResolvedValue({ error: null });
    await expect(deleteAccount(initialState)).rejects.toThrow(
      "NEXT_REDIRECT:/?withdrawn=1",
    );
    expect(mocks.deleteUserAsAdmin).toHaveBeenCalledTimes(2);
  });
});

describe("deleteAccount（削除成功後にセッション破棄が失敗した場合）", () => {
  it("signOutがエラーを返しても、退会は成功扱いで /?withdrawn=1 へ遷移する（エラーを返さない）", async () => {
    mocks.signOut.mockResolvedValue({
      error: { code: "signout_failed", message: INTERNAL_DETAIL },
    });
    await expect(deleteAccount(initialState)).rejects.toThrow(
      "NEXT_REDIRECT:/?withdrawn=1",
    );
    expect(mocks.deleteUserAsAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith("/?withdrawn=1");
  });

  it("signOutが例外を投げても、退会は成功扱いで /?withdrawn=1 へ遷移する", async () => {
    mocks.signOut.mockRejectedValue(new Error(INTERNAL_DETAIL));
    await expect(deleteAccount(initialState)).rejects.toThrow(
      "NEXT_REDIRECT:/?withdrawn=1",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/?withdrawn=1");
  });

  it("signOut失敗のログには、ユーザーID・詳細メッセージ・秘密キーを出さない", async () => {
    mocks.signOut.mockResolvedValue({
      error: { code: "signout_failed", message: INTERNAL_DETAIL },
    });
    await expect(deleteAccount(initialState)).rejects.toThrow("NEXT_REDIRECT");
    const text = loggedText();
    expect(text).toContain("deleteAccount.signOut");
    expect(text).toContain("signout_failed");
    expect(text).not.toContain("user-1");
    expect(text).not.toContain(INTERNAL_DETAIL);
    expect(text).not.toContain(FAKE_SECRET);
  });

  it("signOutが例外を投げた場合のログにも、詳細・ユーザーID・秘密キーを出さない", async () => {
    mocks.signOut.mockRejectedValue(new Error(INTERNAL_DETAIL));
    await expect(deleteAccount(initialState)).rejects.toThrow("NEXT_REDIRECT");
    const text = loggedText();
    expect(text).toContain("deleteAccount.signOut");
    expect(text).not.toContain("user-1");
    expect(text).not.toContain(INTERNAL_DETAIL);
    expect(text).not.toContain(FAKE_SECRET);
  });
});
