"use server";

import crypto from "crypto";
import { eq, sql, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";
import { db, withTx } from "@/lib/db";
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
import { slugify } from "@/lib/domain/normalize";
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
  defaultChecklist: z.array(z.string().trim().min(1).max(120)).min(1),
});

export async function updateGeneralSettings(
  input: z.infer<typeof generalSettingsSchema>
): Promise<ActionResult<void>> {
  await requireActionOwner();

  const parsed = generalSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid general settings");
  }

  try {
    await db
      .update(appSettings)
      .set({
        weeklyPostTarget: parsed.data.weeklyPostTarget,
        insightMinSample: parsed.data.insightMinSample,
        defaultChecklist: parsed.data.defaultChecklist,
        updatedAt: sql`now()`,
      })
      .where(eq(appSettings.id, 1));

    revalidatePath("/");
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

  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid AI settings");
  }

  try {
    await db
      .update(appSettings)
      .set({
        aiEnabled: parsed.data.aiEnabled,
        aiProvider: parsed.data.aiProvider,
        aiTextModel: parsed.data.aiTextModel?.trim() || "gemini-flash-lite-latest",
        aiVisionModel: parsed.data.aiVisionModel?.trim() || null,
        aiDailyCap: parsed.data.aiDailyCap,
        aiOutputLanguage: parsed.data.aiOutputLanguage,
        updatedAt: sql`now()`,
      })
      .where(eq(appSettings.id, 1));

    revalidatePath("/settings");
    revalidatePath("/references");
    revalidatePath("/contents");
    revalidatePath("/insight");

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
  ActionResult<{ message: string; latencyMs: number; model: string }>
> {
  await requireActionOwner();

  const google = getGoogleClient();
  if (!google) {
    return fail("ai_disabled", "No Gemini API key configured in .env.local or environment.");
  }

  const settings = await getAppSettings();
  const start = Date.now();
  try {
    const { text, modelUsed } = await runWithModelFallback(
      async (model, modelName) => {
        const res = await generateText({
          model,
          prompt: "Respond with exactly: 'OK'",
        });
        return { text: res.text.trim(), modelUsed: modelName };
      },
      settings.aiTextModel
    );

    const latencyMs = Date.now() - start;

    await db.insert(systemLogs).values({
      kind: "ai",
      level: "info",
      message: `AI Test Connection successful using ${modelUsed} (${latencyMs}ms)`,
      meta: { response: text, model: modelUsed },
    });

    return ok({ message: `Connected via ${modelUsed}`, latencyMs, model: modelUsed });
  } catch (err: unknown) {
    console.error("AI connection test failed:", err);
    return fail("ai_failed", "AI connection test failed. Check key validity and quota.");
  }
}

export type MasterTableType = "pillars" | "series" | "formats" | "hookTypes" | "platforms";

function getMasterTable(tableType: MasterTableType) {
  switch (tableType) {
    case "pillars":
      return pillars;
    case "series":
      return series;
    case "formats":
      return formats;
    case "hookTypes":
      return hookTypes;
    case "platforms":
      return platforms;
  }
}

function revalidateMasterConsumers() {
  revalidatePath("/settings");
  revalidatePath("/references");
  revalidatePath("/inbox");
  revalidatePath("/inbox/triage");
  revalidatePath("/contents");
  revalidatePath("/contents/new");
  revalidatePath("/");
}

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
    const tbl = getMasterTable(tableType);
    await db
      .update(tbl)
      .set({ isActive, updatedAt: sql`now()` })
      .where(eq(tbl.id, id));

    revalidateMasterConsumers();
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
  name: string,
  extra?: {
    hasCheckpoints?: boolean;
    domains?: string[];
    isSource?: boolean;
    isTarget?: boolean;
  }
): Promise<ActionResult<{ id: string; slug: string; sortOrder: number }>> {
  await requireActionOwner();

  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) {
    return fail("validation", "Name must be between 1 and 60 characters");
  }

  const baseSlug = slugify(trimmed) || `item-${Date.now()}`;

  try {
    const tbl = getMasterTable(tableType);
    const [maxOrderRes] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${tbl.sortOrder}), 0)::int` })
      .from(tbl);
    const nextOrder = (Number(maxOrderRes?.maxOrder) || 0) + 1;

    let newId = "";
    switch (tableType) {
      case "pillars": {
        const [row] = await db
          .insert(pillars)
          .values({ name: trimmed, slug: baseSlug, sortOrder: nextOrder, isActive: true })
          .returning({ id: pillars.id });
        newId = row.id;
        break;
      }
      case "series": {
        const [row] = await db
          .insert(series)
          .values({ name: trimmed, slug: baseSlug, sortOrder: nextOrder, isActive: true })
          .returning({ id: series.id });
        newId = row.id;
        break;
      }
      case "formats": {
        const [row] = await db
          .insert(formats)
          .values({
            name: trimmed,
            slug: baseSlug,
            sortOrder: nextOrder,
            isActive: true,
            hasCheckpoints: extra?.hasCheckpoints ?? true,
          })
          .returning({ id: formats.id });
        newId = row.id;
        break;
      }
      case "hookTypes": {
        const [row] = await db
          .insert(hookTypes)
          .values({ name: trimmed, slug: baseSlug, sortOrder: nextOrder, isActive: true })
          .returning({ id: hookTypes.id });
        newId = row.id;
        break;
      }
      case "platforms": {
        const domainsList =
          extra?.domains && extra.domains.length > 0
            ? extra.domains
            : [`${baseSlug}.com`];
        const [row] = await db
          .insert(platforms)
          .values({
            name: trimmed,
            slug: baseSlug,
            sortOrder: nextOrder,
            isActive: true,
            domains: domainsList,
            isSource: extra?.isSource ?? true,
            isTarget: extra?.isTarget ?? true,
          })
          .returning({ id: platforms.id });
        newId = row.id;
        break;
      }
    }

    revalidateMasterConsumers();
    return ok({ id: newId, slug: baseSlug, sortOrder: nextOrder });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return fail("duplicate", `"${trimmed}" already exists in ${tableType}`);
    }
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
    isSource?: boolean;
    isTarget?: boolean;
  }
): Promise<ActionResult<void>> {
  await requireActionOwner();
  const trimmed = input.name.trim();
  if (!trimmed || trimmed.length > 60) {
    return fail("validation", "Name must be between 1 and 60 characters");
  }

  try {
    switch (tableType) {
      case "pillars":
        await db
          .update(pillars)
          .set({ name: trimmed, updatedAt: sql`now()` })
          .where(eq(pillars.id, id));
        break;
      case "series":
        await db
          .update(series)
          .set({ name: trimmed, updatedAt: sql`now()` })
          .where(eq(series.id, id));
        break;
      case "formats":
        await db
          .update(formats)
          .set({
            name: trimmed,
            updatedAt: sql`now()`,
            ...(input.hasCheckpoints !== undefined ? { hasCheckpoints: input.hasCheckpoints } : {}),
          })
          .where(eq(formats.id, id));
        break;
      case "hookTypes":
        await db
          .update(hookTypes)
          .set({ name: trimmed, updatedAt: sql`now()` })
          .where(eq(hookTypes.id, id));
        break;
      case "platforms":
        await db
          .update(platforms)
          .set({
            name: trimmed,
            updatedAt: sql`now()`,
            ...(input.domains ? { domains: input.domains } : {}),
            ...(input.isSource !== undefined ? { isSource: input.isSource } : {}),
            ...(input.isTarget !== undefined ? { isTarget: input.isTarget } : {}),
          })
          .where(eq(platforms.id, id));
        break;
    }

    revalidateMasterConsumers();
    return ok();
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return fail("duplicate", `"${trimmed}" already exists`);
    }
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
            `Cannot delete: Pillar is currently used by ${totalUsed} reference(s) or content(s). Deactivate it instead.`
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

    revalidateMasterConsumers();
    return ok();
  } catch (err) {
    console.error(`Error deleting master item ${tableType}:`, err);
    return fail("internal", "Failed to delete master item");
  }
}

/**
 * Deterministically swaps sort order of a master data item (Move Up / Move Down).
 */
export async function reorderMasterItem(
  tableType: MasterTableType,
  id: string,
  direction: "up" | "down"
): Promise<ActionResult<{ orderedIds: string[] }>> {
  await requireActionOwner();

  try {
    const tbl = getMasterTable(tableType);
    const orderedIds = await withTx(async (tx) => {
      const rows = await tx
        .select({ id: tbl.id })
        .from(tbl)
        .orderBy(asc(tbl.sortOrder), asc(tbl.name));

      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) return rows.map((r) => r.id);

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= rows.length) {
        return rows.map((r) => r.id);
      }

      const nextRows = [...rows];
      const [moved] = nextRows.splice(idx, 1);
      nextRows.splice(swapIdx, 0, moved);

      for (let i = 0; i < nextRows.length; i++) {
        await tx
          .update(tbl)
          .set({ sortOrder: i + 1 })
          .where(eq(tbl.id, nextRows[i].id));
      }

      return nextRows.map((r) => r.id);
    });

    revalidateMasterConsumers();
    return ok({ orderedIds });
  } catch (err) {
    console.error(`Error reordering master item ${tableType}:`, err);
    return fail("internal", "Failed to reorder master item");
  }
}
