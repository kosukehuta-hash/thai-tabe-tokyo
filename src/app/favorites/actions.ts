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

// isFavorite: 処理後（失敗時は処理前）のお気に入り状態。UIはこの値でボタン表示を決める。
export type FavoriteActionState = {
  isFavorite: boolean;
  error: string | null;
};

// U03（/store/[storeId]）とU07（/favorites）の両方から呼ばれる
const ROUTE = "/store/[storeId], /favorites";

// DBの登録制限トリガー（公開中でない店舗・存在しない店舗の新規登録を拒否）が返すSQLSTATE
const NOT_AVAILABLE_ERROR_CODE = "TF001";
// UNIQUE(user_id, store_id) 違反（登録済み）
const UNIQUE_VIOLATION_ERROR_CODE = "23505";

const NOT_AVAILABLE_MESSAGE = "この店舗は現在お気に入りに登録できません。";
const ADD_ERROR_MESSAGE =
  "お気に入りを登録できませんでした。時間をおいてもう一度お試しください。";
const REMOVE_ERROR_MESSAGE =
  "お気に入りを解除できませんでした。時間をおいてもう一度お試しください。";

function revalidateFavoritePages(storeId: number): void {
  // U03はその店舗のページだけ、U07はお気に入り一覧だけを再取得する
  revalidatePath(`/store/${storeId}`);
  revalidatePath("/favorites");
}

/**
 * お気に入りに登録する。公開状態はここでは判定せず、DBのBEFORE INSERTトリガー
 * （store_favorites_check_store_published）を最終判定とする。
 */
export async function addFavorite(
  _prevState: FavoriteActionState,
  formData: FormData,
): Promise<FavoriteActionState> {
  // 登録前の状態は「未登録」なので、失敗時はisFavorite: falseを返す
  const storeId = parseStoreIdFromForm(formData.get("storeId"));
  if (storeId === null) {
    return { isFavorite: false, error: INVALID_STORE_ERROR_MESSAGE };
  }

  const supabase = await createClient();

  const userId = await getAuthenticatedUserId(supabase, {
    route: ROUTE,
    operation: "addFavorite.getClaims",
  });
  if (userId === null) {
    return { isFavorite: false, error: AUTH_ERROR_MESSAGE };
  }

  const { error } = await supabase
    .from("store_favorites")
    .insert({ user_id: userId, store_id: storeId });

  // 23505（登録済み）は新しい行が作られておらず、結果として「登録済み」なので成功扱い
  if (error && error.code !== UNIQUE_VIOLATION_ERROR_CODE) {
    if (error.code === NOT_AVAILABLE_ERROR_CODE) {
      // 想定された業務上の拒否のため、異常ログは出さない
      return { isFavorite: false, error: NOT_AVAILABLE_MESSAGE };
    }
    logSupabaseError({
      route: ROUTE,
      operation: "addFavorite.insert",
      table: "store_favorites",
      error,
      context: { store_id: storeId },
    });
    return { isFavorite: false, error: ADD_ERROR_MESSAGE };
  }

  revalidateFavoritePages(storeId);
  return { isFavorite: true, error: null };
}

/**
 * お気に入りを解除する。削除対象の行がなくても（別画面で解除済みなど）成功扱い。
 */
export async function removeFavorite(
  _prevState: FavoriteActionState,
  formData: FormData,
): Promise<FavoriteActionState> {
  // 解除前の状態は「登録済み」なので、失敗時はisFavorite: trueを返して処理前の表示を維持する
  const storeId = parseStoreIdFromForm(formData.get("storeId"));
  if (storeId === null) {
    return { isFavorite: true, error: INVALID_STORE_ERROR_MESSAGE };
  }

  const supabase = await createClient();

  const userId = await getAuthenticatedUserId(supabase, {
    route: ROUTE,
    operation: "removeFavorite.getClaims",
  });
  if (userId === null) {
    return { isFavorite: true, error: AUTH_ERROR_MESSAGE };
  }

  const { error } = await supabase
    .from("store_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("store_id", storeId);
  if (error) {
    logSupabaseError({
      route: ROUTE,
      operation: "removeFavorite.delete",
      table: "store_favorites",
      error,
      context: { store_id: storeId },
    });
    return { isFavorite: true, error: REMOVE_ERROR_MESSAGE };
  }

  revalidateFavoritePages(storeId);
  return { isFavorite: false, error: null };
}
