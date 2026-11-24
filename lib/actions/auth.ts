"use server";

import { z } from "zod";
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

export async function requestLoginCode(input: {
  email: string;
}): Promise<ActionResult<{ message: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", "Please enter a valid email address");
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();
  const successMessage = "If this email is allowed, we sent a 6-digit code.";

  if (ownerEmail && email === ownerEmail) {
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

  const email = parsed.data.email.trim().toLowerCase();
  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase();

  // Development convenience bypass if Supabase is unconfigured locally
  if (!ownerEmail && process.env.NODE_ENV === "development" && parsed.data.code === "123456") {
    return ok({ email: "owner@folio.local" });
  }

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

    if (data.user.email.toLowerCase() !== ownerEmail) {
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
