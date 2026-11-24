"use server";

import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";
import { db } from "@/lib/db";
import { appSettings, systemLogs } from "@/db/schema";

/**
 * Rotates the Ingest Bearer Token (PRD §11.1 & §11.8).
 * Generates a random 32-byte base64url string, stores only its SHA-256 hash in app_settings,
 * and returns the plaintext token to the owner once.
 */
export async function rotateIngestToken(): Promise<ActionResult<{ token: string }>> {
  await requireActionOwner();

  try {
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await db
      .update(appSettings)
      .set({
        ingestTokenHash: tokenHash,
        updatedAt: sql`now()`,
      })
      .where(eq(appSettings.id, 1));

    // Audit log (token is never logged!)
    await db.insert(systemLogs).values({
      kind: "ingest",
      level: "info",
      message: "Ingest token rotated by owner",
      meta: {},
    });

    revalidatePath("/settings");

    return ok({ token });
  } catch (err) {
    console.error("Error rotating ingest token:", err);
    return fail("internal", "Failed to rotate ingest token");
  }
}

import { getAppSettings } from "@/lib/queries/settings";

/**
 * Returns current ingest token status (PRD §11.8).
 */
export async function getIngestSettings(): Promise<
  ActionResult<{ hasToken: boolean; weeklyPostTarget: number }>
> {
  await requireActionOwner();
  const settings = await getAppSettings();
  return ok(settings);
}
