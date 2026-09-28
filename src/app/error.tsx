"use client";

import styles from "./error.module.css";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  void error;

  return (
    <div className={styles.wrapper}>
      <p className={styles.message}>
        情報を取得できませんでした。もう一度お試しください
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.retryButton}
          onClick={() => retry()}
        >
          再試行
        </button>
        {/* エラー境界はクライアント遷移だけでは解消されないため、Linkではなく
            通常の<a>タグで確実にページ全体を再読み込みする */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className={styles.actionLink}>
          条件選択へ戻る
        </a>
      </div>
    </div>
  );
}
