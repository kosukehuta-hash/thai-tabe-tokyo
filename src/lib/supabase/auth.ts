import "server-only";

import type { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/logger";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

/**
 * ログイン中ユーザーのIDを、JWTを検証するgetClaims()から取得する。
 * getSession()はCookieの値を検証しないため使用しない。
 *
 * ログインしていない、またはIDを取得できない場合は null を返す。
 * getClaims()自体がエラーを返した場合は、ここで1回だけログに記録する
 * （呼び出し側で二重にログを出さないこと）。
 */
export async function getAuthenticatedUserId(
  supabase: ServerSupabaseClient,
  context: { route: string; operation: string },
): Promise<string | null> {
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (claimsError || !userId) {
    if (claimsError) {
      logSupabaseError({
        event: "supabase_auth_error",
        route: context.route,
        operation: context.operation,
        table: "auth",
        error: claimsError,
      });
    }
    return null;
  }
  return userId;
}
