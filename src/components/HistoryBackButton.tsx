"use client";

import { useRouter } from "next/navigation";

type HistoryBackButtonProps = {
  className: string;
};

// このページへ遷移する直前の画面へ戻るだけの、ブラウザ履歴利用のボタン。
// 戻り先の固定・保存やsessionStorageによる独自制御は行わない。
export function HistoryBackButton({ className }: HistoryBackButtonProps) {
  const router = useRouter();

  return (
    <button type="button" onClick={() => router.back()} className={className}>
      ← 戻る
    </button>
  );
}
