"use client";

import { useActionState } from "react";
import {
  addFavorite,
  removeFavorite,
  type FavoriteActionState,
} from "@/app/favorites/actions";
import styles from "./FavoriteButton.module.css";

// 現在の状態に応じて、登録・解除のどちらのServer Actionを呼ぶかを選ぶ。
// 結果（成功・失敗とも）はServer Actionが返す状態をそのまま使うため、
// 失敗時は処理前の状態のまま、エラーメッセージだけが加わる。
export function toggleFavorite(
  prevState: FavoriteActionState,
  formData: FormData,
): Promise<FavoriteActionState> {
  return prevState.isFavorite
    ? removeFavorite(prevState, formData)
    : addFavorite(prevState, formData);
}

type FavoriteButtonViewProps = {
  storeId: number;
  isFavorite: boolean;
  isPending: boolean;
  error: string | null;
  formAction: (formData: FormData) => void;
};

export function FavoriteButtonView({
  storeId,
  isFavorite,
  isPending,
  error,
  formAction,
}: FavoriteButtonViewProps) {
  return (
    <div className={styles.wrapper}>
      <form action={formAction}>
        <input type="hidden" name="storeId" value={storeId} />
        <button
          type="submit"
          className={styles.button}
          aria-pressed={isFavorite}
          disabled={isPending}
        >
          {isFavorite ? "♥ お気に入り済み" : "♡ お気に入り"}
        </button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type FavoriteButtonProps = {
  storeId: number;
  initialIsFavorite: boolean;
};

export function FavoriteButton({
  storeId,
  initialIsFavorite,
}: FavoriteButtonProps) {
  const [state, formAction, isPending] = useActionState(toggleFavorite, {
    isFavorite: initialIsFavorite,
    error: null,
  });

  return (
    <FavoriteButtonView
      storeId={storeId}
      isFavorite={state.isFavorite}
      isPending={isPending}
      error={state.error}
      formAction={formAction}
    />
  );
}
