import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `環境変数 ${name} が設定されていません。.env.local を確認してください。`,
    );
  }
  return value;
}

const supabaseUrl = requireEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);
const supabasePublishableKey = requireEnv(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Componentから呼び出された場合はCookieを書き込めない。
          // セッションの更新はproxy.ts（updateSession）が担うため、ここでは無視してよい。
        }
      },
    },
  });
}
