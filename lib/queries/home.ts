import "server-only";
import { cache } from "react";
import { sql, eq, and, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  refs,
  contents,
  snapshots,
  audios,
  sourceAccounts,
  snippets,
  pillars,
  refPillars,
  posts,
  appSettings,
} from "@/db/schema";

export type SidebarCounts = {
  inbox: number;
  references: number;
  contents: number;
  evaluate: number;
  audio: number;
  sources: number;
  captions: number;
  pillars: { id: string; name: string; slug: string; count: number }[];
  statuses: {
    inbox: number;
    selected: number;
    production: number;
    posted: number;
    evaluating: number;
    skipped: number;
  };
};

export const getSidebarCounts = cache(async (): Promise<SidebarCounts> => {
  const defaultCounts: SidebarCounts = {
    inbox: 0,
    references: 0,
    contents: 0,
    evaluate: 0,
    audio: 0,
    sources: 0,
    captions: 0,
    pillars: [],
    statuses: {
      inbox: 0,
      selected: 0,
      production: 0,
      posted: 0,
      evaluating: 0,
      skipped: 0,
    },
  };

  try {
    // Run all count queries concurrently in parallel
    const [
      statusCountsQuery,
      contentCountRes,
      dueSnapshotsRes,
      audioRes,
      sourcesRes,
      snippetsRes,
      activePillars,
      pillarCountsQuery,
    ] = await Promise.all([
      // 1. Status counts
      db
        .select({
          status: refs.status,
          count: sql<number>`count(*)::int`,
        })
        .from(refs)
        .where(isNull(refs.archivedAt))
        .groupBy(refs.status),

      // 2. Content count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contents)
        .where(isNull(contents.archivedAt)),

      // 3. Due snapshots
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(snapshots)
        .where(
          and(
            eq(snapshots.status, "pending"),
            lte(snapshots.dueAt, sql`now()`)
          )
        ),

      // 4. Audios
      db.select({ count: sql<number>`count(*)::int` }).from(audios),

      // 5. Sources
      db.select({ count: sql<number>`count(*)::int` }).from(sourceAccounts),

      // 6. Snippets
      db.select({ count: sql<number>`count(*)::int` }).from(snippets),

      // 7. Active pillars
      db
        .select({
          id: pillars.id,
          name: pillars.name,
          slug: pillars.slug,
          sortOrder: pillars.sortOrder,
        })
        .from(pillars)
        .where(eq(pillars.isActive, true))
        .orderBy(pillars.sortOrder),

      // 8. Pillar reference counts
      db
        .select({
          pillarId: refPillars.pillarId,
          count: sql<number>`count(*)::int`,
        })
        .from(refPillars)
        .innerJoin(refs, and(eq(refPillars.refId, refs.id), isNull(refs.archivedAt)))
        .groupBy(refPillars.pillarId),
    ]);

    const statusMap = {
      inbox: 0,
      selected: 0,
      production: 0,
      posted: 0,
      evaluating: 0,
      skipped: 0,
    };

    let totalActiveRefs = 0;
    for (const row of statusCountsQuery) {
      if (row.status && row.status in statusMap) {
        statusMap[row.status as keyof typeof statusMap] = Number(row.count) || 0;
      }
      totalActiveRefs += Number(row.count) || 0;
    }

    const pillarCountMap = new Map<string, number>();
    for (const row of pillarCountsQuery) {
      pillarCountMap.set(row.pillarId, Number(row.count) || 0);
    }

    const pillarList = activePillars.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      count: pillarCountMap.get(p.id) || 0,
    }));

    return {
      inbox: statusMap.inbox,
      references: totalActiveRefs,
      contents: Number(contentCountRes[0]?.count) || 0,
      evaluate: Number(dueSnapshotsRes[0]?.count) || 0,
      audio: Number(audioRes[0]?.count) || 0,
      sources: Number(sourcesRes[0]?.count) || 0,
      captions: Number(snippetsRes[0]?.count) || 0,
      pillars: pillarList,
      statuses: statusMap,
    };
  } catch (error) {
    console.error("Failed to fetch sidebar counts:", error);
    return defaultCounts;
  }
});

export type HomeData = {
  counts: SidebarCounts;
  weeklyTarget: {
    target: number;
    posted: number;
  };
  recentRefs: {
    id: string;
    url: string;
    summary: string | null;
    status: string;
    savedAt: string;
  }[];
};

export const getHomeData = cache(async (): Promise<HomeData> => {
  const countsPromise = getSidebarCounts();

  try {
    const [counts, [settings], [weeklyPostsRes], recentRefsQuery] = await Promise.all([
      countsPromise,
      db
        .select({ weeklyPostTarget: appSettings.weeklyPostTarget })
        .from(appSettings)
        .limit(1),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(
          sql`posted_at >= date_trunc('week', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'`
        ),
      db
        .select({
          id: refs.id,
          url: refs.url,
          summary: refs.summary,
          status: refs.status,
          savedAt: refs.savedAt,
        })
        .from(refs)
        .where(isNull(refs.archivedAt))
        .orderBy(sql`${refs.savedAt} desc`)
        .limit(6),
    ]);

    return {
      counts,
      weeklyTarget: {
        target: settings?.weeklyPostTarget || 3,
        posted: Number(weeklyPostsRes?.count) || 0,
      },
      recentRefs: recentRefsQuery.map((r) => ({
        id: r.id,
        url: r.url,
        summary: r.summary,
        status: r.status,
        savedAt: r.savedAt,
      })),
    };
  } catch (err) {
    console.error("Failed to fetch home data:", err);
    const counts = await countsPromise;
    return {
      counts,
      weeklyTarget: { target: 3, posted: 0 },
      recentRefs: [],
    };
  }
});
