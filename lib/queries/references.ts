import { eq, and, sql, or, isNull, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
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
} from "@/db/schema";
import type { Platform, ContentFormatGuess } from "@/lib/domain/url";

// Memory cache for platform and format lookups
let cachedPlatforms: Map<string, string> | null = null;
let cachedFormats: Map<string, string> | null = null;

export async function getPlatformIdBySlug(slug: Platform): Promise<string> {
  if (!cachedPlatforms) {
    try {
      const rows = await db.select({ id: platforms.id, slug: platforms.slug }).from(platforms);
      cachedPlatforms = new Map(rows.map((r) => [r.slug, r.id]));
    } catch (e) {
      console.warn("Platform cache fetch warning, falling back to direct lookup:", e);
    }
  }
  const id = cachedPlatforms?.get(slug);
  if (id) return id;

  const [row] = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.slug, slug))
    .limit(1);

  if (row) {
    if (!cachedPlatforms) cachedPlatforms = new Map();
    cachedPlatforms.set(slug, row.id);
    return row.id;
  }

  const otherId = cachedPlatforms?.get("other");
  if (otherId) return otherId;

  const [otherRow] = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.slug, "other"))
    .limit(1);

  return otherRow?.id || "";
}

export async function getFormatIdBySlug(slug: ContentFormatGuess): Promise<string | undefined> {
  if (!slug) return undefined;
  if (!cachedFormats) {
    try {
      const rows = await db.select({ id: formats.id, slug: formats.slug }).from(formats);
      cachedFormats = new Map(rows.map((r) => [r.slug, r.id]));
    } catch (e) {
      console.warn("Format cache fetch warning, falling back to direct lookup:", e);
    }
  }
  const id = cachedFormats?.get(slug);
  if (id) return id;

  const [row] = await db
    .select({ id: formats.id })
    .from(formats)
    .where(eq(formats.slug, slug))
    .limit(1);

  if (row) {
    if (!cachedFormats) cachedFormats = new Map();
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

export interface MasterData {
  platforms: { id: string; name: string; slug: string }[];
  formats: { id: string; name: string; slug: string }[];
  pillars: { id: string; name: string; slug: string }[];
  hookTypes: { id: string; name: string; slug: string }[];
}

const FALLBACK_MASTER_DATA: MasterData = {
  platforms: [
    { id: "instagram", name: "Instagram", slug: "instagram" },
    { id: "tiktok", name: "TikTok", slug: "tiktok" },
    { id: "youtube", name: "YouTube", slug: "youtube" },
    { id: "x", name: "X", slug: "x" },
    { id: "threads", name: "Threads", slug: "threads" },
    { id: "other", name: "Other", slug: "other" },
  ],
  formats: [
    { id: "short", name: "Shorts / Reels", slug: "short" },
    { id: "carousel", name: "Carousel", slug: "carousel" },
    { id: "post", name: "Single Post", slug: "post" },
  ],
  pillars: [
    { id: "p1", name: "Hook / Pembuka", slug: "hook" },
    { id: "p2", name: "Edukasi & Tutorial", slug: "edukasi" },
    { id: "p3", name: "Storytelling", slug: "storytelling" },
    { id: "p4", name: "Komedi / Relate", slug: "komedi" },
  ],
  hookTypes: [
    { id: "h1", name: "Problem / Rasa Sakit", slug: "problem" },
    { id: "h2", name: "Pertanyaan Provokatif", slug: "question" },
    { id: "h3", name: "Hasil Mengejutkan", slug: "result" },
    { id: "h4", name: "Mitos vs Fakta", slug: "myth" },
  ],
};

/**
 * Returns active master data for dropdowns, filters, and forms.
 */
export async function getMasterData(): Promise<MasterData> {
  try {
    const [platformList, formatList, pillarList, hookTypeList] = await Promise.all([
      db.select({ id: platforms.id, name: platforms.name, slug: platforms.slug }).from(platforms).orderBy(platforms.name),
      db.select({ id: formats.id, name: formats.name, slug: formats.slug }).from(formats).orderBy(formats.sortOrder),
      db.select({ id: pillars.id, name: pillars.name, slug: pillars.slug }).from(pillars).where(eq(pillars.isActive, true)).orderBy(pillars.sortOrder),
      db.select({ id: hookTypes.id, name: hookTypes.name, slug: hookTypes.slug }).from(hookTypes).orderBy(hookTypes.sortOrder),
    ]);

    return {
      platforms: platformList,
      formats: formatList,
      pillars: pillarList,
      hookTypes: hookTypeList,
    };
  } catch (error) {
    console.warn("Failed to fetch master data from database, using fallback:", error);
    return FALLBACK_MASTER_DATA;
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
}

export interface ListReferencesParams {
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
 * Retrieves a list of references with filtering, search, and associated relations.
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

  const conditions = [];

  // Archived condition
  if (archived) {
    conditions.push(sql`${refs.archivedAt} IS NOT NULL`);
  } else {
    conditions.push(isNull(refs.archivedAt));
  }

  // Status condition
  if (status && status !== "all") {
    conditions.push(eq(refs.status, status as any));
  }

  // Unused condition: PRD §10.6 -> contentId IS NULL and status != 'skipped'
  if (unusedOnly) {
    conditions.push(isNull(refs.contentId));
    conditions.push(sql`${refs.status} != 'skipped'`);
  }

  // Search text condition
  if (searchText && searchText.trim()) {
    const term = `%${searchText.trim().toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${refs.url}) LIKE ${term}`,
        sql`lower(${refs.hookText}) LIKE ${term}`,
        sql`lower(${refs.summary}) LIKE ${term}`,
        sql`lower(${refs.notes}) LIKE ${term}`,
        sql`${refs.searchText} LIKE ${term}`
      )
    );
  }

  // Platform slug condition
  if (platformSlug && platformSlug !== "all") {
    conditions.push(eq(platforms.slug, platformSlug));
  }

  // Format slug condition
  if (formatSlug && formatSlug !== "all") {
    conditions.push(eq(formats.slug, formatSlug));
  }

  // Pillar slug condition
  if (pillarSlug && pillarSlug !== "all") {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${refPillars} rp
        JOIN ${pillars} p ON p.id = rp.pillar_id
        WHERE rp.ref_id = ${refs.id} AND p.slug = ${pillarSlug}
      )`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total matching
  const [totalRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(refs)
    .leftJoin(platforms, eq(refs.platformId, platforms.id))
    .leftJoin(formats, eq(refs.formatId, formats.id))
    .where(whereClause);

  const total = totalRes?.count || 0;

  // Query records
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

  // Batch query pillars for returned references
  const refIds = rows.map((r) => r.ref.id);
  const refPillarsList = await db
    .select({
      refId: refPillars.refId,
      pillarId: pillars.id,
      name: pillars.name,
      slug: pillars.slug,
    })
    .from(refPillars)
    .innerJoin(pillars, eq(refPillars.pillarId, pillars.id))
    .where(inArray(refPillars.refId, refIds));

  const pillarMap = new Map<string, { id: string; name: string; slug: string }[]>();
  for (const rp of refPillarsList) {
    const list = pillarMap.get(rp.refId) || [];
    list.push({ id: rp.pillarId, name: rp.name, slug: rp.slug });
    pillarMap.set(rp.refId, list);
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
  }));

    return { items, total };
  } catch (error) {
    console.warn("Failed to list references (database fallback):", error);
    return { items: [], total: 0 };
  }
}

/**
 * Returns references in the inbox queue (status = 'inbox' and not archived), ordered by savedAt desc.
 */
export async function getInboxReferences(): Promise<ReferenceListItem[]> {
  const result = await listReferences({ status: "inbox", limit: 100 });
  return result.items;
}

/**
 * Fetches a single reference with all relations and bedah elements.
 */
export async function getReferenceById(id: string): Promise<ReferenceListItem | null> {
  try {
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
      .where(eq(refs.id, id))
      .limit(1);

    if (!row) return null;

    const [refPillarsList, refElementsList] = await Promise.all([
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
    };
  } catch (error) {
    console.warn(`Failed to get reference by ID ${id} (database fallback):`, error);
    return null;
  }
}
