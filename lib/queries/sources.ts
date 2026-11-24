import "server-only";
import { eq, sql, desc, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceAccounts, platforms, refs, contents, snapshots } from "@/db/schema";

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
  selectedCount: number;
  productionCount: number;
  avgScore: number | null;
  createdAt: string;
}

export async function listSources(params: {
  searchText?: string;
  sortBy?: "refs" | "handle" | "score";
} = {}): Promise<SourceListItem[]> {
  try {
    const { searchText, sortBy = "refs" } = params;

    const rows = await db
      .select({
        id: sourceAccounts.id,
        handle: sourceAccounts.handle,
        notes: sourceAccounts.notes,
        createdAt: sourceAccounts.createdAt,
        platformId: platforms.id,
        platformName: platforms.name,
        platformSlug: platforms.slug,
        refsCount: sql<number>`(SELECT count(*)::int FROM ${refs} WHERE ${refs.sourceAccountId} = ${sourceAccounts.id} AND ${refs.archivedAt} IS NULL)`,
        selectedCount: sql<number>`(SELECT count(*)::int FROM ${refs} WHERE ${refs.sourceAccountId} = ${sourceAccounts.id} AND ${refs.status} = 'selected' AND ${refs.archivedAt} IS NULL)`,
        productionCount: sql<number>`(SELECT count(*)::int FROM ${refs} WHERE ${refs.sourceAccountId} = ${sourceAccounts.id} AND ${refs.status} = 'production' AND ${refs.archivedAt} IS NULL)`,
      })
      .from(sourceAccounts)
      .innerJoin(platforms, eq(sourceAccounts.platformId, platforms.id));

    let items: SourceListItem[] = rows.map((r) => ({
      id: r.id,
      handle: r.handle,
      notes: r.notes,
      platform: {
        id: r.platformId,
        name: r.platformName,
        slug: r.platformSlug,
      },
      refsCount: r.refsCount || 0,
      selectedCount: r.selectedCount || 0,
      productionCount: r.productionCount || 0,
      avgScore: null, // Computed from snapshots rating if available
      createdAt: r.createdAt,
    }));

    if (searchText && searchText.trim()) {
      const term = searchText.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.handle.toLowerCase().includes(term) ||
          i.platform.name.toLowerCase().includes(term) ||
          (i.notes && i.notes.toLowerCase().includes(term))
      );
    }

    if (sortBy === "handle") {
      items.sort((a, b) => a.handle.localeCompare(b.handle));
    } else {
      // default: refs count desc
      items.sort((a, b) => b.refsCount - a.refsCount);
    }

    return items;
  } catch (error) {
    console.warn("Failed to list sources:", error);
    return [];
  }
}

export async function getSourceById(id: string) {
  try {
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
      .where(eq(sourceAccounts.id, id))
      .limit(1);

    if (!source) return null;

    const sourceRefs = await db
      .select({
        id: refs.id,
        url: refs.url,
        summary: refs.summary,
        hookText: refs.hookText,
        status: refs.status,
        savedAt: refs.savedAt,
      })
      .from(refs)
      .where(and(eq(refs.sourceAccountId, id), isNull(refs.archivedAt)))
      .orderBy(desc(refs.savedAt));

    return {
      source,
      sourceRefs,
      canDelete: sourceRefs.length === 0,
    };
  } catch (error) {
    console.warn(`Failed to get source by ID ${id}:`, error);
    return null;
  }
}
