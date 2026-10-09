import type { Metadata } from "next";
import Link from "next/link";
import { HeaderHomeLink } from "@/components/HeaderHomeLink";
import headerStyles from "@/components/ListPage.module.css";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "ページが見つかりません | THAI TABE TOKYO",
};

// 存在しないURL（どのルートにも一致しないURL）に表示する404画面。
// Next.js標準の英語の404画面の代わりに、アプリのヘッダー・日本語の案内・
// 「トップへ戻る」リンクを表示する。
// 店舗詳細（U03）で店舗IDが不正・存在しない・非公開の場合は、店舗詳細専用の
// src/app/store/[storeId]/not-found.tsx（検索結果へ戻る案内）が表示され、この画面は使われない。
// ヘッダーは共通のロゴ付きリンク（HeaderHomeLink）と、一覧画面と同じヘッダー帯のCSSを再利用する。
// 認証表示（AuthStatus）は、Supabaseへの問い合わせを伴うため、この画面では表示しない。
export default function NotFound() {
  return (
    <>
      <header className={headerStyles.headerBand}>
        <HeaderHomeLink
          className={`${headerStyles.headerInner} ${headerStyles.headerHomeLink}`}
          logoIconClassName={headerStyles.headerLogoIcon}
          logoTextClassName={headerStyles.headerLogoText}
        />
      </header>

      <main className={styles.main}>
        <div className={styles.content}>
          <p className={styles.code}>404</p>
          <h1 className={styles.title}>ページが見つかりませんでした</h1>
          <p className={styles.description}>
            <span className={styles.descriptionLine}>
              お探しのページは存在しないか、移動した可能性があります。
            </span>
            <span className={styles.descriptionLine}>
              URLをご確認のうえ、トップページからもう一度お探しください。
            </span>
          </p>
          <Link href="/" className={styles.homeLink}>
            トップへ戻る
          </Link>
        </div>
      </main>
    </>
  );
}
