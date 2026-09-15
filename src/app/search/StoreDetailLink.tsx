"use client";

import Link from "next/link";
import { ArrowRightIcon } from "./SearchIcons";
import styles from "./page.module.css";

const SCROLL_STORAGE_KEY = "thai-tabe-tokyo:search-scroll-y";

type StoreDetailLinkProps = {
  href: string;
};

export default function StoreDetailLink({ href }: StoreDetailLinkProps) {
  const handleClick = () => {
    try {
      sessionStorage.setItem(SCROLL_STORAGE_KEY, String(window.scrollY));
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
