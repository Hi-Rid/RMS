import "server-only";
import { eq, sql, desc, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { getOwner } from "@/lib/auth/owner";
import { audios, refs, contents, posts, platforms } from "@/db/schema";

export type AudioSortOption = "recent" | "refs" | "contents" | "rating" | "newest" | "title";

export interface AudioListItem {
  id: string;
  title: string;
  artist: string;
  isOriginal: boolean;
  notes: string | null;
  refsCount: number;
  contentsCount: number;
  postsCount: number;
  avgRating: number | null;
  archivedUsageCount: number;
  canDelete: boolean;
  lastUsedAt: string | null;
  isUnused: boolean;
  createdAt: string;
}

export interface ListAudiosParams {
  userId?: string;
  unusedOnly?: boolean;
  originalOnly?: boolean;
  searchText?: string;
  sortBy?: AudioSortOption;
}

export async function listAudios(params: ListAudiosParams = {}): Promise<AudioListItem[]> {
  try {
    const {
      unusedOnly = false,
      originalOnly = false,
      searchText,
      sortBy = "recent",
    } = params;
    const userId = params.userId ?? (await getOwner())?.id;
    if (!userId) return [];

    // Fetch all user audios with scoped aggregation counts and performance stats
    const rows = await db
      .select({
        id: audios.id,
        title: audios.title,
        artist: audios.artist,
        isOriginal: audios.isOriginal,
        notes: audios.notes,
        createdAt: audios.createdAt,
        refsCount: sql<number>`(SELECT count(*)::int FROM "refs" r WHERE r.audio_id = "audios"."id" AND r.user_id = ${userId} AND r.archived_at IS NULL)`,
        contentsCount: sql<number>`(SELECT count(*)::int FROM "contents" c WHERE c.audio_id = "audios"."id" AND c.user_id = ${userId} AND c.archived_at IS NULL)`,
        archivedRefsCount: sql<number>`(SELECT count(*)::int FROM "refs" r WHERE r.audio_id = "audios"."id" AND r.user_id = ${userId} AND r.archived_at IS NOT NULL)`,
        archivedContentsCount: sql<number>`(SELECT count(*)::int FROM "contents" c WHERE c.audio_id = "audios"."id" AND c.user_id = ${userId} AND c.archived_at IS NOT NULL)`,
        postsCount: sql<number>`(
          SELECT count(*)::int
          FROM "posts" p
          JOIN "contents" c ON c.id = p.content_id
          WHERE c.audio_id = "audios"."id" AND c.user_id = ${userId} AND c.archived_at IS NULL
        )`,
        avgRating: sql<number | null>`(
          SELECT round(avg(c.final_rating)::numeric, 1)::float
          FROM "contents" c
          WHERE c.audio_id = "audios"."id"
            AND c.user_id = ${userId}
            AND c.archived_at IS NULL
            AND c.final_rating IS NOT NULL
        )`,
        lastUsedAt: sql<string | null>`(
          SELECT max(p.posted_at)::text
          FROM "posts" p
          JOIN "contents" c ON c.id = p.content_id
          WHERE c.audio_id = "audios"."id" AND c.user_id = ${userId}
        )`,
      })
      .from(audios)
      .where(eq(audios.userId, userId));

    let items: AudioListItem[] = rows.map((r) => {
      const refsCount = r.refsCount || 0;
      const contentsCount = r.contentsCount || 0;
      const archivedUsageCount =
        (r.archivedRefsCount || 0) + (r.archivedContentsCount || 0);
      return {
        id: r.id,
        title: r.title,
        artist: r.artist,
        isOriginal: r.isOriginal,
        notes: r.notes,
        refsCount,
        contentsCount,
        postsCount: r.postsCount || 0,
        avgRating:
          typeof r.avgRating === "number" && Number.isFinite(r.avgRating)
            ? r.avgRating
            : null,
        archivedUsageCount,
        canDelete: refsCount === 0 && contentsCount === 0 && archivedUsageCount === 0,
        lastUsedAt: r.lastUsedAt,
        isUnused: contentsCount === 0,
        createdAt: r.createdAt,
      };
    });

    if (searchText && searchText.trim()) {
      const term = searchText.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(term) ||
          i.artist.toLowerCase().includes(term) ||
          (i.notes && i.notes.toLowerCase().includes(term))
      );
    }

    if (unusedOnly) {
      items = items.filter((i) => i.isUnused);
    }

    if (originalOnly) {
      items = items.filter((i) => i.isOriginal);
    }

    if (sortBy === "title") {
      items.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "refs") {
      items.sort((a, b) => b.refsCount - a.refsCount || b.createdAt.localeCompare(a.createdAt));
    } else if (sortBy === "contents") {
      items.sort(
        (a, b) =>
          b.contentsCount - a.contentsCount ||
          b.refsCount - a.refsCount ||
          b.createdAt.localeCompare(a.createdAt)
      );
    } else if (sortBy === "rating") {
      items.sort(
        (a, b) =>
          (b.avgRating ?? -1) - (a.avgRating ?? -1) ||
          b.postsCount - a.postsCount ||
          b.createdAt.localeCompare(a.createdAt)
      );
    } else if (sortBy === "newest") {
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      items.sort((a, b) => {
        if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt);
        if (a.lastUsedAt) return -1;
        if (b.lastUsedAt) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    }

    return items;
  } catch (error) {
    console.warn("Failed to list audios:", error);
    return [];
  }
}

export async function getAudioById(id: string, explicitUserId?: string) {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) return null;

    const [audio] = await db
      .select()
      .from(audios)
      .where(and(eq(audios.id, id), eq(audios.userId, userId)))
      .limit(1);

    if (!audio) return null;

    const [usingRefs, usingContents, archivedRefCountRes, archivedContentCountRes] = await Promise.all([
      db
        .select({
          id: refs.id,
          url: refs.url,
          summary: refs.summary,
          hookText: refs.hookText,
          status: refs.status,
          savedAt: refs.savedAt,
          platformName: platforms.name,
        })
        .from(refs)
        .innerJoin(platforms, eq(refs.platformId, platforms.id))
        .where(and(eq(refs.audioId, id), eq(refs.userId, userId), isNull(refs.archivedAt)))
        .orderBy(desc(refs.savedAt)),

      db
        .select({
          id: contents.id,
          title: contents.title,
          status: contents.status,
          finalRating: contents.finalRating,
          createdAt: contents.createdAt,
          lastPostedAt: sql<string | null>`(SELECT max(p.posted_at)::text FROM "posts" p WHERE p.content_id = "contents"."id")`,
        })
        .from(contents)
        .where(and(eq(contents.audioId, id), eq(contents.userId, userId), isNull(contents.archivedAt)))
        .orderBy(desc(contents.createdAt)),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(refs)
        .where(and(eq(refs.audioId, id), eq(refs.userId, userId), sql`${refs.archivedAt} IS NOT NULL`)),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contents)
        .where(and(eq(contents.audioId, id), eq(contents.userId, userId), sql`${contents.archivedAt} IS NOT NULL`)),
    ]);

    const archivedRefsCount = archivedRefCountRes[0]?.count || 0;
    const archivedContentsCount = archivedContentCountRes[0]?.count || 0;

    return {
      audio,
      usingRefs,
      usingContents,
      archivedUsageCount: archivedRefsCount + archivedContentsCount,
      canDelete:
        usingRefs.length === 0 &&
        usingContents.length === 0 &&
        archivedRefsCount === 0 &&
        archivedContentsCount === 0,
    };
  } catch (error) {
    console.warn(`Failed to get audio by ID ${id}:`, error);
    return null;
  }
}
