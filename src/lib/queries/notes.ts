import "server-only";

import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/logger";

export type NoteWithStore = {
  noteId: number;
  storeId: number;
  noteText: string;
  updatedAt: string;
  storeName: string;
  isPublished: boolean;
};

export type NotesFetchResult =
  { status: "error" } | { status: "success"; notes: NoteWithStore[] };

/**
 * ログイン中のユーザー本人のメモを、店舗の公開・非公開を問わず返す（U06用）。
 * authenticatedは stores を直接読めないため、DB関数 get_own_notes() を
 * 1回だけ呼び出す（メモ行と店舗情報の結合・更新日時の新しい順の並びはDB側）。
 * お気に入り（fetchOwnFavorites / get_own_favorites()）と同じ方式。
 */
export async function fetchOwnNotesWithStores(
  supabaseServer: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<NotesFetchResult> {
  const { data, error } = await supabaseServer.rpc("get_own_notes");

  if (error) {
    logSupabaseError({
      route: "/notes",
      operation: "fetchOwnNotesWithStores",
      table: "store_visit_notes",
      error,
    });
    return { status: "error" };
  }

  return {
    status: "success",
    notes: (data ?? []).map((row) => ({
      noteId: row.note_id,
      storeId: row.store_id,
      noteText: row.note_text,
      updatedAt: row.updated_at,
      storeName: row.store_name,
      isPublished: row.is_published,
    })),
  };
}
