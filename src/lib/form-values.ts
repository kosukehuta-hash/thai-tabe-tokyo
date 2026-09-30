import { parsePositiveInt } from "@/lib/search-conditions";

/**
 * フォームの storeId を正の整数に変換する。文字列以外（File・null）や
 * 正の整数として不正な値は null を返す。
 */
export function parseStoreIdFromForm(
  value: FormDataEntryValue | null,
): number | null {
  return typeof value === "string" ? parsePositiveInt(value) : null;
}
