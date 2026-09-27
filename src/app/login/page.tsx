import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/safe-next-path";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ログイン | THAI TABE TOKYO",
};

type LoginPageProps = {
  searchParams: Promise<{ next?: string; registered?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = sanitizeNextPath(params.next);

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
