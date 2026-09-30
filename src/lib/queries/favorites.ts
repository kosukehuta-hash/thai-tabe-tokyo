import "server-only";

import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/logger";
import type { Database } from "@/types/database.types";

// get_own_favorites() が返す4項目（store_id / store_name / is_published / created_at）を
// そのまま扱う。並び順（created_at 降順）はDB関数の責任で、アプリ側では並べ替えない。
export type FavoriteStore =
  Database["public"]["Functions"]["get_own_favorites"]["Returns"][number];

export type IsFavoriteFetchResult =
  { status: "error" } | { status: "success"; isFavorite: boolean };

/**
 * ログイン中のユーザーが、対象店舗をお気に入り登録済みかを返す（U03用）。
 * RLSにより本人の行だけが見えるため、user_idでの絞り込みはしない。
 * 1ユーザー・1店舗につき1件（UNIQUE）なので、該当行は高々1件。
 */
export async function fetchIsFavorite(
  supabaseServer: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  storeId: number,
): Promise<IsFavoriteFetchResult> {
  const { data, error } = await supabaseServer
    .from("store_favorites")
    .select("favorite_id")
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) {
    logSupabaseError({
      route: "/store/[storeId]",
      operation: "fetchIsFavorite",
      table: "store_favorites",
      error,
      context: { store_id: storeId },
    });
    return { status: "error" };
  }
  return { status: "success", isFavorite: data !== null };
}

export type OwnFavoritesFetchResult =
  { status: "error" } | { status: "success"; favorites: FavoriteStore[] };

/**
 * ログイン中のユーザー本人のお気に入りの店舗を、公開・非公開を問わず返す（U07用）。
 * authenticatedは stores を直接読めないため、DB関数 get_own_favorites() を
 * 1回だけ呼び出す（お気に入り行と店舗情報の結合・並び順はDB側）。
 */
export async function fetchOwnFavorites(
  supabaseServer: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<OwnFavoritesFetchResult> {
  const { data, error } = await supabaseServer.rpc("get_own_favorites");

  if (error) {
    logSupabaseError({
      route: "/favorites",
      operation: "fetchOwnFavorites",
      table: "store_favorites",
      error,
    });
    return { status: "error" };
  }
  return { status: "success", favorites: data ?? [] };
}
