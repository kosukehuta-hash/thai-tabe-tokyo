"use client";

import Image from "next/image";
import Link from "next/link";
import { FROM_SEARCH_STORAGE_KEY } from "@/app/store/[storeId]/BackToSearchLink";

type HeaderHomeLinkProps = {
  className: string;
  logoIconClassName: string;
  logoTextClassName: string;
};

export function HeaderHomeLink({
  className,
  logoIconClassName,
  logoTextClassName,
}: HeaderHomeLinkProps) {
  const handleClick = () => {
    // U03を「検索結果から来た」状態のまま離れると、印が残り続け、
    // 次回同じ店舗へ検索を経由せず訪問した際に「検索結果に戻る」が
    // 誤ってrouter.back()を使うボタンになってしまう。トップへ戻る時点で印を消す。
    try {
      sessionStorage.removeItem(FROM_SEARCH_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <Link href="/" className={className} onClick={handleClick}>
      <Image
        src="/images/thai-temple-logo-v2.png"
        alt=""
        width={1536}
        height={1024}
        priority
        className={logoIconClassName}
      />
      <span className={logoTextClassName}>THAI TABE TOKYO</span>
    </Link>
  );
}
