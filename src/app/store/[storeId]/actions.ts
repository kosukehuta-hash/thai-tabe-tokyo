"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveNoteState = {
  error: string | null;
  noteText: string | null;
};

export type DeleteNoteState = {
  error: string | null;
  deleted: boolean;
};

const NOTE_MAX_LENGTH = 500;
const AUTH_ERROR_MESSAGE =
  "ログイン状態を確認できませんでした。再度ログインしてください。";
const SAVE_ERROR_MESSAGE =
  "メモを保存できませんでした。時間をおいてもう一度お試しください。";
const DELETE_ERROR_MESSAGE =
  "メモを削除できませんでした。時間をおいてもう一度お試しください。";
const EMPTY_NOTE_ERROR_MESSAGE = "メモを入力してください。";
const TOO_LONG_NOTE_ERROR_MESSAGE = `メモは${NOTE_MAX_LENGTH}文字以内で入力してください。`;
const INVALID_STORE_ERROR_MESSAGE = "店舗情報を確認できませんでした。";

function parseStoreId(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null;
  }
  if (!/^[1-9][0-9]*$/.test(value)) {
    return null;
  }
  return Number(value);
}

export async function saveNote(
  _prevState: SaveNoteState,
  formData: FormData,
): Promise<SaveNoteState> {
  const storeId = parseStoreId(formData.get("storeId"));
  if (storeId === null) {
    return { error: INVALID_STORE_ERROR_MESSAGE, noteText: null };
  }

  const rawNoteText = formData.get("noteText");
  if (typeof rawNoteText !== "string") {
    return { error: EMPTY_NOTE_ERROR_MESSAGE, noteText: null };
  }

  const noteText = rawNoteText.trim();
  if (noteText.length === 0) {
    return { error: EMPTY_NOTE_ERROR_MESSAGE, noteText: null };
  }
  if (noteText.length > NOTE_MAX_LENGTH) {
    return { error: TOO_LONG_NOTE_ERROR_MESSAGE, noteText: null };
  }

  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (claimsError || !userId) {
    return { error: AUTH_ERROR_MESSAGE, noteText: null };
  }

  const { error } = await supabase
    .from("store_visit_notes")
    .upsert(
      { user_id: userId, store_id: storeId, note_text: noteText },
      { onConflict: "user_id,store_id" },
    );
  if (error) {
    return { error: SAVE_ERROR_MESSAGE, noteText: null };
  }

  revalidatePath(`/store/${storeId}`);
  return { error: null, noteText };
}

export async function deleteNote(
  _prevState: DeleteNoteState,
  formData: FormData,
): Promise<DeleteNoteState> {
  const storeId = parseStoreId(formData.get("storeId"));
  if (storeId === null) {
    return { error: INVALID_STORE_ERROR_MESSAGE, deleted: false };
  }

  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (claimsError || !userId) {
    return { error: AUTH_ERROR_MESSAGE, deleted: false };
  }

  const { error } = await supabase
    .from("store_visit_notes")
    .delete()
    .eq("user_id", userId)
    .eq("store_id", storeId);
  if (error) {
    return { error: DELETE_ERROR_MESSAGE, deleted: false };
  }

  revalidatePath(`/store/${storeId}`);
  return { error: null, deleted: true };
}
