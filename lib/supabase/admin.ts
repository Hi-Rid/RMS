import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function createAdminClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = env.SUPABASE_SECRET_KEY || "placeholder-key";

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
