import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { AuthStatus } from "@/components/AuthStatus";
import { HeaderHomeLink } from "@/components/HeaderHomeLink";
import { HistoryBackButton } from "@/components/HistoryBackButton";
import { fetchOwnNotesWithStores } from "@/lib/queries/notes";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "メモ一覧 | THAI TABE TOKYO",
};

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}年${month}月${day}日 ${hours}:${minutes}`;
}

export default async function NotesPage() {
  const supabaseServer = await createServerSupabaseClient();
  const { data, error } = await supabaseServer.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login?next=/notes");
  }

  const result = await fetchOwnNotesWithStores(supabaseServer);

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
        <h1 className={styles.title}>メモ一覧</h1>

        {result.status === "error" && (
          <p role="alert">
            情報を取得できませんでした。もう一度お試しください
          </p>
        )}

        {result.status === "success" && result.notes.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>まだメモがありません</p>
          </div>
        )}

        {result.status === "success" && result.notes.length > 0 && (
          <ul className={styles.list}>
            {result.notes.map((note) => (
              <li key={note.noteId} className={styles.item}>
                <div className={styles.itemHeader}>
                  <span className={styles.storeNameGroup}>
                    {note.isPublished ? (
                      <Link
                        href={`/store/${note.storeId}`}
                        className={styles.storeLink}
                      >
                        {note.storeName}
                      </Link>
                    ) : (
                      <>
                        <span className={styles.storeName}>
                          {note.storeName}
                        </span>
                        <span className={styles.unpublishedBadge}>
                          非公開
                        </span>
                      </>
                    )}
                  </span>
                  <span className={styles.updatedAt}>
                    {formatUpdatedAt(note.updatedAt)}
                  </span>
                </div>
                <p className={styles.noteText}>{note.noteText}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
