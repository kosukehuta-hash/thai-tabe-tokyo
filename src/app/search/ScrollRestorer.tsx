"use client";

import { useEffect } from "react";
import type { SearchConditions } from "@/lib/search-conditions";
import { takeSearchScrollY } from "@/lib/search-scroll";

type ScrollRestorerProps = {
  searchConditions: SearchConditions;
};

export default function ScrollRestorer({
  searchConditions,
}: ScrollRestorerProps) {
  useEffect(() => {
    const y = takeSearchScrollY(searchConditions);
    if (y !== null) {
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    }
  }, [searchConditions]);

  return null;
}
