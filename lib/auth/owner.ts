import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export async function getOwner(): Promise<{ email: string } | null> {
  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();
  const hasSupabaseConfig = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  // In development before Supabase Auth is configured, keep local DB workspace usable
  if (!hasSupabaseConfig && !ownerEmail) {
    if (process.env.NODE_ENV === "development") {
      return { email: "owner@rms.local" };
    }
    return null;
  }

  if (!hasSupabaseConfig) {
    return null;
  }

  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getClaims();
    const claims = (data?.claims ?? data) as { email?: string } | null;
    const userEmail = claims?.email?.toLowerCase();

    if (userEmail && (!ownerEmail || userEmail === ownerEmail)) {
      return { email: userEmail };
    }

    const { data: userData } = await supabase.auth.getUser();
    const directEmail = userData?.user?.email?.toLowerCase();
    if (directEmail && (!ownerEmail || directEmail === ownerEmail)) {
      return { email: directEmail };
    }

    return null;
  } catch {
    return null;
  }
}

export async function requirePageOwner(): Promise<{ email: string }> {
  const owner = await getOwner();
  if (!owner) {
    redirect("/login");
  }
  return owner;
}

export async function requireActionOwner(): Promise<{ email: string }> {
  const owner = await getOwner();
  if (!owner) {
    throw new AppError("unauthorized", "Unauthorized: authenticated session required");
  }
  return owner;
}

export async function requireRouteOwner(): Promise<{ email: string } | Response> {
  const owner = await getOwner();
  if (!owner) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  return owner;
}
