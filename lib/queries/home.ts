import "server-only";
import { cache } from "react";
import { sql, eq, and, isNull, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  refs,
  contents,
  contentChecklist,
  snapshots,
  audios,
  sourceAccounts,
  snippets,
  pillars,
  refPillars,
  posts,
  appSettings,
  formats,
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

export const getSidebarCounts = cache(async (): Promise<SidebarCounts> => {
  try {
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
      db
        .select({
          status: refs.status,
          count: sql<number>`count(*)::int`,
        })
        .from(refs)
        .where(isNull(refs.archivedAt))
        .groupBy(refs.status)
        .catch(() => []),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contents)
        .where(isNull(contents.archivedAt))
        .catch(() => [{ count: 0 }]),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(snapshots)
        .where(
          and(
            eq(snapshots.status, "pending"),
            sql`${snapshots.dueAt} <= now()`
          )
        )
        .catch(() => [{ count: 0 }]),

      db.select({ count: sql<number>`count(*)::int` }).from(audios).catch(() => [{ count: 0 }]),
      db.select({ count: sql<number>`count(*)::int` }).from(sourceAccounts).catch(() => [{ count: 0 }]),
      db.select({ count: sql<number>`count(*)::int` }).from(snippets).catch(() => [{ count: 0 }]),

      db
        .select({
          id: pillars.id,
          name: pillars.name,
          slug: pillars.slug,
          sortOrder: pillars.sortOrder,
        })
        .from(pillars)
        .where(eq(pillars.isActive, true))
        .orderBy(pillars.sortOrder)
        .catch(() => []),

      db
        .select({
          pillarId: refPillars.pillarId,
          count: sql<number>`count(*)::int`,
        })
        .from(refPillars)
        .innerJoin(refs, and(eq(refPillars.refId, refs.id), isNull(refs.archivedAt)))
        .groupBy(refPillars.pillarId)
        .catch(() => []),
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
    for (const row of statusCountsQuery || []) {
      if (row.status && row.status in statusMap) {
        statusMap[row.status as keyof typeof statusMap] = Number(row.count) || 0;
      }
      totalActiveRefs += Number(row.count) || 0;
    }

    const pillarCountMap = new Map<string, number>();
    for (const row of pillarCountsQuery || []) {
      pillarCountMap.set(row.pillarId, Number(row.count) || 0);
    }

    const pillarList = (activePillars || []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      count: pillarCountMap.get(p.id) || 0,
    }));

    return {
      inbox: statusMap.inbox,
      references: totalActiveRefs,
      contents: Number(contentCountRes?.[0]?.count) || 0,
      evaluate: Number(dueSnapshotsRes?.[0]?.count) || 0,
      audio: Number(audioRes?.[0]?.count) || 0,
      sources: Number(sourcesRes?.[0]?.count) || 0,
      captions: Number(snippetsRes?.[0]?.count) || 0,
      pillars: pillarList,
      statuses: statusMap,
    };
  } catch (err) {
    console.error("Error in getSidebarCounts:", err);
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
  activeContents: {
    id: string;
    title: string;
    formatName: string | null;
    checklistTotal: number;
    checklistDone: number;
  }[];
};

const defaultHomeData: HomeData = {
  counts: defaultCounts,
  weeklyTarget: { target: 3, posted: 0 },
  recentRefs: [],
  activeContents: [],
};

export const getHomeData = cache(async (): Promise<HomeData> => {
  try {
    const [counts, settingsQuery, weeklyPostsRes, recentRefsQuery, activeContentsQuery] = await Promise.all([
      getSidebarCounts(),
      db
        .select({ weeklyPostTarget: appSettings.weeklyPostTarget })
        .from(appSettings)
        .limit(1)
        .catch(() => []),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(
          sql`posted_at >= date_trunc('week', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'`
        )
        .catch(() => [{ count: 0 }]),
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
        .limit(6)
        .catch(() => []),
      db
        .select({
          id: contents.id,
          title: contents.title,
          formatName: formats.name,
        })
        .from(contents)
        .leftJoin(formats, eq(contents.formatId, formats.id))
        .where(and(eq(contents.status, "production"), isNull(contents.archivedAt)))
        .orderBy(desc(contents.updatedAt))
        .limit(4)
        .catch(() => []),
    ]);

    const weeklyTarget = settingsQuery?.[0]?.weeklyPostTarget ?? 3;
    const weeklyPosted = Number(weeklyPostsRes?.[0]?.count) || 0;

    const activeIds = (activeContentsQuery || []).map((c) => c.id);
    const checklistRows =
      activeIds.length > 0
        ? await db
            .select({
              contentId: contentChecklist.contentId,
              isDone: contentChecklist.isDone,
            })
            .from(contentChecklist)
            .where(inArray(contentChecklist.contentId, activeIds))
            .catch(() => [])
        : [];

    const checklistMap = new Map<string, { total: number; done: number }>();
    for (const row of checklistRows) {
      const stat = checklistMap.get(row.contentId) || { total: 0, done: 0 };
      stat.total += 1;
      if (row.isDone) stat.done += 1;
      checklistMap.set(row.contentId, stat);
    }

    return {
      counts,
      weeklyTarget: {
        target: weeklyTarget,
        posted: weeklyPosted,
      },
      recentRefs: (recentRefsQuery || []).map((r) => ({
        id: r.id,
        url: r.url,
        summary: r.summary,
        status: r.status,
        savedAt: r.savedAt ? String(r.savedAt) : new Date().toISOString(),
      })),
      activeContents: (activeContentsQuery || []).map((c) => {
        const stats = checklistMap.get(c.id) || { total: 0, done: 0 };
        return {
          id: c.id,
          title: c.title,
          formatName: c.formatName,
          checklistTotal: stats.total,
          checklistDone: stats.done,
        };
      }),
    };
  } catch (err) {
    console.error("Error in getHomeData:", err);
    return defaultHomeData;
  }
});
