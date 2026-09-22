"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const FROM_SEARCH_STORAGE_KEY = "thai-tabe-tokyo:from-search";

function subscribe() {
  // sessionStorageの変更を監視する必要はない（マウント時点の値のみ使用する）
  return () => {};
}

function readCameFromSearch(storeId: number): boolean {
  try {
    const raw = sessionStorage.getItem(FROM_SEARCH_STORAGE_KEY);
    if (raw === null) {
      return false;
    }
    const parsed = JSON.parse(raw) as { storeId?: unknown };
    return parsed.storeId === String(storeId);
  } catch {
    // JSON不正・sessionStorage利用不可などの場合は通常のLinkとして扱う
    return false;
  }
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
    () => readCameFromSearch(storeId),
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
    try {
      sessionStorage.removeItem(FROM_SEARCH_STORAGE_KEY);
    } catch {
      // ignore
    }
    router.back();
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
