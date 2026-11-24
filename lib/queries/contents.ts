import { eq, and, sql, or, isNull, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contents,
  formats,
  series,
  pillars,
  contentPillars,
  contentChecklist,
  refs,
  posts,
  platforms,
  snapshots,
  hookTypes,
  audios,
} from "@/db/schema";

export interface ContentListItem {
  id: string;
  title: string;
  status: string;
  hookText: string | null;
  notes: string | null;
  changesNote: string | null;
  workUrl: string | null;
  tags: string[];
  plannedFor: string | null;
  finalRating: number | null;
  createdAt: string;
  updatedAt: string;
  format: { id: string; name: string; slug: string } | null;
  series: { id: string; name: string } | null;
  hookType: { id: string; name: string; slug: string } | null;
  audio: { id: string; title: string; artist: string } | null;
  pillars: { id: string; name: string; slug: string }[];
  refsCount: number;
  postsCount: number;
  checklistStats: { total: number; done: number };
}

export interface ListContentsParams {
  status?: string;
  pillarSlug?: string;
  formatSlug?: string;
  seriesId?: string;
  searchText?: string;
  archived?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Lists contents with filters, relations, and counts.
 */
export async function listContents(params: ListContentsParams = {}): Promise<{
  items: ContentListItem[];
  total: number;
}> {
  try {
    const {
      status,
      pillarSlug,
      formatSlug,
      seriesId,
      searchText,
      archived = false,
      limit = 30,
      offset = 0,
    } = params;

  const conditions = [];

  if (archived) {
    conditions.push(sql`${contents.archivedAt} IS NOT NULL`);
  } else {
    conditions.push(isNull(contents.archivedAt));
  }

  if (status && status !== "all") {
    conditions.push(eq(contents.status, status as any));
  }

  if (formatSlug && formatSlug !== "all") {
    conditions.push(eq(formats.slug, formatSlug));
  }

  if (seriesId && seriesId !== "all") {
    conditions.push(eq(contents.seriesId, seriesId));
  }

  if (searchText && searchText.trim()) {
    const term = `%${searchText.trim().toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${contents.title}) LIKE ${term}`,
        sql`lower(${contents.hookText}) LIKE ${term}`,
        sql`lower(${contents.notes}) LIKE ${term}`,
        sql`${contents.searchText} LIKE ${term}`
      )
    );
  }

  if (pillarSlug && pillarSlug !== "all") {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${contentPillars} cp
        JOIN ${pillars} p ON p.id = cp.pillar_id
        WHERE cp.content_id = ${contents.id} AND p.slug = ${pillarSlug}
      )`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total
  const [totalRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contents)
    .where(whereClause);

  const total = totalRes?.count || 0;

  // Query contents
  const rows = await db
    .select({
      content: contents,
      format: {
        id: formats.id,
        name: formats.name,
        slug: formats.slug,
      },
      series: {
        id: series.id,
        name: series.name,
      },
      hookType: {
        id: hookTypes.id,
        name: hookTypes.name,
        slug: hookTypes.slug,
      },
      audio: {
        id: audios.id,
        title: audios.title,
        artist: audios.artist,
      },
    })
    .from(contents)
    .leftJoin(formats, eq(contents.formatId, formats.id))
    .leftJoin(series, eq(contents.seriesId, series.id))
    .leftJoin(hookTypes, eq(contents.hookTypeId, hookTypes.id))
    .leftJoin(audios, eq(contents.audioId, audios.id))
    .where(whereClause)
    .orderBy(desc(contents.createdAt))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) {
    return { items: [], total };
  }

  const contentIds = rows.map((r) => r.content.id);

  // Batch query pillars, ref count, posts count, and checklist stats
  const [pillarRows, refCountRows, postCountRows, checklistRows] = await Promise.all([
    db
      .select({
        contentId: contentPillars.contentId,
        pillarId: pillars.id,
        name: pillars.name,
        slug: pillars.slug,
      })
      .from(contentPillars)
      .innerJoin(pillars, eq(contentPillars.pillarId, pillars.id))
      .where(inArray(contentPillars.contentId, contentIds)),

    db
      .select({
        contentId: refs.contentId,
        count: sql<number>`count(*)::int`,
      })
      .from(refs)
      .where(inArray(refs.contentId, contentIds))
      .groupBy(refs.contentId),

    db
      .select({
        contentId: posts.contentId,
        count: sql<number>`count(*)::int`,
      })
      .from(posts)
      .where(inArray(posts.contentId, contentIds))
      .groupBy(posts.contentId),

    db
      .select({
        contentId: contentChecklist.contentId,
        isDone: contentChecklist.isDone,
      })
      .from(contentChecklist)
      .where(inArray(contentChecklist.contentId, contentIds)),
  ]);

  // Aggregate maps
  const pillarMap = new Map<string, { id: string; name: string; slug: string }[]>();
  for (const p of pillarRows) {
    const list = pillarMap.get(p.contentId) || [];
    list.push({ id: p.pillarId, name: p.name, slug: p.slug });
    pillarMap.set(p.contentId, list);
  }

  const refCountMap = new Map<string, number>();
  for (const r of refCountRows) {
    if (r.contentId) refCountMap.set(r.contentId, r.count);
  }

  const postCountMap = new Map<string, number>();
  for (const p of postCountRows) {
    postCountMap.set(p.contentId, p.count);
  }

  const checklistMap = new Map<string, { total: number; done: number }>();
  for (const cl of checklistRows) {
    const stat = checklistMap.get(cl.contentId) || { total: 0, done: 0 };
    stat.total += 1;
    if (cl.isDone) stat.done += 1;
    checklistMap.set(cl.contentId, stat);
  }

  const items: ContentListItem[] = rows.map((r) => ({
    id: r.content.id,
    title: r.content.title,
    status: r.content.status,
    hookText: r.content.hookText,
    notes: r.content.notes,
    changesNote: r.content.changesNote,
    workUrl: r.content.workUrl,
    tags: r.content.tags || [],
    plannedFor: r.content.plannedFor,
    finalRating: r.content.finalRating,
    createdAt: r.content.createdAt,
    updatedAt: r.content.updatedAt,
    format: r.format?.id ? r.format : null,
    series: r.series?.id ? r.series : null,
    hookType: r.hookType?.id ? r.hookType : null,
    audio: r.audio?.id ? r.audio : null,
    pillars: pillarMap.get(r.content.id) || [],
    refsCount: refCountMap.get(r.content.id) || 0,
    postsCount: postCountMap.get(r.content.id) || 0,
    checklistStats: checklistMap.get(r.content.id) || { total: 0, done: 0 },
  }));

    return { items, total };
  } catch (error) {
    console.warn("Failed to list contents (database fallback):", error);
    return { items: [], total: 0 };
  }
}

export interface ContentDetailItem extends ContentListItem {
  refs: {
    id: string;
    url: string;
    hookText: string | null;
    contentPosition: number | null;
    platformName: string;
  }[];
  checklist: {
    id: string;
    label: string;
    isDone: boolean;
    position: number;
  }[];
  posts: {
    id: string;
    platformId: string;
    platformName: string;
    platformSlug: string;
    url: string | null;
    caption: string | null;
    postedAt: string;
    snapshots: {
      id: string;
      checkpoint: string;
      dueAt: string;
      status: string;
      views: number | null;
      likes: number | null;
      rating: number | null;
    }[];
  }[];
}

/**
 * Returns full content details including checklist items, linked refs, and posts with snapshots.
 */
export async function getContentById(id: string): Promise<ContentDetailItem | null> {
  const [row] = await db
    .select({
      content: contents,
      format: {
        id: formats.id,
        name: formats.name,
        slug: formats.slug,
      },
      series: {
        id: series.id,
        name: series.name,
      },
      hookType: {
        id: hookTypes.id,
        name: hookTypes.name,
        slug: hookTypes.slug,
      },
      audio: {
        id: audios.id,
        title: audios.title,
        artist: audios.artist,
      },
    })
    .from(contents)
    .leftJoin(formats, eq(contents.formatId, formats.id))
    .leftJoin(series, eq(contents.seriesId, series.id))
    .leftJoin(hookTypes, eq(contents.hookTypeId, hookTypes.id))
    .leftJoin(audios, eq(contents.audioId, audios.id))
    .where(eq(contents.id, id))
    .limit(1);

  if (!row) return null;

  // Query relations
  const [pillarRows, refRows, checklistRows, postRows] = await Promise.all([
    db
      .select({
        pillarId: pillars.id,
        name: pillars.name,
        slug: pillars.slug,
      })
      .from(contentPillars)
      .innerJoin(pillars, eq(contentPillars.pillarId, pillars.id))
      .where(eq(contentPillars.contentId, id)),

    db
      .select({
        id: refs.id,
        url: refs.url,
        hookText: refs.hookText,
        contentPosition: refs.contentPosition,
        platformName: platforms.name,
      })
      .from(refs)
      .innerJoin(platforms, eq(refs.platformId, platforms.id))
      .where(eq(refs.contentId, id))
      .orderBy(refs.contentPosition),

    db
      .select({
        id: contentChecklist.id,
        label: contentChecklist.label,
        isDone: contentChecklist.isDone,
        position: contentChecklist.position,
      })
      .from(contentChecklist)
      .where(eq(contentChecklist.contentId, id))
      .orderBy(contentChecklist.position),

    db
      .select({
        id: posts.id,
        platformId: posts.platformId,
        platformName: platforms.name,
        platformSlug: platforms.slug,
        url: posts.url,
        caption: posts.caption,
        postedAt: posts.postedAt,
      })
      .from(posts)
      .innerJoin(platforms, eq(posts.platformId, platforms.id))
      .where(eq(posts.contentId, id))
      .orderBy(desc(posts.postedAt)),
  ]);

  // Query snapshots for all posts of this content
  const postIds = postRows.map((p) => p.id);
  const snapshotRows =
    postIds.length > 0
      ? await db
          .select({
            id: snapshots.id,
            postId: snapshots.postId,
            checkpoint: snapshots.checkpoint,
            dueAt: snapshots.dueAt,
            status: snapshots.status,
            views: snapshots.views,
            likes: snapshots.likes,
            rating: snapshots.rating,
          })
          .from(snapshots)
          .where(inArray(snapshots.postId, postIds))
          .orderBy(snapshots.dueAt)
      : [];

  const postSnapshotsMap = new Map<string, typeof snapshotRows>();
  for (const sn of snapshotRows) {
    const list = postSnapshotsMap.get(sn.postId) || [];
    list.push(sn);
    postSnapshotsMap.set(sn.postId, list);
  }

  const postsWithSnapshots = postRows.map((p) => ({
    ...p,
    snapshots: postSnapshotsMap.get(p.id) || [],
  }));

  const doneCount = checklistRows.filter((c) => c.isDone).length;

  return {
    id: row.content.id,
    title: row.content.title,
    status: row.content.status,
    hookText: row.content.hookText,
    notes: row.content.notes,
    changesNote: row.content.changesNote,
    workUrl: row.content.workUrl,
    tags: row.content.tags || [],
    plannedFor: row.content.plannedFor,
    finalRating: row.content.finalRating,
    createdAt: row.content.createdAt,
    updatedAt: row.content.updatedAt,
    format: row.format?.id ? row.format : null,
    series: row.series?.id ? row.series : null,
    hookType: row.hookType?.id ? row.hookType : null,
    audio: row.audio?.id ? row.audio : null,
    pillars: pillarRows.map((p) => ({ id: p.pillarId, name: p.name, slug: p.slug })),
    refsCount: refRows.length,
    postsCount: postRows.length,
    checklistStats: { total: checklistRows.length, done: doneCount },
    refs: refRows,
    checklist: checklistRows,
    posts: postsWithSnapshots,
  };
}
