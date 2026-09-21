"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const INVALID_CREDENTIALS_MESSAGE =
  "メールアドレスまたはパスワードが正しくありません。";
const UNEXPECTED_STATE_ERROR_MESSAGE =
  "ログイン処理を完了できませんでした。時間をおいて再度お試しください。";

// クライアント側から渡されたnextは信用せず、Server Action側でも必ず検証する。
// 固定の内部オリジンを基準にnew URL()で正規化し、オリジンが一致する場合だけ
// パス・クエリ・ハッシュを返す。"//"やバックスラッシュを使ったホストのすり替えは
// オリジン不一致として一律で弾かれる。
const INTERNAL_ORIGIN = "http://internal.invalid";
const AUTH_ENTRY_PATHS = new Set(["/login", "/signup"]);

function sanitizeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || value.length === 0) {
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

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const next = sanitizeNext(formData.get("next"));

  if (typeof email !== "string" || email.length === 0) {
    return { error: "メールアドレスを入力してください。" };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "メールアドレスの形式が正しくありません。" };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { error: "パスワードを入力してください。" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: "パスワードは8文字以上で入力してください。" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    // アカウントの有無を推測できないよう、常に同じメッセージを返す
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  if (!data.session || !data.user) {
    // エラーがないのにsession/userが取得できない想定外の状態では、
    // ログイン成功として扱わずリダイレクトしない
    return { error: UNEXPECTED_STATE_ERROR_MESSAGE };
  }

  redirect(next);
}
