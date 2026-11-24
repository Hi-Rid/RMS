"use server";

import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";
import { db } from "@/lib/db";
import {
  appSettings,
  systemLogs,
  pillars,
  series,
  formats,
  hookTypes,
  platforms,
  refPillars,
  contentPillars,
  refs,
  contents,
  posts,
} from "@/db/schema";
import { getAppSettings } from "@/lib/queries/settings";
import { getGoogleClient, runWithModelFallback } from "@/lib/ai/client";
import { generateText } from "ai";

/**
 * Rotates the Ingest Bearer Token (PRD §11.1 & §11.8).
 */
export async function rotateIngestToken(): Promise<ActionResult<{ token: string }>> {
  await requireActionOwner();

  try {
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const hint = token.slice(-4);

    await db
      .update(appSettings)
      .set({
        ingestTokenHash: tokenHash,
        ingestTokenHint: hint,
        ingestTokenRotatedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(appSettings.id, 1));

    await db.insert(systemLogs).values({
      kind: "ingest",
      level: "info",
      message: "Ingest token rotated by owner",
      meta: { hint },
    });

    revalidatePath("/settings");

    return ok({ token });
  } catch (err) {
    console.error("Error rotating ingest token:", err);
    return fail("internal", "Failed to rotate ingest token");
  }
}

/**
 * Returns current ingest token status (PRD §11.8).
 */
export async function getIngestSettings(): Promise<
  ActionResult<{ hasToken: boolean; weeklyPostTarget: number }>
> {
  await requireActionOwner();
  const settings = await getAppSettings();
  return ok({
    hasToken: settings.hasToken,
    weeklyPostTarget: settings.weeklyPostTarget,
  });
}

const generalSettingsSchema = z.object({
  weeklyPostTarget: z.number().min(0).max(50),
  insightMinSample: z.number().min(1).max(20),
  defaultChecklist: z.array(z.string().min(1)),
});

export async function updateGeneralSettings(
  input: z.infer<typeof generalSettingsSchema>
): Promise<ActionResult<void>> {
  await requireActionOwner();

  try {
    await db
      .update(appSettings)
      .set({
        weeklyPostTarget: input.weeklyPostTarget,
        insightMinSample: input.insightMinSample,
        defaultChecklist: input.defaultChecklist,
        updatedAt: sql`now()`,
      })
      .where(eq(appSettings.id, 1));

    revalidatePath("/settings");
    revalidatePath("/planner");
    revalidatePath("/insight");

    return ok();
  } catch (err) {
    console.error("Error updating general settings:", err);
    return fail("internal", "Failed to update general settings");
  }
}

const aiSettingsSchema = z.object({
  aiEnabled: z.boolean(),
  aiProvider: z.enum(["google", "groq", "openrouter"]),
  aiTextModel: z.string().optional(),
  aiVisionModel: z.string().optional().nullable(),
  aiDailyCap: z.number().min(0).max(5000),
  aiOutputLanguage: z.enum(["id", "en"]),
});

export async function updateAiSettings(
  input: z.infer<typeof aiSettingsSchema>
): Promise<ActionResult<void>> {
  await requireActionOwner();

  try {
    await db
      .update(appSettings)
      .set({
        aiEnabled: input.aiEnabled,
        aiProvider: input.aiProvider,
        aiTextModel: input.aiTextModel || "gemini-flash-lite-latest",
        aiVisionModel: input.aiVisionModel ?? null,
        aiDailyCap: input.aiDailyCap,
        aiOutputLanguage: input.aiOutputLanguage,
        updatedAt: sql`now()`,
      })
      .where(eq(appSettings.id, 1));

    revalidatePath("/settings");

    return ok();
  } catch (err) {
    console.error("Error updating AI settings:", err);
    return fail("internal", "Failed to update AI settings");
  }
}

/**
 * Tests connection to the configured AI model (PRD §12.17 & §14.2).
 */
export async function testAiConnection(): Promise<
  ActionResult<{ message: string; latencyMs: number }>
> {
  await requireActionOwner();

  const google = getGoogleClient();
  if (!google) {
    return fail("ai_disabled", "No Gemini API key configured in .env.local or environment.");
  }

  const start = Date.now();
  try {
    const text = await runWithModelFallback(async (model) => {
      const res = await generateText({
        model,
        prompt: "Respond with exactly: 'OK'",
      });
      return res.text.trim();
    });

    const latencyMs = Date.now() - start;

    await db.insert(systemLogs).values({
      kind: "ai",
      level: "info",
      message: `AI Test Connection successful (${latencyMs}ms)`,
      meta: { response: text },
    });

    return ok({ message: "Connection successful!", latencyMs });
  } catch (err: unknown) {
    console.error("AI connection test failed:", err);
    return fail("ai_failed", "AI connection test failed. Check key validity and quota.");
  }
}

export type MasterTableType = "pillars" | "series" | "formats" | "hookTypes" | "platforms";

/**
 * Toggles an item's active state in Master Data (PRD §12.17).
 */
export async function toggleMasterItem(
  tableType: MasterTableType,
  id: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  await requireActionOwner();

  try {
    switch (tableType) {
      case "pillars":
        await db.update(pillars).set({ isActive }).where(eq(pillars.id, id));
        break;
      case "series":
        await db.update(series).set({ isActive }).where(eq(series.id, id));
        break;
      case "formats":
        await db.update(formats).set({ isActive }).where(eq(formats.id, id));
        break;
      case "hookTypes":
        await db.update(hookTypes).set({ isActive }).where(eq(hookTypes.id, id));
        break;
      case "platforms":
        await db.update(platforms).set({ isActive }).where(eq(platforms.id, id));
        break;
    }

    revalidatePath("/settings");
    return ok();
  } catch (err) {
    console.error(`Error toggling master item ${tableType}:`, err);
    return fail("internal", "Failed to update item status");
  }
}

/**
 * Adds a new item to Master Data.
 */
export async function createMasterItem(
  tableType: MasterTableType,
  name: string
): Promise<ActionResult<{ id: string }>> {
  await requireActionOwner();

  const trimmed = name.trim();
  if (!trimmed) {
    return fail("validation", "Name cannot be empty");
  }

  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  try {
    let newId = "";
    switch (tableType) {
      case "pillars": {
        const [row] = await db
          .insert(pillars)
          .values({ name: trimmed, slug, isActive: true })
          .returning({ id: pillars.id });
        newId = row.id;
        break;
      }
      case "series": {
        const [row] = await db
          .insert(series)
          .values({ name: trimmed, slug, isActive: true })
          .returning({ id: series.id });
        newId = row.id;
        break;
      }
      case "formats": {
        const [row] = await db
          .insert(formats)
          .values({ name: trimmed, slug, isActive: true, hasCheckpoints: true })
          .returning({ id: formats.id });
        newId = row.id;
        break;
      }
      case "hookTypes": {
        const [row] = await db
          .insert(hookTypes)
          .values({ name: trimmed, slug, isActive: true })
          .returning({ id: hookTypes.id });
        newId = row.id;
        break;
      }
      case "platforms": {
        const [row] = await db
          .insert(platforms)
          .values({ name: trimmed, slug, isActive: true, domains: [slug] })
          .returning({ id: platforms.id });
        newId = row.id;
        break;
      }
    }

    revalidatePath("/settings");
    return ok({ id: newId });
  } catch (err) {
    console.error(`Error creating master item ${tableType}:`, err);
    return fail("internal", "Failed to create master item");
  }
}

/**
 * Updates a master data item (Rename & configuration attributes).
 */
export async function updateMasterItem(
  tableType: MasterTableType,
  id: string,
  input: {
    name: string;
    hasCheckpoints?: boolean;
    domains?: string[];
  }
): Promise<ActionResult<void>> {
  await requireActionOwner();
  const trimmed = input.name.trim();
  if (!trimmed) {
    return fail("validation", "Name cannot be empty");
  }

  try {
    switch (tableType) {
      case "pillars":
        await db.update(pillars).set({ name: trimmed }).where(eq(pillars.id, id));
        break;
      case "series":
        await db.update(series).set({ name: trimmed }).where(eq(series.id, id));
        break;
      case "formats":
        await db
          .update(formats)
          .set({
            name: trimmed,
            ...(input.hasCheckpoints !== undefined ? { hasCheckpoints: input.hasCheckpoints } : {}),
          })
          .where(eq(formats.id, id));
        break;
      case "hookTypes":
        await db.update(hookTypes).set({ name: trimmed }).where(eq(hookTypes.id, id));
        break;
      case "platforms":
        await db
          .update(platforms)
          .set({
            name: trimmed,
            ...(input.domains ? { domains: input.domains } : {}),
          })
          .where(eq(platforms.id, id));
        break;
    }

    revalidatePath("/settings");
    return ok();
  } catch (err) {
    console.error(`Error updating master item ${tableType}:`, err);
    return fail("internal", "Failed to update master item");
  }
}

/**
 * Safely deletes a master data item with usage verification (PRD §12.17).
 */
export async function deleteMasterItem(
  tableType: MasterTableType,
  id: string
): Promise<ActionResult<void>> {
  await requireActionOwner();

  try {
    switch (tableType) {
      case "pillars": {
        const [refUsage, contentUsage] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(refPillars)
            .where(eq(refPillars.pillarId, id)),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(contentPillars)
            .where(eq(contentPillars.pillarId, id)),
        ]);
        const totalUsed = (refUsage[0]?.count || 0) + (contentUsage[0]?.count || 0);
        if (totalUsed > 0) {
          return fail(
            "blocked",
            `Cannot delete: Pillar is currently in use by ${totalUsed} reference(s) or content(s). Deactivate it instead.`
          );
        }
        await db.delete(pillars).where(eq(pillars.id, id));
        break;
      }
      case "series": {
        const [usage] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(contents)
          .where(eq(contents.seriesId, id));
        if ((usage?.count || 0) > 0) {
          return fail(
            "blocked",
            `Cannot delete: Series is in use by ${usage.count} content(s). Deactivate it instead.`
          );
        }
        await db.delete(series).where(eq(series.id, id));
        break;
      }
      case "formats": {
        const [refUsage, contentUsage] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(refs)
            .where(eq(refs.formatId, id)),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(contents)
            .where(eq(contents.formatId, id)),
        ]);
        const totalUsed = (refUsage[0]?.count || 0) + (contentUsage[0]?.count || 0);
        if (totalUsed > 0) {
          return fail(
            "blocked",
            `Cannot delete: Format is in use by ${totalUsed} item(s). Deactivate it instead.`
          );
        }
        await db.delete(formats).where(eq(formats.id, id));
        break;
      }
      case "hookTypes": {
        const [refUsage, contentUsage] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(refs)
            .where(eq(refs.hookTypeId, id)),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(contents)
            .where(eq(contents.hookTypeId, id)),
        ]);
        const totalUsed = (refUsage[0]?.count || 0) + (contentUsage[0]?.count || 0);
        if (totalUsed > 0) {
          return fail(
            "blocked",
            `Cannot delete: Hook type is in use by ${totalUsed} item(s). Deactivate it instead.`
          );
        }
        await db.delete(hookTypes).where(eq(hookTypes.id, id));
        break;
      }
      case "platforms": {
        const [refUsage, postUsage] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(refs)
            .where(eq(refs.platformId, id)),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(posts)
            .where(eq(posts.platformId, id)),
        ]);
        const totalUsed = (refUsage[0]?.count || 0) + (postUsage[0]?.count || 0);
        if (totalUsed > 0) {
          return fail(
            "blocked",
            `Cannot delete: Platform is in use by ${totalUsed} item(s). Deactivate it instead.`
          );
        }
        await db.delete(platforms).where(eq(platforms.id, id));
        break;
      }
    }

    revalidatePath("/settings");
    return ok();
  } catch (err) {
    console.error(`Error deleting master item ${tableType}:`, err);
    return fail("internal", "Failed to delete master item");
  }
}

/**
 * Changes sort order of a master data item (Move Up / Move Down).
 */
export async function reorderMasterItem(
  tableType: MasterTableType,
  id: string,
  direction: "up" | "down"
): Promise<ActionResult<void>> {
  await requireActionOwner();
  const delta = direction === "up" ? -1 : 1;

  try {
    switch (tableType) {
      case "pillars":
        await db
          .update(pillars)
          .set({ sortOrder: sql`${pillars.sortOrder} + ${delta}` })
          .where(eq(pillars.id, id));
        break;
      case "series":
        await db
          .update(series)
          .set({ sortOrder: sql`${series.sortOrder} + ${delta}` })
          .where(eq(series.id, id));
        break;
      case "formats":
        await db
          .update(formats)
          .set({ sortOrder: sql`${formats.sortOrder} + ${delta}` })
          .where(eq(formats.id, id));
        break;
      case "hookTypes":
        await db
          .update(hookTypes)
          .set({ sortOrder: sql`${hookTypes.sortOrder} + ${delta}` })
          .where(eq(hookTypes.id, id));
        break;
      case "platforms":
        await db
          .update(platforms)
          .set({ sortOrder: sql`${platforms.sortOrder} + ${delta}` })
          .where(eq(platforms.id, id));
        break;
    }

    revalidatePath("/settings");
    return ok();
  } catch (err) {
    console.error(`Error reordering master item ${tableType}:`, err);
    return fail("internal", "Failed to reorder master item");
  }
}
