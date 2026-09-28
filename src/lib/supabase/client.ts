import { createBrowserClient } from "@supabase/ssr";
import { requireEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

const supabaseUrl = requireEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);
const supabasePublishableKey = requireEnv(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
