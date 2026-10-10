// 「検索結果（U03）から店舗詳細（U04）へ来た」ことを sessionStorage に残す印の読み書き。
// 印は JSON `{ storeId: string }` で保存する。
// sessionStorage へはすべて関数の中でだけアクセスする（SSRでも読み込める）。
export const FROM_SEARCH_STORAGE_KEY = "thai-tabe-tokyo:from-search";

export function markCameFromSearch(storeId: number): void {
  try {
    sessionStorage.setItem(
      FROM_SEARCH_STORAGE_KEY,
      JSON.stringify({ storeId: String(storeId) }),
    );
  } catch {
    // sessionStorage利用不可の場合は印を残さない
  }
}

export function hasCameFromSearch(storeId: number): boolean {
  try {
    const raw = sessionStorage.getItem(FROM_SEARCH_STORAGE_KEY);
    if (raw === null) {
      return false;
    }
    const parsed = JSON.parse(raw) as { storeId?: unknown };
    return parsed.storeId === String(storeId);
  } catch {
    // JSON不正・sessionStorage利用不可などの場合は「来ていない」として扱う
    return false;
  }
}

export function clearCameFromSearchMark(): void {
  try {
    sessionStorage.removeItem(FROM_SEARCH_STORAGE_KEY);
  } catch {
    // ignore
  }
}
