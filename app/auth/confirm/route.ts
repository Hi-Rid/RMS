import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/home";

  // Sanitize next to only allow safe relative paths
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  if (token_hash && type) {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();
    const verifiedEmail = data?.user?.email?.toLowerCase();

    if (!error && verifiedEmail && (!ownerEmail || verifiedEmail === ownerEmail)) {
      return NextResponse.redirect(new URL(safeNext, request.url));
    }

    // Invalid or unauthorized user
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
