import "server-only";
import { eq, sql, desc, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { getOwner } from "@/lib/auth/owner";
import {
  sourceAccounts,
  platforms,
  formats,
  hookTypes,
  refs,
  contents,
} from "@/db/schema";

export type SourceSortOption = "refs" | "hit_rate" | "score" | "recent" | "handle";

export interface SourceListItem {
  id: string;
  handle: string;
  notes: string | null;
  platform: {
    id: string;
    name: string;
    slug: string;
  };
  refsCount: number;
  inboxCount: number;
  selectedCount: number;
  productionCount: number;
  conversionPct: number;
  archivedRefsCount: number;
  canDelete: boolean;
  avgScore: number | null;
  lastSavedAt: string | null;
  createdAt: string;
}

export async function listSources(params: {
  userId?: string;
  searchText?: string;
  sortBy?: SourceSortOption;
} = {}): Promise<SourceListItem[]> {
  try {
    const { searchText, sortBy = "refs" } = params;
    const userId = params.userId ?? (await getOwner())?.id;
    if (!userId) return [];

    const rows = await db
      .select({
        id: sourceAccounts.id,
        handle: sourceAccounts.handle,
        notes: sourceAccounts.notes,
        createdAt: sourceAccounts.createdAt,
        platformId: platforms.id,
        platformName: platforms.name,
        platformSlug: platforms.slug,
        refsCount: sql<number>`(SELECT count(*)::int FROM "refs" r WHERE r.source_account_id = "source_accounts"."id" AND r.user_id = ${userId} AND r.archived_at IS NULL)`,
        inboxCount: sql<number>`(SELECT count(*)::int FROM "refs" r WHERE r.source_account_id = "source_accounts"."id" AND r.user_id = ${userId} AND r.status = 'inbox' AND r.archived_at IS NULL)`,
        selectedCount: sql<number>`(SELECT count(*)::int FROM "refs" r WHERE r.source_account_id = "source_accounts"."id" AND r.user_id = ${userId} AND r.status = 'selected' AND r.archived_at IS NULL)`,
        productionCount: sql<number>`(SELECT count(*)::int FROM "refs" r WHERE r.source_account_id = "source_accounts"."id" AND r.user_id = ${userId} AND r.status IN ('production', 'posted', 'evaluating') AND r.archived_at IS NULL)`,
        archivedRefsCount: sql<number>`(SELECT count(*)::int FROM "refs" r WHERE r.source_account_id = "source_accounts"."id" AND r.user_id = ${userId} AND r.archived_at IS NOT NULL)`,
        lastSavedAt: sql<string | null>`(SELECT max(r.saved_at)::text FROM "refs" r WHERE r.source_account_id = "source_accounts"."id" AND r.user_id = ${userId} AND r.archived_at IS NULL)`,
        avgScore: sql<number | null>`(
          SELECT round(avg(c.final_rating)::numeric, 1)
          FROM "refs" r
          JOIN "contents" c ON c.id = r.content_id
          WHERE r.source_account_id = "source_accounts"."id"
            AND r.user_id = ${userId}
            AND r.archived_at IS NULL
            AND c.archived_at IS NULL
            AND c.final_rating IS NOT NULL
        )`,
      })
      .from(sourceAccounts)
      .innerJoin(platforms, eq(sourceAccounts.platformId, platforms.id))
      .where(eq(sourceAccounts.userId, userId));

    let items: SourceListItem[] = rows.map((r) => {
      const refsCount = r.refsCount || 0;
      const inboxCount = r.inboxCount || 0;
      const selectedCount = r.selectedCount || 0;
      const productionCount = r.productionCount || 0;
      const archivedRefsCount = r.archivedRefsCount || 0;
      const conversionPct =
        refsCount > 0
          ? Math.round(((selectedCount + productionCount) / refsCount) * 100)
          : 0;

      return {
        id: r.id,
        handle: r.handle,
        notes: r.notes,
        platform: {
          id: r.platformId,
          name: r.platformName,
          slug: r.platformSlug,
        },
        refsCount,
        inboxCount,
        selectedCount,
        productionCount,
        conversionPct,
        archivedRefsCount,
        canDelete: refsCount === 0 && archivedRefsCount === 0,
        avgScore:
          r.avgScore !== null && r.avgScore !== undefined ? Number(r.avgScore) : null,
        lastSavedAt: r.lastSavedAt,
        createdAt: r.createdAt,
      };
    });

    if (searchText && searchText.trim()) {
      const term = searchText.trim().replace(/^@+/, "").toLowerCase();
      items = items.filter(
        (i) =>
          i.handle.toLowerCase().includes(term) ||
          i.platform.name.toLowerCase().includes(term) ||
          (i.notes && i.notes.toLowerCase().includes(term))
      );
    }

    if (sortBy === "handle") {
      items.sort((a, b) => a.handle.localeCompare(b.handle));
    } else if (sortBy === "score") {
      items.sort(
        (a, b) =>
          (b.avgScore ?? -1) - (a.avgScore ?? -1) || b.refsCount - a.refsCount
      );
    } else if (sortBy === "hit_rate") {
      items.sort(
        (a, b) => b.conversionPct - a.conversionPct || b.refsCount - a.refsCount
      );
    } else if (sortBy === "recent") {
      items.sort((a, b) => {
        if (a.lastSavedAt && b.lastSavedAt)
          return b.lastSavedAt.localeCompare(a.lastSavedAt);
        if (a.lastSavedAt) return -1;
        if (b.lastSavedAt) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    } else {
      items.sort((a, b) => b.refsCount - a.refsCount || a.handle.localeCompare(b.handle));
    }

    return items;
  } catch (error) {
    console.warn("Failed to list sources:", error);
    return [];
  }
}

export async function getSourceById(id: string, explicitUserId?: string) {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) return null;

    const [source] = await db
      .select({
        id: sourceAccounts.id,
        handle: sourceAccounts.handle,
        notes: sourceAccounts.notes,
        createdAt: sourceAccounts.createdAt,
        platform: {
          id: platforms.id,
          name: platforms.name,
          slug: platforms.slug,
        },
      })
      .from(sourceAccounts)
      .innerJoin(platforms, eq(sourceAccounts.platformId, platforms.id))
      .where(and(eq(sourceAccounts.id, id), eq(sourceAccounts.userId, userId)))
      .limit(1);

    if (!source) return null;

    const [sourceRefs, archivedCountRes, avgScoreRes] = await Promise.all([
      db
        .select({
          id: refs.id,
          url: refs.url,
          summary: refs.summary,
          hookText: refs.hookText,
          status: refs.status,
          contentId: refs.contentId,
          savedAt: refs.savedAt,
          formatName: formats.name,
          hookTypeName: hookTypes.name,
        })
        .from(refs)
        .leftJoin(formats, eq(refs.formatId, formats.id))
        .leftJoin(hookTypes, eq(refs.hookTypeId, hookTypes.id))
        .where(and(eq(refs.sourceAccountId, id), eq(refs.userId, userId), isNull(refs.archivedAt)))
        .orderBy(desc(refs.savedAt)),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(refs)
        .where(and(eq(refs.sourceAccountId, id), eq(refs.userId, userId), sql`${refs.archivedAt} IS NOT NULL`)),

      db
        .select({
          avgScore: sql<number | null>`round(avg(${contents.finalRating})::numeric, 1)`,
        })
        .from(refs)
        .innerJoin(contents, eq(refs.contentId, contents.id))
        .where(
          and(
            eq(refs.sourceAccountId, id),
            eq(refs.userId, userId),
            isNull(refs.archivedAt),
            isNull(contents.archivedAt),
            sql`${contents.finalRating} IS NOT NULL`
          )
        ),
    ]);

    const archivedRefsCount = archivedCountRes[0]?.count || 0;
    const inboxCount = sourceRefs.filter((r) => r.status === "inbox").length;
    const selectedCount = sourceRefs.filter((r) => r.status === "selected").length;
    const producedCount = sourceRefs.filter(
      (r) =>
        r.status === "production" ||
        r.status === "posted" ||
        r.status === "evaluating"
    ).length;
    const conversionPct =
      sourceRefs.length > 0
        ? Math.round(((selectedCount + producedCount) / sourceRefs.length) * 100)
        : 0;
    const rawAvg = avgScoreRes[0]?.avgScore;

    return {
      source,
      sourceRefs,
      archivedRefsCount,
      stats: {
        totalRefs: sourceRefs.length,
        inboxCount,
        selectedCount,
        producedCount,
        conversionPct,
        avgScore: rawAvg !== null && rawAvg !== undefined ? Number(rawAvg) : null,
      },
      canDelete: sourceRefs.length === 0 && archivedRefsCount === 0,
    };
  } catch (error) {
    console.warn(`Failed to get source by ID ${id}:`, error);
    return null;
  }
}
