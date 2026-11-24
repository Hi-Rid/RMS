import { eq, and, sql, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { refs, platforms, formats } from "@/db/schema";
import type { Platform, ContentFormatGuess } from "@/lib/domain/url";

// Memory cache for platform and format lookups
let cachedPlatforms: Map<string, string> | null = null;
let cachedFormats: Map<string, string> | null = null;

export async function getPlatformIdBySlug(slug: Platform): Promise<string> {
  if (!cachedPlatforms) {
    const rows = await db.select({ id: platforms.id, slug: platforms.slug }).from(platforms);
    cachedPlatforms = new Map(rows.map((r) => [r.slug, r.id]));
  }
  const id = cachedPlatforms.get(slug);
  if (id) return id;

  // Fallback query if not in cache
  const [row] = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.slug, slug))
    .limit(1);

  if (row) {
    cachedPlatforms.set(slug, row.id);
    return row.id;
  }

  // Fallback to "other" platform
  const otherId = cachedPlatforms.get("other");
  if (otherId) return otherId;

  const [otherRow] = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.slug, "other"))
    .limit(1);

  return otherRow.id;
}

export async function getFormatIdBySlug(slug: ContentFormatGuess): Promise<string | undefined> {
  if (!slug) return undefined;
  if (!cachedFormats) {
    const rows = await db.select({ id: formats.id, slug: formats.slug }).from(formats);
    cachedFormats = new Map(rows.map((r) => [r.slug, r.id]));
  }
  const id = cachedFormats.get(slug);
  if (id) return id;

  const [row] = await db
    .select({ id: formats.id })
    .from(formats)
    .where(eq(formats.slug, slug))
    .limit(1);

  if (row) {
    cachedFormats.set(slug, row.id);
    return row.id;
  }
  return undefined;
}

export interface ExistingReference {
  id: string;
  url: string;
  archivedAt: string | null;
}

/**
 * Searches for an existing reference by (platformId, externalId) or canonical url (PRD §10.2).
 * Includes archived references.
 */
export async function findExistingReference(params: {
  platformId: string;
  externalId?: string;
  url: string;
}): Promise<ExistingReference | null> {
  if (params.externalId) {
    const [row] = await db
      .select({ id: refs.id, url: refs.url, archivedAt: refs.archivedAt })
      .from(refs)
      .where(
        or(
          and(eq(refs.platformId, params.platformId), eq(refs.externalId, params.externalId)),
          eq(refs.url, params.url)
        )
      )
      .limit(1);

    return row || null;
  }

  const [row] = await db
    .select({ id: refs.id, url: refs.url, archivedAt: refs.archivedAt })
    .from(refs)
    .where(eq(refs.url, params.url))
    .limit(1);

  return row || null;
}

/**
 * Inserts a reference row with race condition duplicate protection.
 */
export async function createReferenceRecord(data: {
  url: string;
  urlOriginal: string;
  platformId: string;
  externalId?: string;
  formatId?: string;
}): Promise<{ id: string; isDuplicate: boolean; archived?: boolean }> {
  // 1. Initial duplicate check
  const existing = await findExistingReference({
    platformId: data.platformId,
    externalId: data.externalId,
    url: data.url,
  });

  if (existing) {
    return {
      id: existing.id,
      isDuplicate: true,
      archived: Boolean(existing.archivedAt),
    };
  }

  // 2. Insert new record
  try {
    const [created] = await db
      .insert(refs)
      .values({
        url: data.url,
        urlOriginal: data.urlOriginal,
        platformId: data.platformId,
        externalId: data.externalId || null,
        formatId: data.formatId || null,
        status: "inbox",
        tags: [],
        searchText: "",
      })
      .returning({ id: refs.id });

    return {
      id: created.id,
      isDuplicate: false,
    };
  } catch (err: unknown) {
    // Check if Postgres unique constraint violation (code 23505) occurred due to race condition
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      const duplicate = await findExistingReference({
        platformId: data.platformId,
        externalId: data.externalId,
        url: data.url,
      });
      if (duplicate) {
        return {
          id: duplicate.id,
          isDuplicate: true,
          archived: Boolean(duplicate.archivedAt),
        };
      }
    }
    throw err;
  }
}
