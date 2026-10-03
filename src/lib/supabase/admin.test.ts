import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { deleteUserAsAdmin } from "./admin";

// 秘密キー・内部エラーの詳細に見立てた値（戻り値に出ないことを確認する）
const FAKE_SECRET = "sb_secret_FAKE_VALUE_FOR_TEST";
const FAKE_URL = "http://127.0.0.1:54321";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", FAKE_URL);
  vi.stubEnv("SUPABASE_SECRET_KEY", FAKE_SECRET);
  mocks.deleteUser.mockResolvedValue({ error: null });
  mocks.createClient.mockReturnValue({
    auth: { admin: { deleteUser: mocks.deleteUser } },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("deleteUserAsAdmin（サーバー専用のAdmin API呼び出し）", () => {
  it("成功 → { error: null }。auth.admin.deleteUser() を、指定したIDで、物理削除（false）として1回だけ呼ぶ", async () => {
    await expect(deleteUserAsAdmin("user-1")).resolves.toEqual({ error: null });
    expect(mocks.deleteUser).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-1", false);
  });

  it("接続先は NEXT_PUBLIC_SUPABASE_URL、キーは SUPABASE_SECRET_KEY を使い、セッションを保持・更新しない", async () => {
    await deleteUserAsAdmin("user-1");
    expect(mocks.createClient).toHaveBeenCalledWith(FAKE_URL, FAKE_SECRET, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it("呼び出しのたびに環境変数を読み込む（キーをモジュール内に保持しない）", async () => {
    await deleteUserAsAdmin("user-1");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_ANOTHER_FAKE_VALUE");
    await deleteUserAsAdmin("user-2");
    expect(mocks.createClient.mock.calls[0][1]).toBe(FAKE_SECRET);
    expect(mocks.createClient.mock.calls[1][1]).toBe(
      "sb_secret_ANOTHER_FAKE_VALUE",
    );
  });

  it("Admin APIのエラー → エラーコードだけを返し、詳細メッセージ・秘密キー・ユーザーIDを含めない", async () => {
    mocks.deleteUser.mockResolvedValue({
      error: {
        code: "user_not_found",
        message: `User not found: user-1 (${FAKE_SECRET})`,
        status: 404,
      },
    });
    const result = await deleteUserAsAdmin("user-1");
    expect(result).toEqual({ error: { code: "user_not_found" } });
    expect(JSON.stringify(result)).not.toContain(FAKE_SECRET);
    expect(JSON.stringify(result)).not.toContain("user-1");
  });

  it("エラーコードがない場合は code: null を返す", async () => {
    mocks.deleteUser.mockResolvedValue({ error: { message: "x" } });
    await expect(deleteUserAsAdmin("user-1")).resolves.toEqual({
      error: { code: null },
    });
  });

  it("SUPABASE_SECRET_KEY が未設定 → 例外を投げず、エラーを返す（Admin APIは呼ばない）", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    const result = await deleteUserAsAdmin("user-1");
    expect(result).toEqual({ error: { code: "admin_client_error" } });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("NEXT_PUBLIC_SUPABASE_URL が未設定 → 例外を投げず、エラーを返す", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const result = await deleteUserAsAdmin("user-1");
    expect(result).toEqual({ error: { code: "admin_client_error" } });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("Admin API呼び出しが例外を投げても、例外を投げず、詳細を含まないエラーを返す", async () => {
    mocks.deleteUser.mockRejectedValue(new Error(`boom ${FAKE_SECRET}`));
    const result = await deleteUserAsAdmin("user-1");
    expect(result).toEqual({ error: { code: "admin_client_error" } });
    expect(JSON.stringify(result)).not.toContain(FAKE_SECRET);
  });
});
