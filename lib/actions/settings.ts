"use server";

import crypto from "crypto";
import { and, eq, sql, asc } from "drizzle-orm";
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
import { invalidateReferenceMasterCache } from "@/lib/queries/references";
import { getGoogleClient, runWithModelFallback } from "@/lib/ai/client";
import { slugify } from "@/lib/domain/normalize";
import { generateText } from "ai";

/**
 * Rotates the Ingest Bearer Token (PRD §11.1 & §11.8).
 */
export async function rotateIngestToken(): Promise<ActionResult<{ token: string }>> {
  const user = await requireActionOwner();

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
      .where(eq(appSettings.userId, user.id));

    await db.insert(systemLogs).values({
      userId: user.id,
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
  const user = await requireActionOwner();
  const settings = await getAppSettings(user.id);
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
  const user = await requireActionOwner();

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
      .where(eq(appSettings.userId, user.id));

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
  aiAutoEnrich: z.boolean().optional(),
  aiIngestMode: z.enum(["inbox", "selected", "auto_draft"]).optional(),
  creatorNiche: z.string().trim().max(240).optional().nullable(),
  creatorAudience: z.string().trim().max(240).optional().nullable(),
  creatorVoice: z.string().trim().max(240).optional().nullable(),
});

export async function updateAiSettings(
  input: z.infer<typeof aiSettingsSchema>
): Promise<ActionResult<void>> {
  const user = await requireActionOwner();

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
        ...(parsed.data.aiAutoEnrich !== undefined
          ? { aiAutoEnrich: parsed.data.aiAutoEnrich }
          : {}),
        ...(parsed.data.aiIngestMode !== undefined
          ? { aiIngestMode: parsed.data.aiIngestMode }
          : {}),
        ...(parsed.data.creatorNiche !== undefined
          ? { creatorNiche: parsed.data.creatorNiche?.trim() || null }
          : {}),
        ...(parsed.data.creatorAudience !== undefined
          ? { creatorAudience: parsed.data.creatorAudience?.trim() || null }
          : {}),
        ...(parsed.data.creatorVoice !== undefined
          ? { creatorVoice: parsed.data.creatorVoice?.trim() || null }
          : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(appSettings.userId, user.id));

    revalidatePath("/settings");
    revalidatePath("/references");
    revalidatePath("/inbox");
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
  const user = await requireActionOwner();

  const google = getGoogleClient();
  if (!google) {
    return fail("ai_disabled", "No Gemini API key configured in .env.local or environment.");
  }

  const settings = await getAppSettings(user.id);
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
      userId: user.id,
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

function revalidateMasterConsumers(userId: string) {
  invalidateReferenceMasterCache(userId);
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
  const user = await requireActionOwner();

  try {
    const tbl = getMasterTable(tableType);
    const [updated] = await db
      .update(tbl)
      .set({ isActive, updatedAt: sql`now()` })
      .where(and(eq(tbl.id, id), eq(tbl.userId, user.id)))
      .returning({ id: tbl.id });

    if (!updated) {
      return fail("not_found", "Master item not found");
    }

    revalidateMasterConsumers(user.id);
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
  const user = await requireActionOwner();

  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) {
    return fail("validation", "Name must be between 1 and 60 characters");
  }

  const baseSlug = slugify(trimmed) || `item-${Date.now()}`;

  try {
    const tbl = getMasterTable(tableType);
    const [maxOrderRes] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${tbl.sortOrder}), 0)::int` })
      .from(tbl)
      .where(eq(tbl.userId, user.id));
    const nextOrder = (Number(maxOrderRes?.maxOrder) || 0) + 1;

    let newId = "";
    switch (tableType) {
      case "pillars": {
        const [row] = await db
          .insert(pillars)
          .values({
            userId: user.id,
            name: trimmed,
            slug: baseSlug,
            sortOrder: nextOrder,
            isActive: true,
          })
          .returning({ id: pillars.id });
        newId = row.id;
        break;
      }
      case "series": {
        const [row] = await db
          .insert(series)
          .values({
            userId: user.id,
            name: trimmed,
            slug: baseSlug,
            sortOrder: nextOrder,
            isActive: true,
          })
          .returning({ id: series.id });
        newId = row.id;
        break;
      }
      case "formats": {
        const [row] = await db
          .insert(formats)
          .values({
            userId: user.id,
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
          .values({
            userId: user.id,
            name: trimmed,
            slug: baseSlug,
            sortOrder: nextOrder,
            isActive: true,
          })
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
            userId: user.id,
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

    revalidateMasterConsumers(user.id);
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
  const user = await requireActionOwner();
  const trimmed = input.name.trim();
  if (!trimmed || trimmed.length > 60) {
    return fail("validation", "Name must be between 1 and 60 characters");
  }

  try {
    let updatedId: string | undefined;
    switch (tableType) {
      case "pillars": {
        const [row] = await db
          .update(pillars)
          .set({ name: trimmed, updatedAt: sql`now()` })
          .where(and(eq(pillars.id, id), eq(pillars.userId, user.id)))
          .returning({ id: pillars.id });
        updatedId = row?.id;
        break;
      }
      case "series": {
        const [row] = await db
          .update(series)
          .set({ name: trimmed, updatedAt: sql`now()` })
          .where(and(eq(series.id, id), eq(series.userId, user.id)))
          .returning({ id: series.id });
        updatedId = row?.id;
        break;
      }
      case "formats": {
        const [row] = await db
          .update(formats)
          .set({
            name: trimmed,
            updatedAt: sql`now()`,
            ...(input.hasCheckpoints !== undefined ? { hasCheckpoints: input.hasCheckpoints } : {}),
          })
          .where(and(eq(formats.id, id), eq(formats.userId, user.id)))
          .returning({ id: formats.id });
        updatedId = row?.id;
        break;
      }
      case "hookTypes": {
        const [row] = await db
          .update(hookTypes)
          .set({ name: trimmed, updatedAt: sql`now()` })
          .where(and(eq(hookTypes.id, id), eq(hookTypes.userId, user.id)))
          .returning({ id: hookTypes.id });
        updatedId = row?.id;
        break;
      }
      case "platforms": {
        const [row] = await db
          .update(platforms)
          .set({
            name: trimmed,
            updatedAt: sql`now()`,
            ...(input.domains ? { domains: input.domains } : {}),
            ...(input.isSource !== undefined ? { isSource: input.isSource } : {}),
            ...(input.isTarget !== undefined ? { isTarget: input.isTarget } : {}),
          })
          .where(and(eq(platforms.id, id), eq(platforms.userId, user.id)))
          .returning({ id: platforms.id });
        updatedId = row?.id;
        break;
      }
    }

    if (!updatedId) {
      return fail("not_found", "Master item not found");
    }

    revalidateMasterConsumers(user.id);
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
  const user = await requireActionOwner();

  try {
    const tbl = getMasterTable(tableType);
    const [existing] = await db
      .select({ id: tbl.id })
      .from(tbl)
      .where(and(eq(tbl.id, id), eq(tbl.userId, user.id)))
      .limit(1);

    if (!existing) {
      return fail("not_found", "Master item not found");
    }

    switch (tableType) {
      case "pillars": {
        const [refUsage, contentUsage] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(refPillars)
            .innerJoin(refs, eq(refPillars.refId, refs.id))
            .where(and(eq(refPillars.pillarId, id), eq(refs.userId, user.id))),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(contentPillars)
            .innerJoin(contents, eq(contentPillars.contentId, contents.id))
            .where(and(eq(contentPillars.pillarId, id), eq(contents.userId, user.id))),
        ]);
        const totalUsed = (refUsage[0]?.count || 0) + (contentUsage[0]?.count || 0);
        if (totalUsed > 0) {
          return fail(
            "blocked",
            `Cannot delete: Pillar is currently used by ${totalUsed} reference(s) or content(s). Deactivate it instead.`
          );
        }
        await db.delete(pillars).where(and(eq(pillars.id, id), eq(pillars.userId, user.id)));
        break;
      }
      case "series": {
        const [usage] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(contents)
          .where(and(eq(contents.seriesId, id), eq(contents.userId, user.id)));
        if ((usage?.count || 0) > 0) {
          return fail(
            "blocked",
            `Cannot delete: Series is in use by ${usage.count} content(s). Deactivate it instead.`
          );
        }
        await db.delete(series).where(and(eq(series.id, id), eq(series.userId, user.id)));
        break;
      }
      case "formats": {
        const [refUsage, contentUsage] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(refs)
            .where(and(eq(refs.formatId, id), eq(refs.userId, user.id))),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(contents)
            .where(and(eq(contents.formatId, id), eq(contents.userId, user.id))),
        ]);
        const totalUsed = (refUsage[0]?.count || 0) + (contentUsage[0]?.count || 0);
        if (totalUsed > 0) {
          return fail(
            "blocked",
            `Cannot delete: Format is in use by ${totalUsed} item(s). Deactivate it instead.`
          );
        }
        await db.delete(formats).where(and(eq(formats.id, id), eq(formats.userId, user.id)));
        break;
      }
      case "hookTypes": {
        const [refUsage, contentUsage] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(refs)
            .where(and(eq(refs.hookTypeId, id), eq(refs.userId, user.id))),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(contents)
            .where(and(eq(contents.hookTypeId, id), eq(contents.userId, user.id))),
        ]);
        const totalUsed = (refUsage[0]?.count || 0) + (contentUsage[0]?.count || 0);
        if (totalUsed > 0) {
          return fail(
            "blocked",
            `Cannot delete: Hook type is in use by ${totalUsed} item(s). Deactivate it instead.`
          );
        }
        await db.delete(hookTypes).where(and(eq(hookTypes.id, id), eq(hookTypes.userId, user.id)));
        break;
      }
      case "platforms": {
        const [refUsage, postUsage] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(refs)
            .where(and(eq(refs.platformId, id), eq(refs.userId, user.id))),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(posts)
            .where(and(eq(posts.platformId, id), eq(posts.userId, user.id))),
        ]);
        const totalUsed = (refUsage[0]?.count || 0) + (postUsage[0]?.count || 0);
        if (totalUsed > 0) {
          return fail(
            "blocked",
            `Cannot delete: Platform is in use by ${totalUsed} item(s). Deactivate it instead.`
          );
        }
        await db.delete(platforms).where(and(eq(platforms.id, id), eq(platforms.userId, user.id)));
        break;
      }
    }

    revalidateMasterConsumers(user.id);
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
  const user = await requireActionOwner();

  try {
    const tbl = getMasterTable(tableType);
    const orderedIds = await withTx(async (tx) => {
      const rows = await tx
        .select({ id: tbl.id })
        .from(tbl)
        .where(eq(tbl.userId, user.id))
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
          .where(and(eq(tbl.id, nextRows[i].id), eq(tbl.userId, user.id)));
      }

      return nextRows.map((r) => r.id);
    });

    revalidateMasterConsumers(user.id);
    return ok({ orderedIds });
  } catch (err) {
    console.error(`Error reordering master item ${tableType}:`, err);
    return fail("internal", "Failed to reorder master item");
  }
}
