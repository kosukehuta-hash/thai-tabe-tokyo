"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@/components/SearchIcons";
import styles from "./page.module.css";
import { toSearchParams, type SearchConditions } from "@/lib/search-conditions";

const SCROLL_STORAGE_KEY_PREFIX = "thai-tabe-tokyo:search-scroll-y:";
const FROM_SEARCH_STORAGE_KEY = "thai-tabe-tokyo:from-search";

type StoreDetailLinkProps = {
  href: string;
  storeId: number;
  searchConditions: SearchConditions;
};

export default function StoreDetailLink({
  href,
  storeId,
  searchConditions,
}: StoreDetailLinkProps) {
  const handleClick = () => {
    try {
      const scrollKey =
        SCROLL_STORAGE_KEY_PREFIX + toSearchParams(searchConditions).toString();
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    } catch {
      // ignore
    }
    try {
      sessionStorage.setItem(
        FROM_SEARCH_STORAGE_KEY,
        JSON.stringify({ storeId: String(storeId) }),
      );
    } catch {
      // ignore
    }
  };

  return (
    <Link href={href} className={styles.detailButton} onClick={handleClick}>
      詳しく見る
      <ArrowRightIcon className={styles.detailArrow} />
    </Link>
  );
}
