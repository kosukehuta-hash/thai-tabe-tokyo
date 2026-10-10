import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { ListPageLayout } from "@/components/ListPageLayout";
import { ListFetchError } from "@/components/ListFetchError";
import listStyles from "@/components/ListPage.module.css";
import { formatDateTimeJst } from "@/lib/format";
import { fetchOwnNotesWithStores } from "@/lib/queries/notes";
import { buildStoreHrefFromList } from "@/lib/list-origin";
import {
  RETURN_TO_PARAM,
  buildListHref,
  buildLoginHrefForList,
  sanitizeReturnTo,
} from "@/lib/return-to";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "メモ一覧 | THAI TABE TOKYO",
};

export default async function NotesPage(props: PageProps<"/notes">) {
  // 「閉じる」の戻り先。一覧を開いた元の画面（U01〜U03）のURLで、検証に通らない場合はU01
  const rawReturnTo = (await props.searchParams)[RETURN_TO_PARAM];
  const returnTo = sanitizeReturnTo(
    Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo,
  );

  const supabaseServer = await createServerSupabaseClient();
  const { data, error } = await supabaseServer.auth.getClaims();

  if (error || !data?.claims) {
    // ログイン後にこの一覧へ戻れるよう、戻り先も引き継ぐ
    redirect(buildLoginHrefForList("/notes", returnTo));
  }

  const result = await fetchOwnNotesWithStores(supabaseServer);

  return (
    <ListPageLayout
      title="メモ一覧"
      closeLabel="メモ一覧を閉じる"
      returnTo={returnTo}
    >
      {result.status === "error" && (
        // 再試行は、この一覧を開き直す。検証済みの戻り先（returnTo）は保ち、不正な値は引き継がない
        <ListFetchError retryHref={buildListHref("/notes", returnTo)} />
      )}

      {result.status === "success" && result.notes.length === 0 && (
        <div className={listStyles.empty}>
          <p className={listStyles.emptyText}>まだメモがありません</p>
        </div>
      )}

      {result.status === "success" && result.notes.length > 0 && (
        <ul className={listStyles.list}>
          {result.notes.map((note) => (
            <li key={note.noteId} className={listStyles.item}>
              <div className={listStyles.itemHeader}>
                <span className={listStyles.storeNameGroup}>
                  {note.isPublished ? (
                    <Link
                      href={buildStoreHrefFromList(note.storeId, "notes")}
                      className={listStyles.storeLink}
                    >
                      {note.storeName}
                    </Link>
                  ) : (
                    <>
                      <span className={listStyles.storeName}>
                        {note.storeName}
                      </span>
                      <span className={listStyles.unpublishedBadge}>
                        非公開
                      </span>
                    </>
                  )}
                </span>
                <span className={styles.updatedAt}>
                  {formatDateTimeJst(note.updatedAt)}
                </span>
              </div>
              <p className={styles.noteText}>{note.noteText}</p>
            </li>
          ))}
        </ul>
      )}
    </ListPageLayout>
  );
}
