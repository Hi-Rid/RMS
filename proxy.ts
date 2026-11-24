import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { env } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets, public endpoints, and auth routes are exempt
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/ingest") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/dev") ||
    pathname.startsWith("/_next") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-icon";

  const { supabaseResponse, claims } = await updateSession(request);

  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();
  const claimsEmail = (claims as { email?: string } | null)?.email?.toLowerCase();
  const isAuthenticatedOwner = Boolean(
    ownerEmail ? claimsEmail === ownerEmail : process.env.NODE_ENV === "development"
  );

  // If already logged in and visiting /login, redirect to home
  if (pathname === "/login" && isAuthenticatedOwner) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If protected route and not authenticated, redirect to /login
  if (!isPublicRoute && !isAuthenticatedOwner) {
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
