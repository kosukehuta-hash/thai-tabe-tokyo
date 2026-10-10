"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/safe-next-path";
import {
  EMAIL_PATTERN,
  MIN_PASSWORD_LENGTH,
  PASSWORD_TOO_SHORT_ERROR_MESSAGE,
} from "@/lib/auth-rules";

export type LoginState = {
  error: string | null;
};

const INVALID_CREDENTIALS_MESSAGE =
  "メールアドレスまたはパスワードが正しくありません。";
const UNEXPECTED_STATE_ERROR_MESSAGE =
  "ログイン処理を完了できませんでした。時間をおいて再度お試しください。";

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const nextRaw = formData.get("next");
  const next = sanitizeNextPath(
    typeof nextRaw === "string" ? nextRaw : undefined,
  );

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
    return { error: PASSWORD_TOO_SHORT_ERROR_MESSAGE };
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
