"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logout, type LogoutState } from "@/app/logout/actions";
import { FROM_SEARCH_STORAGE_KEY } from "@/app/store/[storeId]/BackToSearchLink";
import styles from "./AuthStatus.module.css";

type AuthState = "checking" | "loggedIn" | "loggedOut";

const initialLogoutState: LogoutState = { error: null };
// /login・/signup自体からnextを作ると意味がないため除外する
// （このコンポーネントは現状U01〜U03にしか置かれないが、念のため防御する）
const AUTH_ENTRY_PATHS = new Set(["/login", "/signup"]);

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

    // 店舗詳細（U03）からログイン・新規登録画面へ移動する場合、
    // 「検索結果から来た」印を残したままにすると、ログイン後にU03へ戻った際、
    // 「検索結果に戻る」がrouter.back()でログイン画面へ戻ってしまう。
    // 検索結果以外の画面へ移動する時点で印を削除しておく。
    const clearFromSearchMark = () => {
      try {
        sessionStorage.removeItem(FROM_SEARCH_STORAGE_KEY);
      } catch {
        // ignore
      }
    };

    return (
      <LoggedOutStatus
        nextPath={nextPath}
        onNavigateAway={clearFromSearchMark}
      />
    );
  }

  return (
    <LoggedInStatus
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
  logoutAction: (formData: FormData) => void;
  isLoggingOut: boolean;
  logoutError: string | null;
};

// ログイン時の表示（メモ一覧・お気に入りへの導線、ログイン状態、ログアウト）
export function LoggedInStatus({
  logoutAction,
  isLoggingOut,
  logoutError,
}: LoggedInStatusProps) {
  return (
    <div className={styles.wrapper}>
      <Link href="/notes" className={styles.authLink}>
        メモ一覧
      </Link>
      <Link href="/favorites" className={styles.authLink}>
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
      {logoutError && (
        <p className={styles.error} role="alert">
          {logoutError}
        </p>
      )}
    </div>
  );
}
