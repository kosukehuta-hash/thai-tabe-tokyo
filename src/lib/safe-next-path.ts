// クライアントやクエリパラメータの値は信用せず、ここでも同じ基準で検証する。
// 固定の内部オリジンを基準にnew URL()で正規化し、オリジンが一致する場合だけ
// パス・クエリ・ハッシュを返す。"//"やバックスラッシュを使ったホストのすり替えは
// オリジン不一致として一律で弾かれる。
const INTERNAL_ORIGIN = "http://internal.invalid";
const AUTH_ENTRY_PATHS = new Set(["/login", "/signup"]);

export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value) {
    return "/";
  }
  if (!value.startsWith("/")) {
    return "/";
  }
  if (/[\x00-\x1f]/.test(value)) {
    return "/";
  }

  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return "/";
  }

  if (url.origin !== INTERNAL_ORIGIN) {
    return "/";
  }

  if (AUTH_ENTRY_PATHS.has(url.pathname)) {
    // ログイン・サインアップへの遷移を許すとリダイレクトループになるため拒否する
    return "/";
  }

  const normalized = `${url.pathname}${url.search}${url.hash}`;

  if (normalized.startsWith("//") || normalized.startsWith("/\\")) {
    // 念のための二重チェック。ブラウザ側の解釈違いで"//"やバックスラッシュ始まりの
    // 値が外部ホストへの遷移として扱われることを防ぐ
    return "/";
  }

  return normalized;
}
