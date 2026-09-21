import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ログイン | THAI TABE TOKYO",
};

// クライアントやクエリパラメータの値は信用せず、ここでも同じ基準で検証する。
// 固定の内部オリジンを基準にnew URL()で正規化し、オリジンが一致する場合だけ
// パス・クエリ・ハッシュを返す。"//"やバックスラッシュを使ったホストのすり替えは
// オリジン不一致として一律で弾かれる。
const INTERNAL_ORIGIN = "http://internal.invalid";
const AUTH_ENTRY_PATHS = new Set(["/login", "/signup"]);

function sanitizeNext(value: string | undefined): string {
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

  return `${url.pathname}${url.search}${url.hash}`;
}

type LoginPageProps = {
  searchParams: Promise<{ next?: string; registered?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = sanitizeNext(params.next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (!error && data?.claims) {
    // ログイン済み利用者は、フォームを表示せず安全なnextまたはトップへ移動する
    redirect(next);
  }

  const showRegisteredMessage = params.registered === "1";

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.heading}>ログイン</h1>

        {showRegisteredMessage && (
          <p className={styles.notice} role="status" aria-live="polite">
            登録が完了しました。メールアドレスとパスワードでログインしてください。
          </p>
        )}

        <LoginForm next={next} />
      </div>
    </div>
  );
}
