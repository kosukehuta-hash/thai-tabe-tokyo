import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import styles from "./WithdrawnNotice.module.css";

type WithdrawnNoticeProps = {
  // U01のURLクエリ withdrawn の値（/?withdrawn=1）
  withdrawn: string | string[] | undefined;
};

// アカウント削除（U08）の成功後にU01へ遷移したときの『退会しました』。
// URLの目印（withdrawn=1）に加えて、ログアウト状態のときだけ表示する。
// ログイン中に /?withdrawn=1 を手入力しても表示しない（退会完了と誤認しないため）。
// ログイン状態は、ヘッダー（AuthStatus）と同じくJWTを検証するgetClaims()で判定する。
export async function WithdrawnNotice({ withdrawn }: WithdrawnNoticeProps) {
  const value = Array.isArray(withdrawn) ? withdrawn[0] : withdrawn;
  if (value !== "1") {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const userId = await getAuthenticatedUserId(supabase, {
    route: "/",
    operation: "WithdrawnNotice.getClaims",
  });
  if (userId !== null) {
    return null;
  }

  return (
    <p className={styles.notice} role="status">
      退会しました
    </p>
  );
}
