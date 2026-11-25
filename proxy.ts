import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { env } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/");

  // Static assets, public endpoints, and auth routes are exempt
  const isPublicRoute =
    isAuthPage ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/ingest") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/dev") ||
    pathname.startsWith("/_next") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/opengraph-image") ||
    pathname.startsWith("/twitter-image");

  const { supabaseResponse, claims } = await updateSession(request);

  const hasSupabaseConfig = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();
  const claimsEmail = (claims as { email?: string } | null)?.email?.toLowerCase();

  const hasVerifiedSession = Boolean(
    hasSupabaseConfig &&
      claimsEmail &&
      (!ownerEmail || claimsEmail === ownerEmail)
  );

  // Allow local workspace navigation in dev before Supabase Auth env vars are configured
  const allowDevBypass =
    !hasSupabaseConfig && !ownerEmail && process.env.NODE_ENV === "development";

  // Redirect authenticated users away from /login or /register to home
  if (isAuthPage && hasVerifiedSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If protected route and neither verified session nor dev bypass, redirect to /login
  if (!isPublicRoute && !hasVerifiedSession && !allowDevBypass) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt, etc.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
