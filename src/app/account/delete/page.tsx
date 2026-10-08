import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { isProtectedUserId } from "@/lib/protected-users";
import {
  RETURN_TO_PARAM,
  buildLoginHrefForList,
  sanitizeReturnTo,
} from "@/lib/return-to";
import { ListPageLayout } from "@/components/ListPageLayout";
import { DeleteAccountForm } from "./DeleteAccountForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "アカウント削除 | THAI TABE TOKYO",
};

const DELETE_NOTICE =
  "メモとお気に入りを含むアカウント情報が削除され、元に戻せません。";

// U08 アカウント削除画面。ログイン中のみ利用できる。
// 削除の実処理は DeleteAccountForm から呼ばれる Server Action（actions.ts）が行う。
export default async function AccountDeletePage(
  props: PageProps<"/account/delete">,
) {
  // 「アカウント削除を閉じる」の戻り先。この画面を開いた元の画面（U01〜U03）のURLで、
  // 検証に通らない場合はU01
  const rawReturnTo = (await props.searchParams)[RETURN_TO_PARAM];
  const returnTo = sanitizeReturnTo(
    Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo,
  );

  const supabaseServer = await createServerSupabaseClient();

  const userId = await getAuthenticatedUserId(supabaseServer, {
    route: "/account/delete",
    operation: "AccountDeletePage.getClaims",
  });
  if (userId === null) {
    // ログイン後にこの画面へ戻れるよう、戻り先も引き継ぐ
    redirect(buildLoginHrefForList("/account/delete", returnTo));
  }

  return (
    <ListPageLayout
      title="アカウント削除"
      closeLabel="アカウント削除を閉じる"
      returnTo={returnTo}
    >
      <p className={styles.notice}>{DELETE_NOTICE}</p>
      {/* 保護対象かどうかの判定結果（真偽値）だけを渡す。保護対象のIDの実値は渡さない */}
      <DeleteAccountForm isProtected={isProtectedUserId(userId)} />
    </ListPageLayout>
  );
}
