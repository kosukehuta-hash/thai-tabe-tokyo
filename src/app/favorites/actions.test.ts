import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath, createClient, getAuthenticatedUserId } = vi.hoisted(
  () => ({
    revalidatePath: vi.fn(),
    createClient: vi.fn(),
    getAuthenticatedUserId: vi.fn(),
  }),
);

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/auth", () => ({ getAuthenticatedUserId }));

import { addFavorite, removeFavorite } from "./actions";

const AUTH_MESSAGE =
  "ログイン状態を確認できませんでした。再度ログインしてください。";
const INVALID_STORE_MESSAGE = "店舗情報を確認できませんでした。";
const NOT_AVAILABLE_MESSAGE = "この店舗は現在お気に入りに登録できません。";
const ADD_ERROR_MESSAGE =
  "お気に入りを登録できませんでした。時間をおいてもう一度お試しください。";
const REMOVE_ERROR_MESSAGE =
  "お気に入りを解除できませんでした。時間をおいてもう一度お試しください。";

const initialState = { isFavorite: false, error: null };

function formWith(storeId: string | null): FormData {
  const formData = new FormData();
  if (storeId !== null) {
    formData.set("storeId", storeId);
  }
  return formData;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  getAuthenticatedUserId.mockResolvedValue("user-1");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("addFavorite", () => {
  function supabaseInsertResult(
    error: { code?: string; message?: string } | null,
  ) {
    const insert = vi.fn().mockResolvedValue({ error });
    const from = vi.fn(() => ({ insert }));
    createClient.mockResolvedValue({ from });
    return { from, insert };
  }

  it("成功 → isFavorite: true。認証済みuser_idとフォームのstore_idで登録し、U03・U07を再取得する", async () => {
    const { from, insert } = supabaseInsertResult(null);
    const result = await addFavorite(initialState, formWith("7"));
    expect(result).toEqual({ isFavorite: true, error: null });
    expect(from).toHaveBeenCalledWith("store_favorites");
    expect(insert).toHaveBeenCalledWith({ user_id: "user-1", store_id: 7 });
    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith("/store/7");
    expect(revalidatePath).toHaveBeenCalledWith("/favorites");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("TF001（公開中でない店舗・存在しない店舗）→ 専用メッセージ。異常ログは出さず、再取得もしない", async () => {
    supabaseInsertResult({
      code: "TF001",
      message: "store is not available for favorites",
    });
    const result = await addFavorite(initialState, formWith("7"));
    expect(result).toEqual({ isFavorite: false, error: NOT_AVAILABLE_MESSAGE });
    expect(consoleError).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("23505（登録済み）→ エラーにせず、登録済みとして成功扱い。ログは出さない", async () => {
    supabaseInsertResult({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });
    const result = await addFavorite(initialState, formWith("7"));
    expect(result).toEqual({ isFavorite: true, error: null });
    expect(consoleError).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/store/7");
    expect(revalidatePath).toHaveBeenCalledWith("/favorites");
  });

  it("その他のエラー → 汎用メッセージ。ログを1回記録し、再取得しない", async () => {
    supabaseInsertResult({ code: "08006", message: "connection failure" });
    const result = await addFavorite(initialState, formWith("7"));
    expect(result).toEqual({ isFavorite: false, error: ADD_ERROR_MESSAGE });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(JSON.parse(consoleError.mock.calls[0][0] as string)).toMatchObject({
      event: "supabase_query_error",
      operation: "addFavorite.insert",
      table: "store_favorites",
      error_code: "08006",
      store_id: 7,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("未ログイン → メモと同じ文言。DBには触れない", async () => {
    getAuthenticatedUserId.mockResolvedValue(null);
    const { from } = supabaseInsertResult(null);
    const result = await addFavorite(initialState, formWith("7"));
    expect(result).toEqual({ isFavorite: false, error: AUTH_MESSAGE });
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([null, "", "abc", "0", "-3", "1.5"])(
    "storeIdが不正（%j）→ メモと同じ文言。認証・DBには触れない",
    async (value) => {
      const { from } = supabaseInsertResult(null);
      const result = await addFavorite(initialState, formWith(value));
      expect(result).toEqual({
        isFavorite: false,
        error: INVALID_STORE_MESSAGE,
      });
      expect(createClient).not.toHaveBeenCalled();
      expect(getAuthenticatedUserId).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
    },
  );
});

describe("removeFavorite", () => {
  function supabaseDeleteResult(
    error: { code?: string; message?: string } | null,
  ) {
    const secondEq = vi.fn().mockResolvedValue({ error });
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const del = vi.fn(() => ({ eq: firstEq }));
    const from = vi.fn(() => ({ delete: del }));
    createClient.mockResolvedValue({ from });
    return { from, del, firstEq, secondEq };
  }

  it("成功 → isFavorite: false。user_idとstore_idの両方を条件に削除し、U03・U07を再取得する", async () => {
    const { from, firstEq, secondEq } = supabaseDeleteResult(null);
    const result = await removeFavorite(
      { isFavorite: true, error: null },
      formWith("7"),
    );
    expect(result).toEqual({ isFavorite: false, error: null });
    expect(from).toHaveBeenCalledWith("store_favorites");
    expect(firstEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(secondEq).toHaveBeenCalledWith("store_id", 7);
    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith("/store/7");
    expect(revalidatePath).toHaveBeenCalledWith("/favorites");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("削除対象が0件でもエラーにならない → 成功扱い（DBの応答はerrorなし）", async () => {
    // 0件削除でもPostgRESTは error: null を返す。ここでは件数を見ずに成功扱いにすることを確認する
    supabaseDeleteResult(null);
    const result = await removeFavorite(
      { isFavorite: true, error: null },
      formWith("999"),
    );
    expect(result).toEqual({ isFavorite: false, error: null });
    expect(revalidatePath).toHaveBeenCalledWith("/store/999");
  });

  it("その他のエラー → 解除失敗メッセージ。処理前の表示（isFavorite: true）を維持し、ログを1回記録する", async () => {
    supabaseDeleteResult({ code: "08006", message: "connection failure" });
    const result = await removeFavorite(
      { isFavorite: true, error: null },
      formWith("7"),
    );
    expect(result).toEqual({ isFavorite: true, error: REMOVE_ERROR_MESSAGE });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(JSON.parse(consoleError.mock.calls[0][0] as string)).toMatchObject({
      event: "supabase_query_error",
      operation: "removeFavorite.delete",
      table: "store_favorites",
      error_code: "08006",
      store_id: 7,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("未ログイン → メモと同じ文言。処理前の表示（isFavorite: true）を維持し、DBには触れない", async () => {
    getAuthenticatedUserId.mockResolvedValue(null);
    const { from } = supabaseDeleteResult(null);
    const result = await removeFavorite(
      { isFavorite: true, error: null },
      formWith("7"),
    );
    expect(result).toEqual({ isFavorite: true, error: AUTH_MESSAGE });
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([null, "", "abc", "0", "-3", "1.5"])(
    "storeIdが不正（%j）→ メモと同じ文言。処理前の表示を維持し、認証・DBには触れない",
    async (value) => {
      const { from } = supabaseDeleteResult(null);
      const result = await removeFavorite(
        { isFavorite: true, error: null },
        formWith(value),
      );
      expect(result).toEqual({
        isFavorite: true,
        error: INVALID_STORE_MESSAGE,
      });
      expect(createClient).not.toHaveBeenCalled();
      expect(getAuthenticatedUserId).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
    },
  );
});
