import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { fetchOwnFavorites } from "@/lib/queries/favorites";
import {
  RETURN_TO_PARAM,
  buildLoginHrefForList,
  sanitizeReturnTo,
} from "@/lib/return-to";
import { ListPageLayout } from "@/components/ListPageLayout";
import listStyles from "@/components/ListPage.module.css";
import { FavoriteItem } from "./FavoriteItem";

export const metadata: Metadata = {
  title: "お気に入り | THAI TABE TOKYO",
};

export default async function FavoritesPage(props: PageProps<"/favorites">) {
  // 「閉じる」の戻り先。一覧を開いた元の画面（U01〜U03）のURLで、検証に通らない場合はU01
  const rawReturnTo = (await props.searchParams)[RETURN_TO_PARAM];
  const returnTo = sanitizeReturnTo(
    Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo,
  );

  const supabaseServer = await createServerSupabaseClient();

  const userId = await getAuthenticatedUserId(supabaseServer, {
    route: "/favorites",
    operation: "FavoritesPage.getClaims",
  });
  if (userId === null) {
    // ログイン後にこの一覧へ戻れるよう、戻り先も引き継ぐ
    redirect(buildLoginHrefForList("/favorites", returnTo));
  }

  // get_own_favorites() を1回だけ呼ぶ。並び順（created_at 降順）はDB側の責任で、再ソートしない
  const result = await fetchOwnFavorites(supabaseServer);

  return (
    <ListPageLayout
      title="お気に入り"
      closeLabel="お気に入りを閉じる"
      returnTo={returnTo}
    >
      {result.status === "error" && (
        <p role="alert">情報を取得できませんでした。もう一度お試しください</p>
      )}

      {result.status === "success" && result.favorites.length === 0 && (
        <div className={listStyles.empty}>
          <p className={listStyles.emptyText}>
            まだお気に入りの店舗がありません
          </p>
        </div>
      )}

      {result.status === "success" && result.favorites.length > 0 && (
        <ul className={listStyles.list}>
          {result.favorites.map((favorite) => (
            <FavoriteItem
              key={favorite.store_id}
              storeId={favorite.store_id}
              storeName={favorite.store_name}
              isPublished={favorite.is_published}
            />
          ))}
        </ul>
      )}
    </ListPageLayout>
  );
}
