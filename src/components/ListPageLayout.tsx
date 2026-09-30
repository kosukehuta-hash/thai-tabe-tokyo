import type { ReactNode } from "react";
import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import { HeaderHomeLink } from "@/components/HeaderHomeLink";
import styles from "./ListPage.module.css";

type ListPageLayoutProps = {
  title: string;
  // 「閉じる」ボタンの文言（例: 「メモ一覧を閉じる」）
  closeLabel: string;
  // 閉じたあとに戻る画面（U01〜U03のいずれか）。検証済みの値を渡す
  returnTo: string;
  children: ReactNode;
};

// ログインユーザー本人のデータを一覧で見せる画面（U06 メモ一覧・U07 お気に入り）に
// 共通のヘッダー（閉じるボタン・ロゴ・認証表示）、ページ枠、見出しを表示する。
// 「閉じる」はブラウザ履歴の「戻る」ではなく、一覧を開いた元の画面（returnTo）へ移動する。
// 一覧の中身（カード・0件表示・エラー表示）は各画面が、共通CSS（ListPage.module.css）の
// クラスを使って描画する。
export function ListPageLayout({
  title,
  closeLabel,
  returnTo,
  children,
}: ListPageLayoutProps) {
  return (
    <>
      <header className={styles.headerBand}>
        <div className={styles.headerCloseRow}>
          <Link href={returnTo} className={styles.headerCloseLink}>
            {closeLabel}
          </Link>
        </div>

        <HeaderHomeLink
          className={`${styles.headerInner} ${styles.headerHomeLink}`}
          logoIconClassName={styles.headerLogoIcon}
          logoTextClassName={styles.headerLogoText}
        />
        <AuthStatus />
      </header>

      <div className={styles.page}>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </div>
    </>
  );
}
