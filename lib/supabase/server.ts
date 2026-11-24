import "server-only";
import { createServerClient as createClientInternal } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function createServerClient() {
  const cookieStore = await cookies();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

  return createClientInternal(url, key, {
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
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have proxy (middleware) refreshing sessions.
        }
      },
    },
  });
}
