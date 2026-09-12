import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "環境変数 NEXT_PUBLIC_SUPABASE_URL が設定されていません。.env.local を確認してください。"
  );
}

if (!supabasePublishableKey) {
  throw new Error(
    "環境変数 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY が設定されていません。.env.local を確認してください。"
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
