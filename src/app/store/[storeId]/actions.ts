"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { parseStoreIdFromForm } from "@/lib/form-values";
import {
  AUTH_ERROR_MESSAGE,
  INVALID_STORE_ERROR_MESSAGE,
} from "@/lib/action-messages";
import { logSupabaseError } from "@/lib/logger";
import {
  NOTE_MAX_LENGTH,
  TOO_LONG_NOTE_ERROR_MESSAGE,
} from "@/lib/note-limits";

export type SaveNoteState = {
  error: string | null;
  noteText: string | null;
};

export type DeleteNoteState = {
  error: string | null;
  deleted: boolean;
};

const SAVE_ERROR_MESSAGE =
  "メモを保存できませんでした。時間をおいてもう一度お試しください。";
const DELETE_ERROR_MESSAGE =
  "メモを削除できませんでした。時間をおいてもう一度お試しください。";
const EMPTY_NOTE_ERROR_MESSAGE = "メモを入力してください。";

export async function saveNote(
  _prevState: SaveNoteState,
  formData: FormData,
): Promise<SaveNoteState> {
  const storeId = parseStoreIdFromForm(formData.get("storeId"));
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

  const userId = await getAuthenticatedUserId(supabase, {
    route: "/store/[storeId]",
    operation: "saveNote.getClaims",
  });
  if (userId === null) {
    return { error: AUTH_ERROR_MESSAGE, noteText: null };
  }

  const { error } = await supabase
    .from("store_visit_notes")
    .upsert(
      { user_id: userId, store_id: storeId, note_text: noteText },
      { onConflict: "user_id,store_id" },
    );
  if (error) {
    logSupabaseError({
      route: "/store/[storeId]",
      operation: "saveNote.upsert",
      table: "store_visit_notes",
      error,
      context: { store_id: storeId },
    });
    return { error: SAVE_ERROR_MESSAGE, noteText: null };
  }

  revalidatePath(`/store/${storeId}`);
  return { error: null, noteText };
}

export async function deleteNote(
  _prevState: DeleteNoteState,
  formData: FormData,
): Promise<DeleteNoteState> {
  const storeId = parseStoreIdFromForm(formData.get("storeId"));
  if (storeId === null) {
    return { error: INVALID_STORE_ERROR_MESSAGE, deleted: false };
  }

  const supabase = await createClient();

  const userId = await getAuthenticatedUserId(supabase, {
    route: "/store/[storeId]",
    operation: "deleteNote.getClaims",
  });
  if (userId === null) {
    return { error: AUTH_ERROR_MESSAGE, deleted: false };
  }

  const { error } = await supabase
    .from("store_visit_notes")
    .delete()
    .eq("user_id", userId)
    .eq("store_id", storeId);
  if (error) {
    logSupabaseError({
      route: "/store/[storeId]",
      operation: "deleteNote.delete",
      table: "store_visit_notes",
      error,
      context: { store_id: storeId },
    });
    return { error: DELETE_ERROR_MESSAGE, deleted: false };
  }

  revalidatePath(`/store/${storeId}`);
  return { error: null, deleted: true };
}
