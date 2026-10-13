import { toSearchParams, type SearchConditions } from "@/lib/search-conditions";

// 検索結果（U03）のスクロール位置を、検索条件ごとに sessionStorage へ保存・復元する。
// sessionStorage へはすべて関数の中でだけアクセスする（SSRでも読み込める）。
export const SEARCH_SCROLL_STORAGE_KEY_PREFIX =
  "thai-tabe-tokyo:search-scroll-y:";

export function buildSearchScrollKey(conditions: SearchConditions): string {
  return (
    SEARCH_SCROLL_STORAGE_KEY_PREFIX + toSearchParams(conditions).toString()
  );
}

export function saveSearchScrollY(
  conditions: SearchConditions,
  scrollY: number,
): void {
  try {
    sessionStorage.setItem(buildSearchScrollKey(conditions), String(scrollY));
  } catch {
    // ignore
  }
}

// 保存済みのスクロール位置を取り出して削除する。
// 未保存・不正な値・sessionStorage利用不可の場合は null を返す。
export function takeSearchScrollY(conditions: SearchConditions): number | null {
  const scrollKey = buildSearchScrollKey(conditions);

  let raw: string | null;
  try {
    raw = sessionStorage.getItem(scrollKey);
  } catch {
    return null;
  }

  if (raw === null) {
    return null;
  }

  const y = Number(raw);
  const isValid = Number.isFinite(y) && y >= 0;

  try {
    sessionStorage.removeItem(scrollKey);
  } catch {
    // ignore
  }

  return isValid ? y : null;
}
