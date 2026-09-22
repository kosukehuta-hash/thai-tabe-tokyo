"use client";

import { useEffect } from "react";
import { toSearchParams, type SearchConditions } from "@/lib/search-conditions";

const SCROLL_STORAGE_KEY_PREFIX = "thai-tabe-tokyo:search-scroll-y:";

type ScrollRestorerProps = {
  searchConditions: SearchConditions;
};

export default function ScrollRestorer({
  searchConditions,
}: ScrollRestorerProps) {
  useEffect(() => {
    const scrollKey =
      SCROLL_STORAGE_KEY_PREFIX + toSearchParams(searchConditions).toString();

    let raw: string | null;
    try {
      raw = sessionStorage.getItem(scrollKey);
    } catch {
      return;
    }

    if (raw === null) {
      return;
    }

    const y = Number(raw);
    const isValid = Number.isFinite(y) && y >= 0;

    if (isValid) {
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    }

    try {
      sessionStorage.removeItem(scrollKey);
    } catch {
      // ignore
    }
  }, [searchConditions]);

  return null;
}
