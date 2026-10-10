// 一覧（U06 メモ一覧・U07 お気に入り）から店舗詳細（U03）を開いたとき、店舗詳細の戻りリンクを
// 元の一覧へ向けるための「どの一覧から来たか」を扱う。
//
// URLのクエリ from には、次の2つの固定の値だけを指定できる。
//   /store/123?from=notes      … メモ一覧（/notes）から来た
//   /store/123?from=favorites  … お気に入り（/favorites）から来た
// 戻り先のURLは、ユーザーが指定した文字列から作らず、下の固定の対応表から決める
// （外部URL・// や /\ で始まる値・制御文字・/notes などのパスは、すべて無効）。
// 一覧を閉じたあとの戻り先（returnTo。src/lib/return-to.ts）とは別の仕組みで、
// sanitizeReturnTo の許可対象（U01〜U03）は変更しない。
export const LIST_ORIGIN_PARAM = "from";

export type ListOrigin = "notes" | "favorites";

type ListOriginTarget = {
  // 戻りリンクの移動先（固定）
  href: "/notes" | "/favorites";
  // 戻りリンクの文言に使う一覧の名前（「← ○○に戻る」）
  label: string;
};

const LIST_ORIGIN_TARGETS: Record<ListOrigin, ListOriginTarget> = {
  notes: { href: "/notes", label: "メモ一覧" },
  favorites: { href: "/favorites", label: "お気に入り" },
};

// from の値を検証する。"notes" か "favorites" に完全一致する場合だけ有効で、
// それ以外（未指定・空・外部URL・パス・大文字小文字違い・前後の空白など）は null（無効）を返す
export function parseListOrigin(
  value: string | null | undefined,
): ListOrigin | null {
  return value === "notes" || value === "favorites" ? value : null;
}

// 検証済みの一覧に対する、戻りリンクの移動先と文言を返す（固定の対応表から決める）
export function getListOriginTarget(origin: ListOrigin): ListOriginTarget {
  return LIST_ORIGIN_TARGETS[origin];
}

// 一覧から店舗詳細へのリンク先を作る（例: /store/123?from=notes）
export function buildStoreHrefFromList(
  storeId: number,
  origin: ListOrigin,
): string {
  return `/store/${storeId}?${LIST_ORIGIN_PARAM}=${origin}`;
}
