"use client";

import Link from "next/link";
import { useActionState } from "react";
import listStyles from "@/components/ListPage.module.css";
import { buildStoreHrefFromList } from "@/lib/list-origin";
import { removeFavorite } from "./actions";
import styles from "./FavoriteItem.module.css";

type FavoriteItemViewProps = {
  storeId: number;
  storeName: string;
  isPublished: boolean;
  isPending: boolean;
  error: string | null;
  formAction: (formData: FormData) => void;
};

// お気に入り1件のカード。店舗名・公開状態・解除ボタンだけを表示する。
// 非公開店舗は「非公開」バッジを表示して詳細リンクは付けないが、解除はできる。
export function FavoriteItemView({
  storeId,
  storeName,
  isPublished,
  isPending,
  error,
  formAction,
}: FavoriteItemViewProps) {
  return (
    <li className={listStyles.item}>
      <div className={listStyles.itemHeader}>
        <span className={listStyles.storeNameGroup}>
          {isPublished ? (
            <Link
              href={buildStoreHrefFromList(storeId, "favorites")}
              className={listStyles.storeLink}
            >
              {storeName}
            </Link>
          ) : (
            <>
              <span className={listStyles.storeName}>{storeName}</span>
              <span className={listStyles.unpublishedBadge}>非公開</span>
            </>
          )}
        </span>

        <form action={formAction} className={styles.removeForm}>
          <input type="hidden" name="storeId" value={storeId} />
          <button
            type="submit"
            className={styles.removeButton}
            disabled={isPending}
          >
            解除
          </button>
        </form>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

type FavoriteItemProps = {
  storeId: number;
  storeName: string;
  isPublished: boolean;
};

// 解除に成功したカードを画面から消すのは、この部品ではなく、Server Actionの
// revalidatePath("/favorites") で再取得された一覧（DBの最新状態）が担う。
// 失敗時はカードをそのまま残し、Server Actionが返した文言だけを表示する。
export function FavoriteItem({
  storeId,
  storeName,
  isPublished,
}: FavoriteItemProps) {
  const [state, formAction, isPending] = useActionState(removeFavorite, {
    isFavorite: true,
    error: null,
  });

  return (
    <FavoriteItemView
      storeId={storeId}
      storeName={storeName}
      isPublished={isPublished}
      isPending={isPending}
      error={state.error}
      formAction={formAction}
    />
  );
}
