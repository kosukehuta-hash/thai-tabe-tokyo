import { afterEach, describe, expect, it, vi } from "vitest";
// "server-only" はvitest.config.tsのresolve.aliasでスタブに差し替えているため、直接importできる。
import { fetchIsFavorite, fetchOwnFavorites } from "./favorites";

type Client = Parameters<typeof fetchIsFavorite>[0];

type QueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

afterEach(() => {
  vi.restoreAllMocks();
});

function loggedEvent(spy: ReturnType<typeof vi.spyOn>) {
  return JSON.parse(spy.mock.calls[0][0] as string);
}

describe("fetchIsFavorite", () => {
  function clientReturning(result: QueryResult) {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { client: { from } as unknown as Client, from, select, eq };
  }

  it("登録あり → isFavorite: true。store_idだけで検索する（user_idはRLSに任せる）", async () => {
    const { client, from, select, eq } = clientReturning({
      data: { favorite_id: 1 },
      error: null,
    });
    const result = await fetchIsFavorite(client, 5);
    expect(result).toEqual({ status: "success", isFavorite: true });
    expect(from).toHaveBeenCalledWith("store_favorites");
    expect(select).toHaveBeenCalledWith("favorite_id");
    expect(eq).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith("store_id", 5);
  });

  it("登録なし → isFavorite: false", async () => {
    const { client } = clientReturning({ data: null, error: null });
    const result = await fetchIsFavorite(client, 5);
    expect(result).toEqual({ status: "success", isFavorite: false });
  });

  it("取得エラー → status: error（false扱いにせず、ログを1回記録する）", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = clientReturning({
      data: null,
      error: { code: "XX000", message: "boom" },
    });
    const result = await fetchIsFavorite(client, 5);
    expect(result).toEqual({ status: "error" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(loggedEvent(spy)).toMatchObject({
      event: "supabase_query_error",
      route: "/store/[storeId]",
      operation: "fetchIsFavorite",
      table: "store_favorites",
      error_code: "XX000",
      store_id: 5,
    });
  });
});

describe("fetchOwnFavorites", () => {
  function clientWithRpc(result: QueryResult) {
    const rpc = vi.fn().mockResolvedValue(result);
    return { client: { rpc } as unknown as Client, rpc };
  }

  it("RPC成功 → get_own_favorites() を1回だけ呼び、返却順のまま返す（再ソートしない）", async () => {
    const rows = [
      { store_id: 2, store_name: "B", is_published: true, created_at: "1" },
      { store_id: 9, store_name: "A", is_published: false, created_at: "2" },
      { store_id: 1, store_name: "C", is_published: true, created_at: "0" },
    ];
    const { client, rpc } = clientWithRpc({ data: rows, error: null });
    const result = await fetchOwnFavorites(client);
    expect(result).toEqual({ status: "success", favorites: rows });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_own_favorites");
  });

  it("0件 → 空の配列", async () => {
    const { client } = clientWithRpc({ data: [], error: null });
    expect(await fetchOwnFavorites(client)).toEqual({
      status: "success",
      favorites: [],
    });
  });

  it("RPC失敗 → status: error（ログを1回記録する）", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = clientWithRpc({
      data: null,
      error: { code: "42501", message: "denied" },
    });
    const result = await fetchOwnFavorites(client);
    expect(result).toEqual({ status: "error" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(loggedEvent(spy)).toMatchObject({
      event: "supabase_query_error",
      route: "/favorites",
      operation: "fetchOwnFavorites",
      table: "store_favorites",
      error_code: "42501",
    });
  });
});
