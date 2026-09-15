"use client";

import { useEffect } from "react";

const SCROLL_STORAGE_KEY = "thai-tabe-tokyo:search-scroll-y";

export default function ScrollRestorer() {
  useEffect(() => {
    let raw: string | null;
    try {
      raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
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
      sessionStorage.removeItem(SCROLL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return null;
}
