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

export async function fetchOwnNotesWithStores(
  supabaseServer: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<NotesFetchResult> {
  const { data: noteRows, error: noteError } = await supabaseServer
    .from("store_visit_notes")
    .select("note_id, store_id, note_text, updated_at")
    .order("updated_at", { ascending: false });

  if (noteError) {
    logSupabaseError({
      route: "/notes",
      operation: "fetchOwnNotesWithStores.notes",
      table: "store_visit_notes",
      error: noteError,
    });
    return { status: "error" };
  }

  const notes = noteRows ?? [];
  if (notes.length === 0) {
    return { status: "success", notes: [] };
  }

  // stores.SELECTはanonロールにしか付与されていないため、authenticatedの
  // セッション付きクライアントでは直接storesを取得できない。公開・非公開を問わず
  // 本人のメモに紐づく店舗の最小限情報（store_id/store_name/is_published）だけを
  // 返すSECURITY DEFINER関数（get_own_note_store_names）を経由する。
  const storeIds = [...new Set(notes.map((note) => note.store_id))];

  const { data: storeRows, error: storeError } = await supabaseServer.rpc(
    "get_own_note_store_names",
    { p_store_ids: storeIds },
  );

  if (storeError) {
    logSupabaseError({
      route: "/notes",
      operation: "fetchOwnNotesWithStores.stores",
      table: "stores",
      error: storeError,
    });
    return { status: "error" };
  }

  const storeById = new Map<
    number,
    { storeName: string; isPublished: boolean }
  >();
  for (const row of storeRows ?? []) {
    storeById.set(row.store_id, {
      storeName: row.store_name,
      isPublished: row.is_published,
    });
  }

  return {
    status: "success",
    notes: notes.flatMap((note) => {
      const store = storeById.get(note.store_id);
      if (!store) {
        // 本人のメモである以上、get_own_note_store_namesは必ず対応する店舗を
        // 返すはずのため、通常到達しない防御的分岐。整合性が取れない場合は
        // 一覧から除外する（存在しない店舗名を表示しない）。
        return [];
      }
      return [
        {
          noteId: note.note_id,
          storeId: note.store_id,
          noteText: note.note_text,
          updatedAt: note.updated_at,
          storeName: store.storeName,
          isPublished: store.isPublished,
        },
      ];
    }),
  };
}
