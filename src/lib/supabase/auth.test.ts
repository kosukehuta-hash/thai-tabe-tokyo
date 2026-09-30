import { afterEach, describe, expect, it, vi } from "vitest";
// "server-only" はvitest.config.tsのresolve.aliasでスタブに差し替えているため、直接importできる。
import { getAuthenticatedUserId } from "./auth";

type Client = Parameters<typeof getAuthenticatedUserId>[0];

function fakeClient(result: {
  data: { claims: { sub?: string } } | null;
  error: { code?: string; message?: string } | null;
}): Client {
  return {
    auth: { getClaims: vi.fn().mockResolvedValue(result) },
  } as unknown as Client;
}

const context = { route: "/store/[storeId]", operation: "saveNote.getClaims" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getAuthenticatedUserId", () => {
  it("claimsのsubをuserIdとして返し、ログは出さない", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const userId = await getAuthenticatedUserId(
      fakeClient({ data: { claims: { sub: "user-1" } }, error: null }),
      context,
    );
    expect(userId).toBe("user-1");
    expect(spy).not.toHaveBeenCalled();
  });

  it("ログインしていない（claimsなし・エラーなし）場合は null を返し、ログは出さない", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const userId = await getAuthenticatedUserId(
      fakeClient({ data: null, error: null }),
      context,
    );
    expect(userId).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("subが空の場合は null を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const userId = await getAuthenticatedUserId(
      fakeClient({ data: { claims: { sub: "" } }, error: null }),
      context,
    );
    expect(userId).toBeNull();
  });

  it("getClaims()がエラーを返した場合は null を返し、認証エラーを1回だけログに記録する", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const userId = await getAuthenticatedUserId(
      fakeClient({
        data: null,
        error: { code: "bad_jwt", message: "invalid JWT" },
      }),
      context,
    );
    expect(userId).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(spy.mock.calls[0][0] as string)).toEqual({
      event: "supabase_auth_error",
      route: "/store/[storeId]",
      operation: "saveNote.getClaims",
      table: "auth",
      error_code: "bad_jwt",
      error_message: "invalid JWT",
    });
  });
});
