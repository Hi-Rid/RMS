"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { refs, refPillars, refElements, sourceAccounts, audios, pillars } from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";
import { normalizeUrl, extractUrls } from "@/lib/domain/url";
import { normalizeHandle, normalizeTag } from "@/lib/domain/normalize";
import { isAllowedRefTransition } from "@/lib/domain/status";
import {
  getPlatformIdBySlug,
  getFormatIdBySlug,
  findExistingReference,
  createReferenceRecord,
} from "@/lib/queries/references";

const createFromUrlSchema = z.object({
  input: z.string().min(1, "URL or text is required"),
});

const createFromTextSchema = z.object({
  text: z.string().min(1, "Text input is required"),
});

const previewImportSchema = z.object({
  text: z.string().min(1, "File or text content is required"),
});

const importUrlsSchema = z.object({
  urls: z.array(z.string()).min(1).max(500),
});

export interface ReferenceCreationResult {
  status: "created" | "duplicate";
  id: string;
  archived?: boolean;
}

/**
 * Creates a reference from a single raw URL or conversational share text (PRD §10.1 - §10.2).
 */
export async function createReferenceFromUrl(
  input: z.infer<typeof createFromUrlSchema>
): Promise<ActionResult<ReferenceCreationResult>> {
  const user = await requireActionOwner();

  const parsed = createFromUrlSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  try {
    const normalized = await normalizeUrl(parsed.data.input);
    const platformId = await getPlatformIdBySlug(normalized.platform, user.id);
    const formatId = await getFormatIdBySlug(normalized.format, user.id);

    const record = await createReferenceRecord({
      userId: user.id,
      url: normalized.url,
      urlOriginal: parsed.data.input.trim(),
      platformId,
      externalId: normalized.externalId,
      formatId,
    });

    revalidatePath("/");
    revalidatePath("/inbox");
    revalidatePath("/references");

    return ok({
      status: record.isDuplicate ? "duplicate" : "created",
      id: record.id,
      archived: record.archived,
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "invalid_url") {
      return fail("invalid_url", e.message || "Invalid URL");
    }
    console.error("Error creating reference:", err);
    return fail("internal", "Failed to save reference");
  }
}

export interface BatchItemResult {
  input: string;
  status: "created" | "duplicate" | "invalid";
  id?: string;
  message?: string;
}

/**
 * Creates references in batch from pasted text (up to 50 URLs, PRD §11.8 / FR-08).
 */
export async function createReferencesFromText(
  input: z.infer<typeof createFromTextSchema>
): Promise<ActionResult<{ results: BatchItemResult[]; totalProcessed: number; createdCount: number }>> {
  const user = await requireActionOwner();

  const parsed = createFromTextSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  const rawUrls = extractUrls(parsed.data.text);
  if (rawUrls.length === 0) {
    // If no URLs extracted via regex, try the raw input as a single bare domain/path
    const trimmed = parsed.data.text.trim();
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\/[^\s]+$/.test(trimmed)) {
      rawUrls.push(`https://${trimmed}`);
    } else {
      return fail("validation", "No valid URLs found in text");
    }
  }

  // Cap at 50 URLs
  const urlsToProcess = rawUrls.slice(0, 50);
  const results: BatchItemResult[] = [];
  let createdCount = 0;

  for (const raw of urlsToProcess) {
    try {
      const normalized = await normalizeUrl(raw);
      const platformId = await getPlatformIdBySlug(normalized.platform, user.id);
      const formatId = await getFormatIdBySlug(normalized.format, user.id);

      const record = await createReferenceRecord({
        userId: user.id,
        url: normalized.url,
        urlOriginal: raw,
        platformId,
        externalId: normalized.externalId,
        formatId,
      });

      if (!record.isDuplicate) {
        createdCount++;
      }

      results.push({
        input: raw,
        status: record.isDuplicate ? "duplicate" : "created",
        id: record.id,
        message: record.isDuplicate
          ? record.archived
            ? "Already saved (archived)"
            : "Already in references"
          : "Saved to inbox",
      });
    } catch {
      results.push({
        input: raw,
        status: "invalid",
        message: "Failed to parse or invalid URL",
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/references");

  return ok({
    results,
    totalProcessed: urlsToProcess.length,
    createdCount,
  });
}

export interface ImportPreviewItem {
  url: string;
  platform: string;
  status: "new" | "duplicate";
  archived?: boolean;
}

/**
 * Previews URLs extracted from export file or text without saving to database (PRD §11.8 / FR-09).
 */
export async function previewImport(
  input: z.infer<typeof previewImportSchema>
): Promise<
  ActionResult<{
    total: number;
    newCount: number;
    duplicateCount: number;
    items: ImportPreviewItem[];
  }>
> {
  const user = await requireActionOwner();

  const parsed = previewImportSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", "Invalid text content");
  }

  const rawUrls = extractUrls(parsed.data.text);
  // Deduplicate URLs inside the import file first (PRD §10.1)
  const uniqueUrls = Array.from(new Set(rawUrls)).slice(0, 500);

  if (uniqueUrls.length === 0) {
    return fail("validation", "No valid post URLs found in file");
  }

  const items: ImportPreviewItem[] = [];
  let newCount = 0;
  let duplicateCount = 0;

  for (const raw of uniqueUrls) {
    try {
      const normalized = await normalizeUrl(raw);
      const platformId = await getPlatformIdBySlug(normalized.platform, user.id);

      const existing = await findExistingReference({
        userId: user.id,
        platformId,
        externalId: normalized.externalId,
        url: normalized.url,
      });

      if (existing) {
        duplicateCount++;
        items.push({
          url: normalized.url,
          platform: normalized.platform,
          status: "duplicate",
          archived: Boolean(existing.archivedAt),
        });
      } else {
        newCount++;
        items.push({
          url: normalized.url,
          platform: normalized.platform,
          status: "new",
        });
      }
    } catch {
      // Skip unparseable URLs during preview
    }
  }

  return ok({
    total: items.length,
    newCount,
    duplicateCount,
    items,
  });
}

/**
 * Imports confirmed URLs after preview (PRD §11.8 / FR-09).
 */
export async function importReferencesFromUrls(
  input: z.infer<typeof importUrlsSchema>
): Promise<ActionResult<{ created: number; duplicates: number }>> {
  const user = await requireActionOwner();

  const parsed = importUrlsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", "Invalid list of URLs");
  }

  let created = 0;
  let duplicates = 0;

  for (const url of parsed.data.urls) {
    try {
      const normalized = await normalizeUrl(url);
      const platformId = await getPlatformIdBySlug(normalized.platform, user.id);
      const formatId = await getFormatIdBySlug(normalized.format, user.id);

      const res = await createReferenceRecord({
        userId: user.id,
        url: normalized.url,
        urlOriginal: url,
        platformId,
        externalId: normalized.externalId,
        formatId,
      });

      if (res.isDuplicate) {
        duplicates++;
      } else {
        created++;
      }
    } catch {
      // Continue importing remaining URLs
    }
  }

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/references");

  return ok({ created, duplicates });
}

const setStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["inbox", "selected"]),
});

/**
 * Transitions reference between inbox <-> selected (PRD §10.3 / §11.8).
 */
export async function setReferenceStatus(
  input: z.infer<typeof setStatusSchema>
): Promise<ActionResult<{ id: string; status: string }>> {
  const user = await requireActionOwner();

  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid status transition");
  }

  const [ref] = await db
    .select({ id: refs.id, status: refs.status, contentId: refs.contentId })
    .from(refs)
    .where(and(eq(refs.id, parsed.data.id), eq(refs.userId, user.id)))
    .limit(1);

  if (!ref) {
    return fail("not_found", "Reference not found");
  }

  if (!isAllowedRefTransition(ref.status, parsed.data.status, Boolean(ref.contentId))) {
    return fail("blocked", `Cannot move reference from ${ref.status} to ${parsed.data.status}`);
  }

  await db
    .update(refs)
    .set({
      status: parsed.data.status,
      statusChangedAt: sql`now()`,
    })
    .where(and(eq(refs.id, parsed.data.id), eq(refs.userId, user.id)));

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/inbox/triage");
  revalidatePath("/references");
  revalidatePath(`/references/${parsed.data.id}`);

  return ok({ id: parsed.data.id, status: parsed.data.status });
}

const skipSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().optional(),
});

/**
 * Marks reference as skipped with optional reason (PRD §10.3 / §11.8).
 */
export async function skipReference(
  input: z.infer<typeof skipSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = skipSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", "Invalid reference ID");
  }

  const [ref] = await db
    .select({ id: refs.id, status: refs.status, contentId: refs.contentId })
    .from(refs)
    .where(and(eq(refs.id, parsed.data.id), eq(refs.userId, user.id)))
    .limit(1);

  if (!ref) {
    return fail("not_found", "Reference not found");
  }

  if (Boolean(ref.contentId)) {
    return fail("blocked", "Cannot skip reference attached to content");
  }

  await db
    .update(refs)
    .set({
      status: "skipped",
      skippedReason: parsed.data.reason?.trim() || null,
      statusChangedAt: sql`now()`,
    })
    .where(and(eq(refs.id, parsed.data.id), eq(refs.userId, user.id)));

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/inbox/triage");
  revalidatePath("/references");

  return ok({ id: parsed.data.id });
}

const unskipSchema = z.object({
  id: z.string().uuid(),
  to: z.enum(["inbox", "selected"]).optional().default("inbox"),
});

/**
 * Restores a skipped reference back to inbox or selected.
 */
export async function unskipReference(
  input: z.infer<typeof unskipSchema>
): Promise<ActionResult<{ id: string; status: string }>> {
  const user = await requireActionOwner();

  const parsed = unskipSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", "Invalid parameters");
  }

  const [updated] = await db
    .update(refs)
    .set({
      status: parsed.data.to,
      skippedReason: null,
      statusChangedAt: sql`now()`,
    })
    .where(and(eq(refs.id, parsed.data.id), eq(refs.userId, user.id)))
    .returning({ id: refs.id });

  if (!updated) {
    return fail("not_found", "Reference not found");
  }

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/references");

  return ok({ id: parsed.data.id, status: parsed.data.to });
}

const idSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Soft archives a reference (PRD §10.11).
 */
export async function archiveReference(
  input: z.infer<typeof idSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid ID");

  const [updated] = await db
    .update(refs)
    .set({ archivedAt: sql`now()` })
    .where(and(eq(refs.id, parsed.data.id), eq(refs.userId, user.id)))
    .returning({ id: refs.id });

  if (!updated) return fail("not_found", "Reference not found");

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/references");

  return ok({ id: parsed.data.id });
}

/**
 * Restores an archived reference.
 */
export async function restoreReference(
  input: z.infer<typeof idSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid ID");

  const [updated] = await db
    .update(refs)
    .set({ archivedAt: null })
    .where(and(eq(refs.id, parsed.data.id), eq(refs.userId, user.id)))
    .returning({ id: refs.id });

  if (!updated) return fail("not_found", "Reference not found");

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/references");

  return ok({ id: parsed.data.id });
}

/**
 * Permanently deletes a reference (blocked if attached to content, PRD §10.11).
 */
export async function deleteReferencePermanently(
  input: z.infer<typeof idSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid ID");

  const [ref] = await db
    .select({ id: refs.id, contentId: refs.contentId })
    .from(refs)
    .where(and(eq(refs.id, parsed.data.id), eq(refs.userId, user.id)))
    .limit(1);

  if (!ref) return fail("not_found", "Reference not found");
  if (ref.contentId) {
    return fail("blocked", "Cannot delete reference that is linked to content");
  }

  await db
    .delete(refs)
    .where(and(eq(refs.id, parsed.data.id), eq(refs.userId, user.id)));

  revalidatePath("/");
  revalidatePath("/inbox");
  revalidatePath("/references");

  return ok({ id: parsed.data.id });
}

const saveCaptureSchema = z.object({
  id: z.string().uuid(),
  pillarIds: z.array(z.string().uuid()).optional(),
  formatId: z.string().uuid().nullable().optional(),
  sourceHandle: z.string().optional(),
  audioTitle: z.string().optional(),
  audioArtist: z.string().optional(),
  hookText: z.string().optional(),
  hookTypeId: z.string().uuid().nullable().optional(),
  visualNotes: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

/**
 * Saves quick capture details on a reference (PRD §12.5).
 */
export async function saveCapture(
  input: z.infer<typeof saveCaptureSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = saveCaptureSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid capture data");
  }

  const {
    id,
    pillarIds,
    formatId,
    sourceHandle,
    audioTitle,
    audioArtist,
    hookText,
    hookTypeId,
    visualNotes,
    notes,
    tags,
    summary,
  } = parsed.data;

  return await withTx(async (tx) => {
    // 1. Fetch current ref scoped to user
    const [currentRef] = await tx
      .select({
        id: refs.id,
        platformId: refs.platformId,
        url: refs.url,
      })
      .from(refs)
      .where(and(eq(refs.id, id), eq(refs.userId, user.id)))
      .limit(1);

    if (!currentRef) return fail("not_found", "Reference not found");

    // 2. Handle Source Account if handle provided
    let sourceAccountId: string | undefined = undefined;
    if (sourceHandle && sourceHandle.trim()) {
      const cleanHandle = normalizeHandle(sourceHandle);
      if (cleanHandle) {
        const [existingSource] = await tx
          .select({ id: sourceAccounts.id })
          .from(sourceAccounts)
          .where(
            and(
              eq(sourceAccounts.userId, user.id),
              eq(sourceAccounts.platformId, currentRef.platformId),
              eq(sourceAccounts.handle, cleanHandle)
            )
          )
          .limit(1);

        if (existingSource) {
          sourceAccountId = existingSource.id;
        } else {
          const [createdSource] = await tx
            .insert(sourceAccounts)
            .values({
              userId: user.id,
              platformId: currentRef.platformId,
              handle: cleanHandle,
            })
            .returning({ id: sourceAccounts.id });
          sourceAccountId = createdSource.id;
        }
      }
    }

    // 3. Handle Audio if title provided
    let audioId: string | undefined = undefined;
    if (audioTitle && audioTitle.trim()) {
      const cleanTitle = audioTitle.trim();
      const cleanArtist = (audioArtist || "").trim();

      const [existingAudio] = await tx
        .select({ id: audios.id })
        .from(audios)
        .where(
          and(
            eq(audios.userId, user.id),
            sql`lower(btrim(${audios.title})) = lower(btrim(${cleanTitle}))`,
            sql`lower(btrim(${audios.artist})) = lower(btrim(${cleanArtist}))`
          )
        )
        .limit(1);

      if (existingAudio) {
        audioId = existingAudio.id;
      } else {
        const [createdAudio] = await tx
          .insert(audios)
          .values({
            userId: user.id,
            title: cleanTitle,
            artist: cleanArtist,
          })
          .returning({ id: audios.id });
        audioId = createdAudio.id;
      }
    }

    // 4. Normalize tags
    const normalizedTags = (tags || []).map(normalizeTag).filter(Boolean);

    // 5. Generate search text
    const searchParts = [
      currentRef.url,
      hookText || "",
      notes || "",
      visualNotes || "",
      summary || "",
      sourceHandle || "",
      normalizedTags.join(" "),
    ];
    const searchText = searchParts.filter(Boolean).join(" ").toLowerCase();

    // 6. Update refs row
    const updateValues: Record<string, any> = {
      searchText,
      tags: normalizedTags,
    };
    if (formatId !== undefined) updateValues.formatId = formatId;
    if (sourceAccountId !== undefined) updateValues.sourceAccountId = sourceAccountId;
    if (audioId !== undefined) updateValues.audioId = audioId;
    if (hookText !== undefined) updateValues.hookText = hookText;
    if (hookTypeId !== undefined) updateValues.hookTypeId = hookTypeId;
    if (visualNotes !== undefined) updateValues.visualNotes = visualNotes;
    if (notes !== undefined) updateValues.notes = notes;
    if (summary !== undefined) updateValues.summary = summary;

    await tx
      .update(refs)
      .set(updateValues)
      .where(and(eq(refs.id, id), eq(refs.userId, user.id)));

    // 7. Sync pillars if provided (scoped to current user's pillars)
    if (pillarIds) {
      await tx.delete(refPillars).where(eq(refPillars.refId, id));
      if (pillarIds.length > 0) {
        const ownedPillars = await tx
          .select({ id: pillars.id })
          .from(pillars)
          .where(and(eq(pillars.userId, user.id), inArray(pillars.id, pillarIds)));
        if (ownedPillars.length > 0) {
          await tx.insert(refPillars).values(
            ownedPillars.map((p) => ({
              refId: id,
              pillarId: p.id,
            }))
          );
        }
      }
    }

    revalidatePath("/");
    revalidatePath("/inbox");
    revalidatePath("/references");
    revalidatePath(`/references/${id}`);

    return ok({ id });
  });
}

const saveBedahSchema = z.object({
  id: z.string().uuid(),
  hookText: z.string().optional(),
  hookTypeId: z.string().uuid().nullable().optional(),
  visualNotes: z.string().optional(),
  notes: z.string().optional(),
  elements: z.array(z.enum(["idea", "hook", "audio", "visual", "topic"])).optional(),
});

/**
 * Saves Bedah breakdown on a reference (PRD §12.5).
 */
export async function saveBedah(
  input: z.infer<typeof saveBedahSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = saveBedahSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid bedah data");
  }

  const { id, hookText, hookTypeId, visualNotes, notes, elements } = parsed.data;

  return await withTx(async (tx) => {
    const [existing] = await tx
      .select({ id: refs.id })
      .from(refs)
      .where(and(eq(refs.id, id), eq(refs.userId, user.id)))
      .limit(1);

    if (!existing) {
      return fail("not_found", "Reference not found");
    }

    const updateValues: Record<string, any> = {};
    if (hookText !== undefined) updateValues.hookText = hookText;
    if (hookTypeId !== undefined) updateValues.hookTypeId = hookTypeId;
    if (visualNotes !== undefined) updateValues.visualNotes = visualNotes;
    if (notes !== undefined) updateValues.notes = notes;

    if (Object.keys(updateValues).length > 0) {
      await tx
        .update(refs)
        .set(updateValues)
        .where(and(eq(refs.id, id), eq(refs.userId, user.id)));
    }

    if (elements) {
      await tx.delete(refElements).where(eq(refElements.refId, id));
      if (elements.length > 0) {
        await tx.insert(refElements).values(
          elements.map((el) => ({
            refId: id,
            element: el,
          }))
        );
      }
    }

    revalidatePath(`/references/${id}`);
    revalidatePath("/references");
    return ok({ id });
  });
}

