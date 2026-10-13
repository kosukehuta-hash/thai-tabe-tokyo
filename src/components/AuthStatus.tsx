"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logout, type LogoutState } from "@/app/logout/actions";
import { clearCameFromSearchMark } from "@/lib/from-search-mark";
import { buildListHref, resolveHeaderReturnTo } from "@/lib/return-to";
import styles from "./AuthStatus.module.css";

type AuthState = "checking" | "loggedIn" | "loggedOut";

const initialLogoutState: LogoutState = { error: null };
// /login・/signup自体からnextを作ると意味がないため除外する
// （このコンポーネントは現状U01〜U03にしか置かれないが、念のため防御する）
const AUTH_ENTRY_PATHS = new Set(["/login", "/signup"]);
// U03を離れて検索結果以外の画面（ログイン画面、メモ一覧、お気に入り等）へ移動する場合は、
// 「検索結果から来た」印を削除する。印を残したままU03へ戻ると、
// 「検索結果に戻る」がrouter.back()で直前の画面（一覧等）へ戻ってしまう。
// （印の削除は clearCameFromSearchMark を使う）

export function AuthStatus() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [logoutState, logoutAction, isLoggingOut] = useActionState(
    logout,
    initialLogoutState,
  );

  // Client Componentの存続中は同一のSupabaseクライアントを使い続ける
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;
    // 連番のリクエストIDで、古い非同期結果が新しい認証状態を
    // 上書きしないようにする
    let latestRequestId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function scheduleCheck() {
      const requestId = ++latestRequestId;
      // getClaims()はSupabaseの別の非同期認証メソッドであり、
      // onAuthStateChangeのコールバックからは直接awaitしない。
      // setTimeoutでコールバック終了後まで処理を遅延させる。
      timeoutId = setTimeout(() => {
        if (!active) {
          return;
        }
        // getSession()は使わず、JWTを検証するgetClaims()で判定する
        supabase.auth
          .getClaims()
          .then(({ data, error }) => {
            if (!active || requestId !== latestRequestId) {
              return;
            }
            setAuthState(!error && data?.claims ? "loggedIn" : "loggedOut");
          })
          .catch(() => {
            if (!active || requestId !== latestRequestId) {
              return;
            }
            setAuthState("loggedOut");
          });
      }, 0);
    }

    // 初回判定は、購読直後のイベントだけに完全依存せず、
    // ここでも明示的に実行する
    scheduleCheck();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // コールバック自体はasyncにせず、awaitもしない
      scheduleCheck();
    });

    // このリスナーが保証するのは同一タブ内での反映だけである。
    // Server Action経由のログアウトは他タブへ即座には伝播しないため、
    // 他タブは次回の画面遷移・再読み込みで正しい状態に更新される。
    return () => {
      active = false;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (authState === "checking") {
    // 判定中は最小限のプレースホルダーのみ表示し、レイアウトのずれと
    // 「ログイン」「新規登録」の一瞬の誤表示を防ぐ
    return <div className={styles.wrapper} aria-hidden="true" />;
  }

  if (authState === "loggedOut") {
    const query = searchParams.toString();
    const nextPath = AUTH_ENTRY_PATHS.has(pathname)
      ? "/"
      : `${pathname}${query ? `?${query}` : ""}`;

    return (
      <LoggedOutStatus
        nextPath={nextPath}
        onNavigateAway={clearCameFromSearchMark}
      />
    );
  }

  // メモ一覧・お気に入り・アカウント削除を「閉じた」あとの戻り先（決め方は resolveHeaderReturnTo を参照）
  const returnTo = resolveHeaderReturnTo(pathname, searchParams);

  return (
    <LoggedInStatus
      returnTo={returnTo}
      logoutAction={logoutAction}
      isLoggingOut={isLoggingOut}
      logoutError={logoutState.error}
    />
  );
}

type LoggedOutStatusProps = {
  nextPath: string;
  onNavigateAway: () => void;
};

// 未ログイン時の表示（ログイン・新規登録への導線）
export function LoggedOutStatus({
  nextPath,
  onNavigateAway,
}: LoggedOutStatusProps) {
  return (
    <div className={styles.wrapper}>
      <Link
        href={`/login?next=${encodeURIComponent(nextPath)}`}
        className={styles.authLink}
        onClick={onNavigateAway}
      >
        ログイン
      </Link>
      <Link href="/signup" className={styles.authLink} onClick={onNavigateAway}>
        新規登録
      </Link>
    </div>
  );
}

type LoggedInStatusProps = {
  returnTo?: string;
  logoutAction: (formData: FormData) => void;
  isLoggingOut: boolean;
  logoutError: string | null;
};

// ログイン時の表示（メモ一覧・お気に入りへの導線、ログイン状態、ログアウト、アカウント削除への導線）
export function LoggedInStatus({
  returnTo = "/",
  logoutAction,
  isLoggingOut,
  logoutError,
}: LoggedInStatusProps) {
  return (
    <div className={styles.wrapper}>
      <Link
        href={buildListHref("/notes", returnTo)}
        className={styles.authLink}
        onClick={clearCameFromSearchMark}
      >
        メモ一覧
      </Link>
      <Link
        href={buildListHref("/favorites", returnTo)}
        className={styles.authLink}
        onClick={clearCameFromSearchMark}
      >
        お気に入り
      </Link>
      <span className={styles.statusText}>ログイン中</span>
      <form action={logoutAction}>
        <button
          type="submit"
          className={styles.logoutButton}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "ログアウト中..." : "ログアウト"}
        </button>
      </form>
      <Link
        href={buildListHref("/account/delete", returnTo)}
        className={styles.authLink}
        onClick={clearCameFromSearchMark}
      >
        アカウント削除
      </Link>
      {logoutError && (
        <p className={styles.error} role="alert">
          {logoutError}
        </p>
      )}
    </div>
  );
}
