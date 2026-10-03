"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { deleteUserAsAdmin } from "@/lib/supabase/admin";
import {
  AUTH_ERROR_MESSAGE,
  DELETE_ACCOUNT_ERROR_MESSAGE,
} from "@/lib/action-messages";
import { logSupabaseError } from "@/lib/logger";

export type DeleteAccountState = {
  error: string | null;
};

const ROUTE = "/account/delete";

// 削除成功後に遷移するURL。『退会しました』はU01が、ログアウト状態のときだけ表示する
const AFTER_DELETE_PATH = "/?withdrawn=1";

/**
 * ログイン中の本人のアカウントを削除する（U08）。
 *
 * - 削除対象は、ログイン中ユーザーの検証済みJWTから取得した本人のIDだけ。
 *   フォーム値・URLパラメータからユーザーIDは受け取らない（この関数はFormDataを読まない）
 * - auth.admin.deleteUser() が成功した時点で退会処理は成功扱いとする。
 *   メモ・お気に入りは ON DELETE CASCADE で削除される。
 *   その後のセッション破棄（signOut）が失敗しても、削除を失敗扱いに戻さずU01へ遷移する
 * - 失敗時は画面用の一般的なメッセージだけを返す。
 *   秘密キー・ユーザー情報・内部エラーの詳細は、画面にもログにも出さない
 */
export async function deleteAccount(
  _prevState: DeleteAccountState,
): Promise<DeleteAccountState> {
  // useActionStateの規約上、直前stateの引数は必要だが本処理では使用しない
  void _prevState;

  const supabase = await createClient();

  const userId = await getAuthenticatedUserId(supabase, {
    route: ROUTE,
    operation: "deleteAccount.getClaims",
  });
  if (userId === null) {
    // 未ログイン（またはセッション切れ）では削除処理を実行しない
    return { error: AUTH_ERROR_MESSAGE };
  }

  const { error } = await deleteUserAsAdmin(userId);
  if (error) {
    // 詳細メッセージ・ユーザーIDは含めず、エラーコードだけを記録する
    logSupabaseError({
      event: "supabase_auth_error",
      route: ROUTE,
      operation: "deleteAccount.deleteUser",
      table: "auth",
      error: { code: error.code },
    });
    return { error: DELETE_ACCOUNT_ERROR_MESSAGE };
  }

  // ここから先は退会成功。セッション破棄は可能な範囲で行い、失敗しても退会成功のままにする
  try {
    const { error: signOutError } = await supabase.auth.signOut({
      scope: "local",
    });
    if (signOutError) {
      logSupabaseError({
        event: "supabase_auth_error",
        route: ROUTE,
        operation: "deleteAccount.signOut",
        table: "auth",
        error: { code: signOutError.code },
      });
    }
  } catch {
    logSupabaseError({
      event: "supabase_auth_error",
      route: ROUTE,
      operation: "deleteAccount.signOut",
      table: "auth",
      error: { code: "unexpected_error" },
    });
  }

  revalidatePath("/", "layout");
  // redirect() は例外で処理を中断する仕組みのため、try/catchの外で呼ぶ
  redirect(AFTER_DELETE_PATH);
}
