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
import {
  enrichInboxBatchForUser,
  enrichReferenceById,
  runAiAgentForReference,
} from "@/lib/ai/agent";
import { syncReferenceEmbedding } from "@/lib/ai/embeddings";
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
  enriched?: boolean;
  summary?: string | null;
  draftContentId?: string | null;
  draftContentTitle?: string | null;
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

    const agentRes = !record.isDuplicate
      ? await runAiAgentForReference({
          userId: user.id,
          refId: record.id,
          url: normalized.url,
          platformSlug: normalized.platform,
          rawInput: parsed.data.input.trim(),
          urlHandle: normalized.handle,
          externalId: normalized.externalId,
        }).catch(() => null)
      : null;

    revalidatePath("/home");
    revalidatePath("/inbox");
    revalidatePath("/references");
    revalidatePath("/contents");
    revalidatePath("/sources");
    revalidatePath("/audio");

    return ok({
      status: record.isDuplicate ? "duplicate" : "created",
      id: record.id,
      archived: record.archived,
      enriched: agentRes?.enriched ?? false,
      summary: agentRes?.summary ?? null,
      draftContentId: agentRes?.draftContentId ?? null,
      draftContentTitle: agentRes?.draftContentTitle ?? null,
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
): Promise<
  ActionResult<{
    results: BatchItemResult[];
    totalProcessed: number;
    createdCount: number;
    duplicateCount?: number;
    invalidCount?: number;
    truncatedCount?: number;
  }>
> {
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
  const truncatedCount = Math.max(0, rawUrls.length - 50);
  const results: BatchItemResult[] = [];
  let createdCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let enrichedBatchCount = 0;

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

      let agentRes = null;
      if (record.isDuplicate) {
        duplicateCount++;
      } else {
        createdCount++;
        if (enrichedBatchCount < 3) {
          enrichedBatchCount++;
          agentRes = await runAiAgentForReference({
            userId: user.id,
            refId: record.id,
            url: normalized.url,
            platformSlug: normalized.platform,
            rawInput: urlsToProcess.length === 1 ? parsed.data.text : raw,
            urlHandle: normalized.handle,
            externalId: normalized.externalId,
          }).catch(() => null);
        }
      }

      results.push({
        input: raw,
        status: record.isDuplicate ? "duplicate" : "created",
        id: record.id,
        message: record.isDuplicate
          ? record.archived
            ? "Already saved (archived)"
            : "Already in references"
          : agentRes?.draftContentTitle
            ? `AI drafted Content: ${agentRes.draftContentTitle}`
            : agentRes?.enriched
              ? "Saved & AI enriched"
              : "Saved to inbox",
      });
    } catch {
      invalidCount++;
      results.push({
        input: raw,
        status: "invalid",
        message: "Failed to parse or invalid URL",
      });
    }
  }

  revalidatePath("/home");
  revalidatePath("/inbox");
  revalidatePath("/references");
  revalidatePath("/contents");
  revalidatePath("/sources");
  revalidatePath("/audio");

  return ok({
    results,
    totalProcessed: urlsToProcess.length,
    createdCount,
    duplicateCount,
    invalidCount,
    truncatedCount,
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
  let enrichedImportCount = 0;

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
        if (enrichedImportCount < 3) {
          enrichedImportCount++;
          await runAiAgentForReference({
            userId: user.id,
            refId: res.id,
            url: normalized.url,
            platformSlug: normalized.platform,
            rawInput: url,
            urlHandle: normalized.handle,
            externalId: normalized.externalId,
          }).catch(() => null);
        }
      }
    } catch {
      // Continue importing remaining URLs
    }
  }

  revalidatePath("/home");
  revalidatePath("/inbox");
  revalidatePath("/references");
  revalidatePath("/contents");
  revalidatePath("/sources");
  revalidatePath("/audio");

  return ok({ created, duplicates });
}

/**
 * Manually triggers the AI Content Agent on a single Reference (forces enrichment even if auto-enrich is off).
 */
export async function enrichReferenceWithAgent(input: {
  id: string;
}): Promise<
  ActionResult<{
    enriched: boolean;
    skippedReason?: string;
    summary: string | null;
    hookText: string | null;
    draftContentId: string | null;
    draftContentTitle: string | null;
  }>
> {
  const user = await requireActionOwner();
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) {
    return fail("validation", "Invalid reference ID");
  }

  const res = await enrichReferenceById({
    userId: user.id,
    refId: parsed.data.id,
    force: true,
  });

  if (!res.enriched && !res.metadataFetched && res.skippedReason === "not_found") {
    return fail("not_found", "Reference not found");
  }
  if (!res.enriched && res.skippedReason === "ai_disabled") {
    return fail("ai_disabled", "AI Automation is disabled in Settings");
  }
  if (!res.enriched && res.skippedReason === "daily_cap") {
    return fail("ai_cap_reached", "Daily AI quota cap reached in Settings");
  }

  revalidatePath("/home");
  revalidatePath("/inbox");
  revalidatePath("/references");
  revalidatePath(`/references/${parsed.data.id}`);
  revalidatePath("/contents");
  revalidatePath("/sources");
  revalidatePath("/audio");

  return ok({
    enriched: res.enriched,
    skippedReason: res.skippedReason,
    summary: res.summary,
    hookText: res.hookText,
    draftContentId: res.draftContentId,
    draftContentTitle: res.draftContentTitle,
  });
}

/**
 * Enriches up to 5 Inbox references that are missing AI summaries/hooks.
 */
export async function enrichInboxBatch(): Promise<
  ActionResult<{
    processedCount: number;
    enrichedCount: number;
    draftedCount: number;
  }>
> {
  const user = await requireActionOwner();
  const summary = await enrichInboxBatchForUser(user.id, 5);

  revalidatePath("/home");
  revalidatePath("/inbox");
  revalidatePath("/references");
  revalidatePath("/contents");
  revalidatePath("/sources");
  revalidatePath("/audio");

  return ok(summary);
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

  revalidatePath("/home");
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

  revalidatePath("/home");
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

  revalidatePath("/home");
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

  revalidatePath("/home");
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

  revalidatePath("/home");
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

  revalidatePath("/home");
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

  const txResult = await withTx(async (tx) => {
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

    // 2. Handle Source Account if handle field provided (empty clears link)
    let sourceAccountId: string | null | undefined = undefined;
    if (sourceHandle !== undefined) {
      if (sourceHandle.trim()) {
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
        } else {
          sourceAccountId = null;
        }
      } else {
        sourceAccountId = null;
      }
    }

    // 3. Handle Audio if title field provided (empty clears link)
    let audioId: string | null | undefined = undefined;
    if (audioTitle !== undefined) {
      if (audioTitle.trim()) {
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
      } else {
        audioId = null;
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
    if (hookText !== undefined) updateValues.hookText = hookText.trim() || null;
    if (hookTypeId !== undefined) updateValues.hookTypeId = hookTypeId;
    if (visualNotes !== undefined) updateValues.visualNotes = visualNotes.trim() || null;
    if (notes !== undefined) updateValues.notes = notes.trim() || null;
    if (summary !== undefined) updateValues.summary = summary.trim() || null;

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

    revalidatePath("/home");
    revalidatePath("/inbox");
    revalidatePath("/references");
    revalidatePath(`/references/${id}`);

    return ok({ id, searchText });
  });

  if (!txResult.ok) {
    return txResult;
  }

  if (txResult.data.searchText) {
    await syncReferenceEmbedding({
      userId: user.id,
      refId: id,
      text: txResult.data.searchText,
    }).catch(() => false);
  }

  return ok({ id });
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

  const txResult = await withTx(async (tx) => {
    const [existing] = await tx
      .select({
        id: refs.id,
        url: refs.url,
        summary: refs.summary,
        hookText: refs.hookText,
        visualNotes: refs.visualNotes,
        notes: refs.notes,
        tags: refs.tags,
      })
      .from(refs)
      .where(and(eq(refs.id, id), eq(refs.userId, user.id)))
      .limit(1);

    if (!existing) {
      return fail("not_found", "Reference not found");
    }

    const nextHookText = hookText !== undefined ? hookText : existing.hookText;
    const nextVisualNotes = visualNotes !== undefined ? visualNotes : existing.visualNotes;
    const nextNotes = notes !== undefined ? notes : existing.notes;
    const nextSearchText = [
      existing.url,
      existing.summary || "",
      nextHookText || "",
      nextVisualNotes || "",
      nextNotes || "",
      ...(existing.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const updateValues: Record<string, any> = {
      searchText: nextSearchText,
    };
    if (hookText !== undefined) updateValues.hookText = hookText.trim() || null;
    if (hookTypeId !== undefined) updateValues.hookTypeId = hookTypeId;
    if (visualNotes !== undefined) updateValues.visualNotes = visualNotes.trim() || null;
    if (notes !== undefined) updateValues.notes = notes.trim() || null;

    await tx
      .update(refs)
      .set(updateValues)
      .where(and(eq(refs.id, id), eq(refs.userId, user.id)));

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
    return ok({ id, searchText: nextSearchText });
  });

  if (!txResult.ok) {
    return txResult;
  }

  if (txResult.data.searchText) {
    await syncReferenceEmbedding({
      userId: user.id,
      refId: id,
      text: txResult.data.searchText,
    }).catch(() => false);
  }

  return ok({ id });
}

const bulkRefsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["select", "skip", "archive", "restore"]),
});

/**
 * Applies batch triage/archive transitions across selected references.
 */
export async function bulkUpdateReferences(
  input: z.infer<typeof bulkRefsSchema>
): Promise<ActionResult<{ updatedCount: number; skippedDueToLink: number }>> {
  const user = await requireActionOwner();
  const parsed = bulkRefsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid bulk update payload");
  }

  const rows = await db
    .select({ id: refs.id, status: refs.status, contentId: refs.contentId })
    .from(refs)
    .where(and(eq(refs.userId, user.id), inArray(refs.id, parsed.data.ids)));

  if (rows.length === 0) {
    return fail("not_found", "No matching references found");
  }

  let updatedCount = 0;
  let skippedDueToLink = 0;

  if (parsed.data.action === "archive" || parsed.data.action === "restore") {
    const res = await db
      .update(refs)
      .set({ archivedAt: parsed.data.action === "archive" ? sql`now()` : null })
      .where(and(eq(refs.userId, user.id), inArray(refs.id, rows.map((r) => r.id))))
      .returning({ id: refs.id });
    updatedCount = res.length;
  } else {
    const eligibleIds: string[] = [];
    for (const r of rows) {
      if (parsed.data.action === "skip" && Boolean(r.contentId)) {
        skippedDueToLink++;
        continue;
      }
      const nextStatus = parsed.data.action === "select" ? "selected" : "skipped";
      if (isAllowedRefTransition(r.status, nextStatus, Boolean(r.contentId))) {
        eligibleIds.push(r.id);
      } else {
        skippedDueToLink++;
      }
    }

    if (eligibleIds.length > 0) {
      const res = await db
        .update(refs)
        .set({
          status: parsed.data.action === "select" ? "selected" : "skipped",
          skippedReason: parsed.data.action === "select" ? null : undefined,
          statusChangedAt: sql`now()`,
        })
        .where(and(eq(refs.userId, user.id), inArray(refs.id, eligibleIds)))
        .returning({ id: refs.id });
      updatedCount = res.length;
    }
  }

  revalidatePath("/home");
  revalidatePath("/inbox");
  revalidatePath("/inbox/triage");
  revalidatePath("/references");

  return ok({ updatedCount, skippedDueToLink });
}

