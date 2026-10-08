import Link from "next/link";
import styles from "./ListPage.module.css";

type ListFetchErrorProps = {
  // 「再試行」の移動先。一覧画面（U06・U07）自身のURL（検証済みの戻り先を含む）を渡す
  retryHref: string;
};

// 一覧画面（U06 メモ一覧・U07 お気に入り）のデータ取得失敗時の表示。
// 取得失敗の文言と、同じ画面を開き直す「再試行」リンクだけを表示する（内部エラーの内容は表示しない）。
// 店舗詳細の StoreErrorMessage と同じ文言・同じリンクの見た目で、一覧画面の枠（ListPageLayout）の中に置く。
// 一覧画面では、元の画面へ戻る操作はヘッダーの「閉じる」が担うため、「条件選択へ戻る」は表示しない
export function ListFetchError({ retryHref }: ListFetchErrorProps) {
  return (
    <>
      <p role="alert" className={styles.fetchErrorMessage}>
        情報を取得できませんでした。もう一度お試しください
      </p>
      <div className={styles.fetchErrorActions}>
        <Link href={retryHref} className={styles.retryLink}>
          再試行
        </Link>
      </div>
    </>
  );
}
