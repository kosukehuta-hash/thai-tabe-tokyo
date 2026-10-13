import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 統合テスト用ヘルパー（local-supabase.ts）の安全策の検証。
 * ローカルSupabase・Dockerが無くても実行できる（接続先は、必ず繋がらないポートに差し替える）。
 *
 * - 通常時: 使えなければ false（= 従来どおりテストをskip）
 * - REQUIRE_LOCAL_SUPABASE=1（CI）: 使えなければskipせずエラー
 * - 接続先がローカルでない場合は、どちらのモードでも使わない（管理者権限でのクラウド誤接続の防止）
 */

// ポート1は通常どこも待ち受けていないため、接続はすぐ拒否される
const UNREACHABLE_LOCAL_URL = "http://127.0.0.1:1";

async function loadHelper() {
  vi.resetModules();
  return import("./local-supabase");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isLoopbackUrl", () => {
  it.each([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "http://[::1]:54321",
  ])("ローカルのURLは true: %s", async (url) => {
    const { isLoopbackUrl } = await loadHelper();
    expect(isLoopbackUrl(url)).toBe(true);
  });

  it.each([
    "https://example.supabase.co",
    "http://127.0.0.1.example.com",
    "http://localhost.example.com",
    "http://192.168.0.10:54321",
    "not a url",
    "",
  ])("ローカル以外・不正なURLは false: %s", async (url) => {
    const { isLoopbackUrl } = await loadHelper();
    expect(isLoopbackUrl(url)).toBe(false);
  });
});

describe("isLocalSupabaseAvailable", () => {
  it("通常時: ローカルSupabaseに繋がらなければ false（従来どおりskipできる）", async () => {
    vi.stubEnv("REQUIRE_LOCAL_SUPABASE", "");
    vi.stubEnv("TEST_LOCAL_SUPABASE_URL", UNREACHABLE_LOCAL_URL);
    const { isLocalSupabaseAvailable } = await loadHelper();
    await expect(isLocalSupabaseAvailable()).resolves.toBe(false);
  });

  it("通常時: 接続先がローカルでなければ、接続を試みず false", async () => {
    vi.stubEnv("REQUIRE_LOCAL_SUPABASE", "");
    vi.stubEnv("TEST_LOCAL_SUPABASE_URL", "https://example.supabase.co");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { isLocalSupabaseAvailable } = await loadHelper();
    await expect(isLocalSupabaseAvailable()).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("必須モード: 接続先がローカルでなければ、skipせずエラー（接続も試みない）", async () => {
    vi.stubEnv("REQUIRE_LOCAL_SUPABASE", "1");
    vi.stubEnv("TEST_LOCAL_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("TEST_LOCAL_SUPABASE_ANON_KEY", "dummy");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { isLocalSupabaseAvailable } = await loadHelper();
    await expect(isLocalSupabaseAvailable()).rejects.toThrow(
      /ローカル（127\.0\.0\.1 \/ localhost）ではありません/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("必須モード: anonキーが未設定なら、skipせずエラー", async () => {
    vi.stubEnv("REQUIRE_LOCAL_SUPABASE", "1");
    vi.stubEnv("TEST_LOCAL_SUPABASE_URL", UNREACHABLE_LOCAL_URL);
    vi.stubEnv("TEST_LOCAL_SUPABASE_ANON_KEY", "");
    const { isLocalSupabaseAvailable } = await loadHelper();
    await expect(isLocalSupabaseAvailable()).rejects.toThrow(
      /TEST_LOCAL_SUPABASE_ANON_KEY/,
    );
  });

  it("必須モード: ローカルSupabaseに繋がらなければ、falseではなくエラー（skipさせない）", async () => {
    vi.stubEnv("REQUIRE_LOCAL_SUPABASE", "1");
    vi.stubEnv("TEST_LOCAL_SUPABASE_URL", UNREACHABLE_LOCAL_URL);
    vi.stubEnv("TEST_LOCAL_SUPABASE_ANON_KEY", "dummy");
    const { isLocalSupabaseAvailable } = await loadHelper();
    await expect(isLocalSupabaseAvailable()).rejects.toThrow(
      /REQUIRE_LOCAL_SUPABASE=1/,
    );
  });
});

describe("getLocalAdminKey", () => {
  it("設定されていれば、その値を返す", async () => {
    vi.stubEnv("TEST_LOCAL_ADMIN_KEY", "dummy-admin-key");
    const { getLocalAdminKey } = await loadHelper();
    expect(getLocalAdminKey()).toBe("dummy-admin-key");
  });

  it("通常時: 未設定なら undefined（従来どおりskipできる）", async () => {
    vi.stubEnv("REQUIRE_LOCAL_SUPABASE", "");
    vi.stubEnv("TEST_LOCAL_ADMIN_KEY", "");
    const { getLocalAdminKey } = await loadHelper();
    expect(getLocalAdminKey()).toBeUndefined();
  });

  it("必須モード: 未設定なら、skipせずエラー", async () => {
    vi.stubEnv("REQUIRE_LOCAL_SUPABASE", "1");
    vi.stubEnv("TEST_LOCAL_ADMIN_KEY", "");
    const { getLocalAdminKey } = await loadHelper();
    expect(() => getLocalAdminKey()).toThrow(/TEST_LOCAL_ADMIN_KEY/);
  });
});
