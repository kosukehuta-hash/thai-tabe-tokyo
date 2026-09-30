import type { ReactNode } from "react";
import { AuthStatus } from "@/components/AuthStatus";
import { HeaderHomeLink } from "@/components/HeaderHomeLink";
import { HistoryBackButton } from "@/components/HistoryBackButton";
import styles from "./ListPage.module.css";

type ListPageLayoutProps = {
  title: string;
  children: ReactNode;
};

// ログインユーザー本人のデータを一覧で見せる画面（U06 メモ一覧・U07 お気に入り）に
// 共通のヘッダー（戻るボタン・ロゴ・認証表示）、ページ枠、見出しを表示する。
// 一覧の中身（カード・0件表示・エラー表示）は各画面が、共通CSS（ListPage.module.css）の
// クラスを使って描画する。
export function ListPageLayout({ title, children }: ListPageLayoutProps) {
  return (
    <>
      <header className={styles.headerBand}>
        <HistoryBackButton className={styles.headerBackButton} />

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
