"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

const requestSchema = z.object({
  email: z.string().email(),
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const passwordLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long."),
});

function hasSupabaseConfig(): boolean {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

async function resolveAppOrigin(): Promise<string> {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured && !configured.includes("localhost")) {
    return configured;
  }

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  } catch {
    // Fallback below if headers() is unavailable
  }

  return configured || "http://localhost:3000";
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ email: string }>> {
  const parsed = passwordLoginSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid credentials.");
  }

  if (!hasSupabaseConfig()) {
    return fail(
      "blocked",
      "Supabase Auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local."
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();

  if (ownerEmail && email !== ownerEmail) {
    return fail("unauthorized", "Invalid email or password.");
  }

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });

    if (error || !data.user || !data.user.email) {
      const msg = error?.message?.toLowerCase() || "";
      if (msg.includes("email not confirmed")) {
        return fail(
          "unauthorized",
          "Your email address has not been verified yet.",
          { reason: "email_unconfirmed" }
        );
      }
      return fail("unauthorized", "Invalid email or password.");
    }

    if (ownerEmail && data.user.email.toLowerCase() !== ownerEmail) {
      await supabase.auth.signOut();
      return fail("unauthorized", "Unauthorized account.");
    }

    return ok({ email: data.user.email });
  } catch {
    return fail("unauthorized", "Sign in failed. Please try again.");
  }
}

export async function registerWithPassword(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ email: string; needsEmailVerification: boolean }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid registration details.");
  }

  if (!hasSupabaseConfig()) {
    return fail(
      "blocked",
      "Supabase Auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local."
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();

  if (ownerEmail && email !== ownerEmail) {
    return fail(
      "blocked",
      "Registration is restricted to the configured owner account."
    );
  }

  const appUrl = await resolveAppOrigin();

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${appUrl}/auth/confirm`,
      },
    });

    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("already registered") || msg.includes("already exists")) {
        return fail("conflict", "An account with this email already exists. Try signing in.");
      }
      return fail("validation", error.message || "Could not create account.");
    }

    // Supabase returns empty identities array when email is already registered without throwing
    if (
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      return fail("conflict", "An account with this email already exists. Try signing in.");
    }

    return ok({
      email: data.user?.email || email,
      needsEmailVerification: !data.session,
    });
  } catch {
    return fail("internal", "Registration failed. Please try again.");
  }
}

export async function resendVerificationEmail(input: {
  email: string;
}): Promise<ActionResult<{ message: string }>> {
  const parsed = requestSchema.safeParse({ email: input.email.trim() });
  if (!parsed.success) {
    return fail("validation", "Please enter a valid email address.");
  }

  if (!hasSupabaseConfig()) {
    return fail(
      "blocked",
      "Supabase Auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local."
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();
  const message =
    "If this account awaits verification, a fresh confirmation link has been sent.";

  if (!ownerEmail || email === ownerEmail) {
    try {
      const appUrl = await resolveAppOrigin();
      const supabase = await createServerClient();
      await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${appUrl}/auth/confirm`,
        },
      });
    } catch (err) {
      console.error("resendVerificationEmail error:", err);
    }
  }

  return ok({ message });
}

export async function requestLoginCode(input: {
  email: string;
}): Promise<ActionResult<{ message: string }>> {
  const parsed = requestSchema.safeParse({ email: input.email.trim() });
  if (!parsed.success) {
    return fail("validation", "Please enter a valid email address.");
  }

  if (!hasSupabaseConfig()) {
    return fail(
      "blocked",
      "Supabase Auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local."
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();
  const successMessage = "If this account exists, we sent a 6-digit code.";

  if (!ownerEmail || email === ownerEmail) {
    try {
      const supabase = await createServerClient();
      await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });
    } catch (err) {
      console.error("signInWithOtp error:", err);
    }
  }

  return ok({ message: successMessage });
}

export async function verifyLoginCode(input: {
  email: string;
  code: string;
}): Promise<ActionResult<{ email: string }>> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", "Please enter a valid 6-digit verification code");
  }

  if (!hasSupabaseConfig()) {
    return fail(
      "blocked",
      "Supabase Auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local."
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: parsed.data.code,
      type: "email",
    });

    if (error || !data.user || !data.user.email) {
      return fail("unauthorized", "That code didn't work. Check it or request a new one.");
    }

    if (ownerEmail && data.user.email.toLowerCase() !== ownerEmail) {
      await supabase.auth.signOut();
      return fail("unauthorized", "Unauthorized account");
    }

    return ok({ email: data.user.email });
  } catch {
    return fail("unauthorized", "Verification failed. Please try again.");
  }
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await createServerClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore sign-out errors
  }
  redirect("/login");
}
