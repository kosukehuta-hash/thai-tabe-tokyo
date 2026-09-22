import "server-only";

type LoggableError = {
  code?: string | null;
  message?: string | null;
};

type LogSupabaseErrorParams = {
  event?: "supabase_query_error" | "supabase_auth_error";
  route: string;
  operation: string;
  table: string;
  error: LoggableError;
  context?: Record<string, string | number | null>;
};

// Supabaseのerrorを最初に検知した場所だけで1回だけ呼び出すこと。
// details/hint、user_id、note_text等の機密・個人情報は絶対に含めない。
export function logSupabaseError({
  event = "supabase_query_error",
  route,
  operation,
  table,
  error,
  context,
}: LogSupabaseErrorParams): void {
  console.error(
    JSON.stringify({
      event,
      route,
      operation,
      table,
      error_code: error.code ?? null,
      error_message: error.message ?? null,
      ...context,
    }),
  );
}
