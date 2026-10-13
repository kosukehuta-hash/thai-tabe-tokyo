import { afterEach, describe, expect, it, vi } from "vitest";
// "server-only" はvitest.config.tsのresolve.aliasでスタブに差し替えているため、直接importできる。
import { fetchOwnNotesWithStores } from "./notes";

type Client = Parameters<typeof fetchOwnNotesWithStores>[0];

type QueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

afterEach(() => {
  vi.restoreAllMocks();
});

function clientWithRpc(result: QueryResult) {
  const rpc = vi.fn().mockResolvedValue(result);
  const from = vi.fn();
  return { client: { rpc, from } as unknown as Client, rpc, from };
}

describe("fetchOwnNotesWithStores", () => {
  it("DB関数 get_own_notes() を引数なしで1回だけ呼び、テーブルは直接読まない", async () => {
    const { client, rpc, from } = clientWithRpc({ data: [], error: null });
    await fetchOwnNotesWithStores(client);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_own_notes");
    expect(from).not.toHaveBeenCalled();
  });

  it("DB関数の戻り値を、画面用の項目名（キャメルケース）へ変換し、並び順はDB関数のままにする", async () => {
    const { client } = clientWithRpc({
      data: [
        {
          note_id: 12,
          store_id: 3,
          note_text: "新しいメモ",
          updated_at: "2026-10-03T14:30:00+00:00",
          store_name: "店B",
          is_published: false,
        },
        {
          note_id: 7,
          store_id: 1,
          note_text: "古いメモ",
          updated_at: "2026-10-01T01:00:00+00:00",
          store_name: "店A",
          is_published: true,
        },
      ],
      error: null,
    });
    const result = await fetchOwnNotesWithStores(client);
    expect(result).toEqual({
      status: "success",
      notes: [
        {
          noteId: 12,
          storeId: 3,
          noteText: "新しいメモ",
          updatedAt: "2026-10-03T14:30:00+00:00",
          storeName: "店B",
          isPublished: false,
        },
        {
          noteId: 7,
          storeId: 1,
          noteText: "古いメモ",
          updatedAt: "2026-10-01T01:00:00+00:00",
          storeName: "店A",
          isPublished: true,
        },
      ],
    });
  });

  it("メモが0件 → status: success で notes は空（取得失敗とは区別する）", async () => {
    const { client } = clientWithRpc({ data: [], error: null });
    expect(await fetchOwnNotesWithStores(client)).toEqual({
      status: "success",
      notes: [],
    });
  });

  it("dataがnull（エラーなし）→ 空の一覧として扱う", async () => {
    const { client } = clientWithRpc({ data: null, error: null });
    expect(await fetchOwnNotesWithStores(client)).toEqual({
      status: "success",
      notes: [],
    });
  });

  it("取得エラー → status: error（0件扱いにせず、ログを1回記録する）", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = clientWithRpc({
      data: null,
      error: { code: "XX000", message: "boom" },
    });
    const result = await fetchOwnNotesWithStores(client);
    expect(result).toEqual({ status: "error" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(spy.mock.calls[0][0] as string)).toMatchObject({
      event: "supabase_query_error",
      route: "/notes",
      operation: "fetchOwnNotesWithStores",
      table: "store_visit_notes",
      error_code: "XX000",
    });
  });
});
