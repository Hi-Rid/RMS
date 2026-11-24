import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";
  return createBrowserClient(url, key);
}
