"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LogoutState = {
  error: string | null;
};

const LOGOUT_ERROR_MESSAGE =
  "ログアウトできませんでした。時間をおいてもう一度お試しください。";

export async function logout(_prevState: LogoutState): Promise<LogoutState> {
  // useActionStateの規約上、直前stateの引数は必要だが本処理では使用しない
  void _prevState;

  const supabase = await createClient();

  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    // Supabaseの生のエラー内容は画面・ログへ出さない
    return { error: LOGOUT_ERROR_MESSAGE };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
