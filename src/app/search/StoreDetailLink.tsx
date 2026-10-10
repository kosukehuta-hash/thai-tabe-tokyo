"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@/components/SearchIcons";
import styles from "./page.module.css";
import type { SearchConditions } from "@/lib/search-conditions";
import { saveSearchScrollY } from "@/lib/search-scroll";
import { markCameFromSearch } from "@/lib/from-search-mark";

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
    saveSearchScrollY(searchConditions, window.scrollY);
    markCameFromSearch(storeId);
  };

  return (
    <Link href={href} className={styles.detailButton} onClick={handleClick}>
      詳しく見る
      <ArrowRightIcon className={styles.detailArrow} />
    </Link>
  );
}
