import "server-only";
import { eq, and, sql, or, isNull, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { getOwner } from "@/lib/auth/owner";
import {
  refs,
  platforms,
  formats,
  pillars,
  refPillars,
  hookTypes,
  sourceAccounts,
  audios,
  refElements,
  refImages,
} from "@/db/schema";
import type { Platform, ContentFormatGuess } from "@/lib/domain/url";
import {
  findSemanticReferenceIds,
  findSimilarReferences,
  type SimilarReferenceItem,
} from "@/lib/ai/embeddings";

export type { SimilarReferenceItem };

// Per-user memory cache for platform and format lookups
const cachedPlatformsByUser = new Map<string, Map<string, string>>();
const cachedFormatsByUser = new Map<string, Map<string, string>>();

export function invalidateReferenceMasterCache(userId: string) {
  cachedPlatformsByUser.delete(userId);
  cachedFormatsByUser.delete(userId);
}

export async function getPlatformIdBySlug(slug: Platform, explicitUserId?: string): Promise<string> {
  const userId = explicitUserId ?? (await getOwner())?.id;
  if (!userId) {
    throw new Error("Authenticated user required for platform lookup");
  }

  let userPlatforms = cachedPlatformsByUser.get(userId);
  if (!userPlatforms) {
    try {
      const rows = await db
        .select({ id: platforms.id, slug: platforms.slug })
        .from(platforms)
        .where(eq(platforms.userId, userId));
      userPlatforms = new Map(rows.map((r) => [r.slug, r.id]));
      if (userPlatforms.size > 0) {
        cachedPlatformsByUser.set(userId, userPlatforms);
      }
    } catch (e) {
      console.warn("Platform cache fetch warning, falling back to direct lookup:", e);
    }
  }

  const cachedId = userPlatforms?.get(slug);
  if (cachedId) return cachedId;

  const [row] = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(and(eq(platforms.userId, userId), eq(platforms.slug, slug)))
    .limit(1);

  if (row) {
    if (!userPlatforms) {
      userPlatforms = new Map();
      cachedPlatformsByUser.set(userId, userPlatforms);
    }
    userPlatforms.set(slug, row.id);
    return row.id;
  }

  const otherId = userPlatforms?.get("other");
  if (otherId) return otherId;

  const [otherRow] = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(and(eq(platforms.userId, userId), eq(platforms.slug, "other")))
    .limit(1);

  if (otherRow) {
    if (!userPlatforms) {
      userPlatforms = new Map();
      cachedPlatformsByUser.set(userId, userPlatforms);
    }
    userPlatforms.set("other", otherRow.id);
    return otherRow.id;
  }

  const [anyRow] = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.userId, userId))
    .limit(1);

  if (anyRow) return anyRow.id;
  throw new Error("Platform table has no rows configured for user");
}

export async function getFormatIdBySlug(
  slug: ContentFormatGuess,
  explicitUserId?: string
): Promise<string | undefined> {
  if (!slug) return undefined;
  const userId = explicitUserId ?? (await getOwner())?.id;
  if (!userId) return undefined;

  let userFormats = cachedFormatsByUser.get(userId);
  if (!userFormats) {
    try {
      const rows = await db
        .select({ id: formats.id, slug: formats.slug })
        .from(formats)
        .where(eq(formats.userId, userId));
      userFormats = new Map(rows.map((r) => [r.slug, r.id]));
      if (userFormats.size > 0) {
        cachedFormatsByUser.set(userId, userFormats);
      }
    } catch (e) {
      console.warn("Format cache fetch warning, falling back to direct lookup:", e);
    }
  }

  const cachedId = userFormats?.get(slug);
  if (cachedId) return cachedId;

  const [row] = await db
    .select({ id: formats.id })
    .from(formats)
    .where(and(eq(formats.userId, userId), eq(formats.slug, slug)))
    .limit(1);

  if (row) {
    if (!userFormats) {
      userFormats = new Map();
      cachedFormatsByUser.set(userId, userFormats);
    }
    userFormats.set(slug, row.id);
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
 * Searches for an existing reference scoped to userId by (platformId, externalId) or canonical url.
 * Includes archived references.
 */
export async function findExistingReference(params: {
  userId: string;
  platformId: string;
  externalId?: string;
  url: string;
}): Promise<ExistingReference | null> {
  if (params.externalId) {
    const [row] = await db
      .select({ id: refs.id, url: refs.url, archivedAt: refs.archivedAt })
      .from(refs)
      .where(
        and(
          eq(refs.userId, params.userId),
          or(
            and(eq(refs.platformId, params.platformId), eq(refs.externalId, params.externalId)),
            eq(refs.url, params.url)
          )
        )
      )
      .limit(1);

    return row || null;
  }

  const [row] = await db
    .select({ id: refs.id, url: refs.url, archivedAt: refs.archivedAt })
    .from(refs)
    .where(and(eq(refs.userId, params.userId), eq(refs.url, params.url)))
    .limit(1);

  return row || null;
}

/**
 * Inserts a user-scoped reference row with race condition duplicate protection.
 */
export async function createReferenceRecord(data: {
  userId: string;
  url: string;
  urlOriginal: string;
  platformId: string;
  externalId?: string;
  formatId?: string;
}): Promise<{ id: string; isDuplicate: boolean; archived?: boolean }> {
  const existing = await findExistingReference({
    userId: data.userId,
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

  try {
    const [created] = await db
      .insert(refs)
      .values({
        userId: data.userId,
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
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      const duplicate = await findExistingReference({
        userId: data.userId,
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

export interface MasterData {
  platforms: { id: string; name: string; slug: string }[];
  formats: { id: string; name: string; slug: string }[];
  pillars: { id: string; name: string; slug: string }[];
  hookTypes: { id: string; name: string; slug: string }[];
}

const EMPTY_MASTER_DATA: MasterData = {
  platforms: [],
  formats: [],
  pillars: [],
  hookTypes: [],
};

/**
 * Returns active master data for the authenticated user.
 */
export async function getMasterData(explicitUserId?: string): Promise<MasterData> {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) return EMPTY_MASTER_DATA;

    const [platformList, formatList, pillarList, hookTypeList] = await Promise.all([
      db
        .select({ id: platforms.id, name: platforms.name, slug: platforms.slug })
        .from(platforms)
        .where(and(eq(platforms.userId, userId), eq(platforms.isActive, true)))
        .orderBy(platforms.sortOrder, platforms.name),
      db
        .select({ id: formats.id, name: formats.name, slug: formats.slug })
        .from(formats)
        .where(and(eq(formats.userId, userId), eq(formats.isActive, true)))
        .orderBy(formats.sortOrder, formats.name),
      db
        .select({ id: pillars.id, name: pillars.name, slug: pillars.slug })
        .from(pillars)
        .where(and(eq(pillars.userId, userId), eq(pillars.isActive, true)))
        .orderBy(pillars.sortOrder, pillars.name),
      db
        .select({ id: hookTypes.id, name: hookTypes.name, slug: hookTypes.slug })
        .from(hookTypes)
        .where(and(eq(hookTypes.userId, userId), eq(hookTypes.isActive, true)))
        .orderBy(hookTypes.sortOrder, hookTypes.name),
    ]);

    return {
      platforms: platformList,
      formats: formatList,
      pillars: pillarList,
      hookTypes: hookTypeList,
    };
  } catch (error) {
    console.warn("Failed to fetch master data from database:", error);
    return EMPTY_MASTER_DATA;
  }
}

export interface ReferenceListItem {
  id: string;
  url: string;
  urlOriginal: string;
  status: string;
  summary: string | null;
  hookText: string | null;
  visualNotes: string | null;
  notes: string | null;
  tags: string[];
  skippedReason: string | null;
  contentId: string | null;
  contentPosition: number | null;
  savedAt: string;
  statusChangedAt: string;
  archivedAt: string | null;
  platform: { id: string; name: string; slug: string };
  format: { id: string; name: string; slug: string } | null;
  hookType: { id: string; name: string; slug: string } | null;
  sourceAccount: { id: string; handle: string } | null;
  audio: { id: string; title: string; artist: string } | null;
  pillars: { id: string; name: string; slug: string }[];
  elements?: string[];
  coverUrl?: string | null;
}

export interface ListReferencesParams {
  userId?: string;
  status?: string;
  pillarSlug?: string;
  platformSlug?: string;
  formatSlug?: string;
  unusedOnly?: boolean;
  searchText?: string;
  archived?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Retrieves a list of references scoped to the user with filtering, search, and associated relations.
 */
export async function listReferences(params: ListReferencesParams = {}): Promise<{
  items: ReferenceListItem[];
  total: number;
}> {
  try {
    const {
      status,
      pillarSlug,
      platformSlug,
      formatSlug,
      unusedOnly,
      searchText,
      archived = false,
      limit = 36,
      offset = 0,
    } = params;

    const userId = params.userId ?? (await getOwner())?.id;
    if (!userId) return { items: [], total: 0 };

    const conditions = [eq(refs.userId, userId)];

    if (archived) {
      conditions.push(sql`${refs.archivedAt} IS NOT NULL`);
    } else {
      conditions.push(isNull(refs.archivedAt));
    }

    if (status && status !== "all") {
      conditions.push(eq(refs.status, status as any));
    }

    if (unusedOnly) {
      conditions.push(isNull(refs.contentId));
      conditions.push(sql`${refs.status} != 'skipped'`);
    }

    if (searchText && searchText.trim()) {
      const trimmed = searchText.trim();
      const term = `%${trimmed.toLowerCase()}%`;
      const semanticIds = await findSemanticReferenceIds(userId, trimmed);
      const textCondition = or(
        sql`lower(${refs.url}) LIKE ${term}`,
        sql`lower(${refs.hookText}) LIKE ${term}`,
        sql`lower(${refs.summary}) LIKE ${term}`,
        sql`lower(${refs.notes}) LIKE ${term}`,
        sql`${refs.searchText} LIKE ${term}`
      )!;
      if (semanticIds.length > 0) {
        conditions.push(or(textCondition, inArray(refs.id, semanticIds))!);
      } else {
        conditions.push(textCondition);
      }
    }

    if (platformSlug && platformSlug !== "all") {
      conditions.push(eq(platforms.slug, platformSlug));
    }

    if (formatSlug && formatSlug !== "all") {
      conditions.push(eq(formats.slug, formatSlug));
    }

    if (pillarSlug && pillarSlug !== "all") {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${refPillars} rp
          JOIN ${pillars} p ON p.id = rp.pillar_id
          WHERE rp.ref_id = ${refs.id} AND p.user_id = ${userId} AND p.slug = ${pillarSlug}
        )`
      );
    }

    const whereClause = and(...conditions);

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(refs)
      .leftJoin(platforms, eq(refs.platformId, platforms.id))
      .leftJoin(formats, eq(refs.formatId, formats.id))
      .where(whereClause);

    const total = totalRes?.count || 0;

    const rows = await db
      .select({
        ref: refs,
        platform: {
          id: platforms.id,
          name: platforms.name,
          slug: platforms.slug,
        },
        format: {
          id: formats.id,
          name: formats.name,
          slug: formats.slug,
        },
        hookType: {
          id: hookTypes.id,
          name: hookTypes.name,
          slug: hookTypes.slug,
        },
        sourceAccount: {
          id: sourceAccounts.id,
          handle: sourceAccounts.handle,
        },
        audio: {
          id: audios.id,
          title: audios.title,
          artist: audios.artist,
        },
      })
      .from(refs)
      .innerJoin(platforms, eq(refs.platformId, platforms.id))
      .leftJoin(formats, eq(refs.formatId, formats.id))
      .leftJoin(hookTypes, eq(refs.hookTypeId, hookTypes.id))
      .leftJoin(sourceAccounts, eq(refs.sourceAccountId, sourceAccounts.id))
      .leftJoin(audios, eq(refs.audioId, audios.id))
      .where(whereClause)
      .orderBy(desc(refs.savedAt))
      .limit(limit)
      .offset(offset);

    if (rows.length === 0) {
      return { items: [], total };
    }

    const refIds = rows.map((r) => r.ref.id);
    const [refPillarsList, refImagesList] = await Promise.all([
      db
        .select({
          refId: refPillars.refId,
          pillarId: pillars.id,
          name: pillars.name,
          slug: pillars.slug,
        })
        .from(refPillars)
        .innerJoin(pillars, eq(refPillars.pillarId, pillars.id))
        .where(inArray(refPillars.refId, refIds))
        .catch(() => []),
      db
        .select({
          refId: refImages.refId,
          storagePath: refImages.storagePath,
        })
        .from(refImages)
        .where(inArray(refImages.refId, refIds))
        .orderBy(refImages.position)
        .catch(() => []),
    ]);

    const pillarMap = new Map<string, { id: string; name: string; slug: string }[]>();
    for (const rp of refPillarsList) {
      const list = pillarMap.get(rp.refId) || [];
      list.push({ id: rp.pillarId, name: rp.name, slug: rp.slug });
      pillarMap.set(rp.refId, list);
    }

    const coverMap = new Map<string, string>();
    for (const img of refImagesList) {
      if (!coverMap.has(img.refId)) {
        coverMap.set(img.refId, img.storagePath);
      }
    }

    const items: ReferenceListItem[] = rows.map((r) => ({
      id: r.ref.id,
      url: r.ref.url,
      urlOriginal: r.ref.urlOriginal,
      status: r.ref.status,
      summary: r.ref.summary,
      hookText: r.ref.hookText,
      visualNotes: r.ref.visualNotes,
      notes: r.ref.notes,
      tags: r.ref.tags || [],
      skippedReason: r.ref.skippedReason,
      contentId: r.ref.contentId,
      contentPosition: r.ref.contentPosition,
      savedAt: r.ref.savedAt,
      statusChangedAt: r.ref.statusChangedAt,
      archivedAt: r.ref.archivedAt,
      platform: r.platform,
      format: r.format?.id ? r.format : null,
      hookType: r.hookType?.id ? r.hookType : null,
      sourceAccount: r.sourceAccount?.id ? r.sourceAccount : null,
      audio: r.audio?.id ? r.audio : null,
      pillars: pillarMap.get(r.ref.id) || [],
      coverUrl: coverMap.get(r.ref.id) || r.ref.coverUrl || null,
    }));

    return { items, total };
  } catch (error) {
    console.warn("Failed to list references (database fallback):", error);
    return { items: [], total: 0 };
  }
}

/**
 * Returns references in the active user's inbox queue, ordered by savedAt desc.
 */
export async function getInboxReferences(explicitUserId?: string): Promise<ReferenceListItem[]> {
  const result = await listReferences({ userId: explicitUserId, status: "inbox", limit: 100 });
  return result.items;
}

/**
 * Fetches a single reference owned by the active user with all relations and bedah elements.
 */
export async function getReferenceById(
  id: string,
  explicitUserId?: string
): Promise<ReferenceListItem | null> {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) return null;

    const [row] = await db
      .select({
        ref: refs,
        platform: {
          id: platforms.id,
          name: platforms.name,
          slug: platforms.slug,
        },
        format: {
          id: formats.id,
          name: formats.name,
          slug: formats.slug,
        },
        hookType: {
          id: hookTypes.id,
          name: hookTypes.name,
          slug: hookTypes.slug,
        },
        sourceAccount: {
          id: sourceAccounts.id,
          handle: sourceAccounts.handle,
        },
        audio: {
          id: audios.id,
          title: audios.title,
          artist: audios.artist,
        },
      })
      .from(refs)
      .innerJoin(platforms, eq(refs.platformId, platforms.id))
      .leftJoin(formats, eq(refs.formatId, formats.id))
      .leftJoin(hookTypes, eq(refs.hookTypeId, hookTypes.id))
      .leftJoin(sourceAccounts, eq(refs.sourceAccountId, sourceAccounts.id))
      .leftJoin(audios, eq(refs.audioId, audios.id))
      .where(and(eq(refs.id, id), eq(refs.userId, userId)))
      .limit(1);

    if (!row) return null;

    const [refPillarsList, refElementsList, refImageList] = await Promise.all([
      db
        .select({
          id: pillars.id,
          name: pillars.name,
          slug: pillars.slug,
        })
        .from(refPillars)
        .innerJoin(pillars, eq(refPillars.pillarId, pillars.id))
        .where(eq(refPillars.refId, id)),
      db
        .select({
          element: refElements.element,
        })
        .from(refElements)
        .where(eq(refElements.refId, id)),
      db
        .select({
          storagePath: refImages.storagePath,
        })
        .from(refImages)
        .where(eq(refImages.refId, id))
        .orderBy(refImages.position)
        .limit(1)
        .catch(() => []),
    ]);

    return {
      id: row.ref.id,
      url: row.ref.url,
      urlOriginal: row.ref.urlOriginal,
      status: row.ref.status,
      summary: row.ref.summary,
      hookText: row.ref.hookText,
      visualNotes: row.ref.visualNotes,
      notes: row.ref.notes,
      tags: row.ref.tags || [],
      skippedReason: row.ref.skippedReason,
      contentId: row.ref.contentId,
      contentPosition: row.ref.contentPosition,
      savedAt: row.ref.savedAt,
      statusChangedAt: row.ref.statusChangedAt,
      archivedAt: row.ref.archivedAt,
      platform: row.platform,
      format: row.format?.id ? row.format : null,
      hookType: row.hookType?.id ? row.hookType : null,
      sourceAccount: row.sourceAccount?.id ? row.sourceAccount : null,
      audio: row.audio?.id ? row.audio : null,
      pillars: refPillarsList,
      elements: refElementsList.map((e) => e.element),
      coverUrl: refImageList[0]?.storagePath || row.ref.coverUrl || null,
    };
  } catch (error) {
    console.warn(`Failed to get reference by ID ${id} (database fallback):`, error);
    return null;
  }
}

export async function getSimilarReferences(
  refId: string,
  limit = 4
): Promise<SimilarReferenceItem[]> {
  const owner = await getOwner();
  if (!owner) return [];
  return findSimilarReferences(owner.id, refId, limit);
}
