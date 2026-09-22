import Link from "next/link";
import styles from "./page.module.css";

type StoreNotFoundMessageProps = {
  backToSearchHref: string;
};

export function StoreNotFoundMessage({
  backToSearchHref,
}: StoreNotFoundMessageProps) {
  return (
    <div className={styles.pageShell}>
      <div className={styles.page}>
        <p className={styles.message}>
          お探しの店舗情報を表示できませんでした。
        </p>
        <Link
          href={backToSearchHref}
          scroll={false}
          className={styles.actionLink}
        >
          検索結果に戻る
        </Link>
      </div>
    </div>
  );
}

type StoreErrorMessageProps = {
  retryHref: string;
  backToTopHref: string;
};

export function StoreErrorMessage({
  retryHref,
  backToTopHref,
}: StoreErrorMessageProps) {
  return (
    <div className={styles.pageShell}>
      <div className={styles.page}>
        <p className={styles.message}>
          情報を取得できませんでした。もう一度お試しください
        </p>
        <div className={styles.actions}>
          <Link href={retryHref} className={styles.actionLink}>
            再試行
          </Link>
          <Link href={backToTopHref} className={styles.actionLink}>
            条件選択へ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
