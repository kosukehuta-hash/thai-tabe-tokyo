"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignupState = {
  error: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const GENERIC_ERROR_MESSAGE =
  "登録できませんでした。入力内容をご確認のうえ、もう一度お試しください。";
const UNEXPECTED_STATE_ERROR_MESSAGE =
  "登録状態を確認できませんでした。再登録せず、運営にお問い合わせください。";
const SIGNOUT_ERROR_MESSAGE =
  "登録は完了しましたが、ログアウト処理に失敗しました。ページを再読み込みしてログイン状態をご確認ください。";

export async function signup(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = formData.get("email");
  const password = formData.get("password");

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

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: GENERIC_ERROR_MESSAGE };
  }

  if (!data.session) {
    // Confirm Emailが無効な前提のため、成功時はsessionが返るはずである。
    // sessionがない場合はDashboardの設定が想定と異なる可能性があり、
    // 未実装のメール確認フローへ進ませず、ここでエラーとして扱う。
    return { error: UNEXPECTED_STATE_ERROR_MESSAGE };
  }

  // 登録直後に自動生成されるローカルセッションを破棄し、
  // ログイン画面から改めてログインしてもらう
  const { error: signOutError } = await supabase.auth.signOut({
    scope: "local",
  });
  if (signOutError) {
    return { error: SIGNOUT_ERROR_MESSAGE };
  }

  redirect("/login?registered=1");
}
