"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  clearCameFromSearchMark,
  hasCameFromSearch,
} from "@/lib/from-search-mark";

// U03を離れて検索結果以外の画面（ログイン画面等）へ移動する場合は、
// この印をAuthStatus側で削除する（src/components/AuthStatus.tsx参照）。

function subscribe() {
  // sessionStorageの変更を監視する必要はない（マウント時点の値のみ使用する）
  return () => {};
}

function getServerSnapshot(): boolean {
  return false;
}

type BackToSearchLinkProps = {
  storeId: number;
  href: string;
  className: string;
  children: React.ReactNode;
};

export default function BackToSearchLink({
  storeId,
  href,
  className,
  children,
}: BackToSearchLinkProps) {
  const router = useRouter();
  const cameFromSearch = useSyncExternalStore(
    subscribe,
    () => hasCameFromSearch(storeId),
    getServerSnapshot,
  );

  if (!cameFromSearch) {
    return (
      <Link href={href} scroll={false} className={className}>
        {children}
      </Link>
    );
  }

  const handleClick = () => {
    clearCameFromSearchMark();
    router.back();
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
