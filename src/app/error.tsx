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
        エラーが発生しました。
        <br />
        時間をおいて、もう一度お試しください。
      </p>
      <button
        type="button"
        className={styles.retryButton}
        onClick={() => retry()}
      >
        もう一度試す
      </button>
    </div>
  );
}
