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

import { saveNote } from "./actions";
import {
  NOTE_MAX_LENGTH,
  TOO_LONG_NOTE_ERROR_MESSAGE,
} from "@/lib/note-limits";

/**
 * メモ保存（saveNote）の入力チェック。DB・クラウドSupabaseには接続せず、Supabaseクライアントはモックで差し替える。
 * 対応仕様: 要件仕様書 Ver2 08_U03店舗詳細（メモの文字数：空白のみは不可、前後の空白を除いて1〜500文字）
 */

const EMPTY_NOTE_MESSAGE = "メモを入力してください。";
const AUTH_MESSAGE =
  "ログイン状態を確認できませんでした。再度ログインしてください。";
const INVALID_STORE_MESSAGE = "店舗情報を確認できませんでした。";
const SAVE_ERROR_MESSAGE =
  "メモを保存できませんでした。時間をおいてもう一度お試しください。";

const initialState = { error: null, noteText: null };

function formWith(storeId: string | null, noteText?: string): FormData {
  const formData = new FormData();
  if (storeId !== null) {
    formData.set("storeId", storeId);
  }
  if (noteText !== undefined) {
    formData.set("noteText", noteText);
  }
  return formData;
}

function supabaseUpsertResult(
  error: { code?: string; message?: string } | null = null,
) {
  const upsert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn(() => ({ upsert }));
  createClient.mockResolvedValue({ from });
  return { from, upsert };
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

describe("saveNote の文字数チェック（上限は NOTE_MAX_LENGTH）", () => {
  it("1文字 → 保存できる", async () => {
    const { from, upsert } = supabaseUpsertResult();
    const result = await saveNote(initialState, formWith("7", "あ"));
    expect(result).toEqual({ error: null, noteText: "あ" });
    expect(from).toHaveBeenCalledWith("store_visit_notes");
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", store_id: 7, note_text: "あ" },
      { onConflict: "user_id,store_id" },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/store/7");
  });

  it("ちょうど上限の文字数（500文字）→ 保存できる", async () => {
    const { upsert } = supabaseUpsertResult();
    const text = "あ".repeat(NOTE_MAX_LENGTH);
    expect(text).toHaveLength(500);
    const result = await saveNote(initialState, formWith("7", text));
    expect(result).toEqual({ error: null, noteText: text });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("上限を1文字超える（501文字）→ 拒否。共通のエラーメッセージを返し、保存処理は呼ばない", async () => {
    const { upsert } = supabaseUpsertResult();
    const text = "あ".repeat(NOTE_MAX_LENGTH + 1);
    expect(text).toHaveLength(501);
    const result = await saveNote(initialState, formWith("7", text));
    expect(result).toEqual({
      error: TOO_LONG_NOTE_ERROR_MESSAGE,
      noteText: null,
    });
    expect(result.error).toBe(
      `メモは${NOTE_MAX_LENGTH}文字以内で入力してください。`,
    );
    expect(createClient).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("前後の空白は数えない（空白を含めて501文字でも、前後の空白を除いて500文字なら保存できる）", async () => {
    const { upsert } = supabaseUpsertResult();
    const text = "あ".repeat(NOTE_MAX_LENGTH);
    const result = await saveNote(initialState, formWith("7", ` ${text} `));
    expect(result).toEqual({ error: null, noteText: text });
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", store_id: 7, note_text: text },
      { onConflict: "user_id,store_id" },
    );
  });

  it("前後の空白を除いて501文字 → 拒否", async () => {
    const { upsert } = supabaseUpsertResult();
    const text = "あ".repeat(NOTE_MAX_LENGTH + 1);
    const result = await saveNote(initialState, formWith("7", ` ${text} `));
    expect(result.error).toBe(TOO_LONG_NOTE_ERROR_MESSAGE);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("saveNote のその他の入力チェック（共通化の前後で変わらない）", () => {
  it.each([
    ["空文字", ""],
    ["半角空白だけ", "   "],
    ["全角空白だけ", "　　"],
    ["改行・タブだけ", "\n\t"],
  ])("空白のみ（%s）→ 『メモを入力してください。』", async (_label, text) => {
    const { upsert } = supabaseUpsertResult();
    const result = await saveNote(initialState, formWith("7", text));
    expect(result).toEqual({ error: EMPTY_NOTE_MESSAGE, noteText: null });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("メモの値が文字列でない（未指定）→ 『メモを入力してください。』", async () => {
    supabaseUpsertResult();
    const result = await saveNote(initialState, formWith("7"));
    expect(result).toEqual({ error: EMPTY_NOTE_MESSAGE, noteText: null });
  });

  it("店舗IDが不正 → 店舗情報の確認エラー", async () => {
    supabaseUpsertResult();
    const result = await saveNote(initialState, formWith("abc", "メモ"));
    expect(result).toEqual({ error: INVALID_STORE_MESSAGE, noteText: null });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("未ログイン → ログイン状態の確認エラー。保存しない", async () => {
    const { upsert } = supabaseUpsertResult();
    getAuthenticatedUserId.mockResolvedValue(null);
    const result = await saveNote(initialState, formWith("7", "メモ"));
    expect(result).toEqual({ error: AUTH_MESSAGE, noteText: null });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("保存に失敗 → 保存失敗のメッセージ。異常ログを出し、画面の再取得はしない", async () => {
    supabaseUpsertResult({ code: "XX000", message: "boom" });
    const result = await saveNote(initialState, formWith("7", "メモ"));
    expect(result).toEqual({ error: SAVE_ERROR_MESSAGE, noteText: null });
    expect(consoleError).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
