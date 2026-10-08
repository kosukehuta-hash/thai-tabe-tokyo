import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  createClient: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
  deleteUserAsAdmin: vi.fn(),
  signOut: vi.fn(),
  isProtectedUserId: vi.fn(),
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
// 保護判定は本物の処理（環境変数 PROTECTED_USER_IDS を読む）をそのまま使い、
// 呼び出しの順序・引数だけを検査できるよう、呼び出しを記録するラッパーに差し替える
vi.mock("@/lib/protected-users", () => ({
  isProtectedUserId: mocks.isProtectedUserId,
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

beforeEach(async () => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("SUPABASE_SECRET_KEY", FAKE_SECRET);
  // 既存のテストは、保護対象なし（未設定と同じ）の状態で行う
  vi.stubEnv("PROTECTED_USER_IDS", "");
  const actual = await vi.importActual<typeof import("@/lib/protected-users")>(
    "@/lib/protected-users",
  );
  mocks.isProtectedUserId.mockImplementation(actual.isProtectedUserId);
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

// 実在しないダミーのUUID形式の値（実際のデモユーザーのIDではない）
const PROTECTED_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NORMAL_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROTECTED_MESSAGE = "デモアカウントは削除できません";

describe("deleteAccount（デモアカウント保護）", () => {
  beforeEach(() => {
    vi.stubEnv("PROTECTED_USER_IDS", PROTECTED_ID);
    mocks.getAuthenticatedUserId.mockResolvedValue(PROTECTED_ID);
  });

  it("保護対象のIDでログイン中 → 削除処理（deleteUserAsAdmin）を呼ばず、『デモアカウントは削除できません』を返す", async () => {
    const result = await deleteAccount(initialState);
    expect(result).toEqual({ error: PROTECTED_MESSAGE });
    expect(mocks.deleteUserAsAdmin).not.toHaveBeenCalled();
  });

  it("保護対象 → サインアウト・画面の再取得・U01への移動も実行しない", async () => {
    await deleteAccount(initialState);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("保護対象 → ログと戻り値に、保護対象UUIDの実値を含めない", async () => {
    const result = await deleteAccount(initialState);
    expect(JSON.stringify(result)).not.toContain(PROTECTED_ID);
    expect(JSON.stringify(result)).not.toContain(FAKE_SECRET);
    // 異常ログも出さない（保護対象での実行は想定された動作）
    expect(consoleError).not.toHaveBeenCalled();
    expect(loggedText()).not.toContain(PROTECTED_ID);
  });

  it("保護対象ではないID → 従来どおり削除処理が呼ばれ、/?withdrawn=1 へ遷移する（既存の削除処理を壊さない）", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(NORMAL_ID);
    await expect(deleteAccount(initialState)).rejects.toThrow(
      "NEXT_REDIRECT:/?withdrawn=1",
    );
    expect(mocks.deleteUserAsAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUserAsAdmin).toHaveBeenCalledWith(NORMAL_ID);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mocks.redirect).toHaveBeenCalledWith("/?withdrawn=1");
  });

  it("未ログイン → 保護判定より先に認証エラーを返し、削除処理は呼ばない", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const result = await deleteAccount(initialState);
    expect(result).toEqual({ error: AUTH_MESSAGE });
    expect(mocks.isProtectedUserId).not.toHaveBeenCalled();
    expect(mocks.deleteUserAsAdmin).not.toHaveBeenCalled();
  });

  it("保護判定には、検証済みJWTから取得したIDだけを使う（フォーム値・前回stateのIDは使わない）", async () => {
    const call = deleteAccount as unknown as (
      ...args: unknown[]
    ) => Promise<unknown>;

    // 検証済みJWTのIDは通常ユーザー。フォーム値・stateに保護対象のIDがあっても、保護されない（他人のIDで判定しない）
    mocks.getAuthenticatedUserId.mockResolvedValue(NORMAL_ID);
    const forged = new FormData();
    forged.set("userId", PROTECTED_ID);
    forged.set("user_id", PROTECTED_ID);
    await expect(
      call({ error: null, userId: PROTECTED_ID }, forged),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.isProtectedUserId).toHaveBeenCalledTimes(1);
    expect(mocks.isProtectedUserId).toHaveBeenCalledWith(NORMAL_ID);
    expect(mocks.deleteUserAsAdmin).toHaveBeenCalledWith(NORMAL_ID);

    // 検証済みJWTのIDは保護対象。フォーム値に通常ユーザーのIDがあっても、保護を回避できない
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ auth: { signOut: mocks.signOut } });
    mocks.getAuthenticatedUserId.mockResolvedValue(PROTECTED_ID);
    const forged2 = new FormData();
    forged2.set("userId", NORMAL_ID);
    await expect(call(initialState, forged2)).resolves.toEqual({
      error: PROTECTED_MESSAGE,
    });
    expect(mocks.deleteUserAsAdmin).not.toHaveBeenCalled();
  });

  it("保護判定は、削除処理を呼ぶ前に行われる（呼び出し順の確認）", async () => {
    // 保護対象ではない場合: 認証 → 保護判定 → 削除処理 の順
    mocks.getAuthenticatedUserId.mockResolvedValue(NORMAL_ID);
    await expect(deleteAccount(initialState)).rejects.toThrow("NEXT_REDIRECT");
    const order = [
      mocks.getAuthenticatedUserId,
      mocks.isProtectedUserId,
      mocks.deleteUserAsAdmin,
    ].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(order.every((n) => typeof n === "number")).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // 保護対象の場合: 認証 → 保護判定 で終了し、削除処理は呼ばれない
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ auth: { signOut: mocks.signOut } });
    mocks.getAuthenticatedUserId.mockResolvedValue(PROTECTED_ID);
    await deleteAccount(initialState);
    expect(mocks.isProtectedUserId).toHaveBeenCalledTimes(1);
    expect(
      mocks.getAuthenticatedUserId.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.isProtectedUserId.mock.invocationCallOrder[0]);
    expect(mocks.deleteUserAsAdmin).not.toHaveBeenCalled();
  });
});
