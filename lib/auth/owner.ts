import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse, connection } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { ensureUserWorkspace } from "@/lib/auth/workspace";

export interface AuthUser {
  id: string;
  email: string;
}

const DEV_FALLBACK_USER_ID = "00000000-0000-0000-0000-000000000000";

export const getOwner = cache(async (): Promise<AuthUser | null> => {
  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();
  const hasSupabaseConfig = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  // In development before Supabase Auth is configured, keep local DB workspace usable
  if (!hasSupabaseConfig && !ownerEmail) {
    if (process.env.NODE_ENV === "development") {
      return { id: DEV_FALLBACK_USER_ID, email: "owner@rms.local" };
    }
    return null;
  }

  if (!hasSupabaseConfig) {
    return null;
  }

  try {
    await connection();
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getClaims();
    const claims = (data?.claims ?? data) as { sub?: string; email?: string } | null;
    const claimsId = claims?.sub;
    const claimsEmail = claims?.email?.toLowerCase();

    if (claimsId && claimsEmail && (!ownerEmail || claimsEmail === ownerEmail)) {
      await ensureUserWorkspace(claimsId);
      return { id: claimsId, email: claimsEmail };
    }

    const { data: userData } = await supabase.auth.getUser();
    const directId = userData?.user?.id;
    const directEmail = userData?.user?.email?.toLowerCase();
    if (directId && directEmail && (!ownerEmail || directEmail === ownerEmail)) {
      await ensureUserWorkspace(directId);
      return { id: directId, email: directEmail };
    }

    return null;
  } catch {
    return null;
  }
});

export async function requirePageOwner(): Promise<AuthUser> {
  const owner = await getOwner();
  if (!owner) {
    redirect("/login");
  }
  return owner;
}

export async function requireActionOwner(): Promise<AuthUser> {
  const owner = await getOwner();
  if (!owner) {
    throw new AppError("unauthorized", "Unauthorized: authenticated session required");
  }
  return owner;
}

export async function requireRouteOwner(): Promise<AuthUser | Response> {
  const owner = await getOwner();
  if (!owner) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  return owner;
}
