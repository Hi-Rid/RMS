"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";
import { normalizeUrl, extractUrls } from "@/lib/domain/url";
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
  await requireActionOwner();

  const parsed = createFromUrlSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  try {
    const normalized = await normalizeUrl(parsed.data.input);
    const platformId = await getPlatformIdBySlug(normalized.platform);
    const formatId = await getFormatIdBySlug(normalized.format);

    const record = await createReferenceRecord({
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
  await requireActionOwner();

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
      const platformId = await getPlatformIdBySlug(normalized.platform);
      const formatId = await getFormatIdBySlug(normalized.format);

      const record = await createReferenceRecord({
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
  await requireActionOwner();

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
      const platformId = await getPlatformIdBySlug(normalized.platform);

      const existing = await findExistingReference({
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
  await requireActionOwner();

  const parsed = importUrlsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", "Invalid list of URLs");
  }

  let created = 0;
  let duplicates = 0;

  for (const url of parsed.data.urls) {
    try {
      const normalized = await normalizeUrl(url);
      const platformId = await getPlatformIdBySlug(normalized.platform);
      const formatId = await getFormatIdBySlug(normalized.format);

      const res = await createReferenceRecord({
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
