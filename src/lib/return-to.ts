import { sanitizeNextPath } from "@/lib/safe-next-path";

// U06 メモ一覧・U07 お気に入りを「閉じた」あとの戻り先（returnTo）を扱う。
// 戻り先は、一覧を開いた元の画面（U01・U02・U03）のURLだけを許可する。
// クエリパラメータの値は信用せず、ここで検証してから使う。
export const RETURN_TO_PARAM = "returnTo";

const DEFAULT_RETURN_TO = "/";
// 許可する戻り先のパス（クエリは検索条件などをそのまま引き継ぐため、パスだけを検査する）
const ALLOWED_PATHNAME = /^\/(?:search|store\/\d+)?$/;
const INTERNAL_ORIGIN = "http://internal.invalid";

// 検証に通った戻り先だけを返す。無い・不正な場合はU01（"/"）を返す
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) {
    return DEFAULT_RETURN_TO;
  }

  // 外部ホストへのすり替え等は、ログイン後の遷移先と同じ基準で弾く
  const safePath = sanitizeNextPath(value);
  if (safePath === DEFAULT_RETURN_TO && value !== DEFAULT_RETURN_TO) {
    return DEFAULT_RETURN_TO;
  }

  let url: URL;
  try {
    url = new URL(safePath, INTERNAL_ORIGIN);
  } catch {
    return DEFAULT_RETURN_TO;
  }
  if (!ALLOWED_PATHNAME.test(url.pathname)) {
    return DEFAULT_RETURN_TO;
  }

  return `${url.pathname}${url.search}`;
}

// 一覧画面（U06・U07）へのリンク先を作る。戻り先がU01（既定値）の場合は付けない
export function buildListHref(
  listPath: "/notes" | "/favorites",
  returnTo: string,
): string {
  const safe = sanitizeReturnTo(returnTo);
  if (safe === DEFAULT_RETURN_TO) {
    return listPath;
  }
  return `${listPath}?${RETURN_TO_PARAM}=${encodeURIComponent(safe)}`;
}

// 未ログインで一覧画面（U06・U07）を開いたときの、ログイン画面へのリンク先を作る。
// 戻り先がU01（既定値）の場合は従来どおり /login?next=/notes などの形にする。
// 戻り先がある場合は、ログイン後にその一覧へ戻れるよう戻り先ごとエンコードして引き継ぐ
export function buildLoginHrefForList(
  listPath: "/notes" | "/favorites",
  returnTo: string,
): string {
  const listHref = buildListHref(listPath, returnTo);
  return listHref === listPath
    ? `/login?next=${listPath}`
    : `/login?next=${encodeURIComponent(listHref)}`;
}

// ヘッダーの「メモ一覧」「お気に入り」リンクに付ける戻り先を決める。
// U01〜U03では、いま見ている画面（検索条件などのクエリ付き）を戻り先にする。
// U06・U07では、自分自身ではなく受け取った戻り先をそのまま引き継ぐ
// （U06とU07を行き来しても、最初のU01〜U03を戻り先として維持するため）
const LIST_PATHNAMES = new Set(["/notes", "/favorites"]);

export function resolveHeaderReturnTo(
  pathname: string,
  searchParams: URLSearchParams,
): string {
  if (LIST_PATHNAMES.has(pathname)) {
    return sanitizeReturnTo(searchParams.get(RETURN_TO_PARAM));
  }
  const query = searchParams.toString();
  return sanitizeReturnTo(`${pathname}${query ? `?${query}` : ""}`);
}
