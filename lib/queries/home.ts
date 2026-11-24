import "server-only";
import { cache } from "react";
import { sql, eq, and, isNull } from "drizzle-orm";
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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export const getSidebarCounts = cache(async (): Promise<SidebarCounts> => {
  const fetchCounts = async (): Promise<SidebarCounts> => {
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
          .groupBy(refs.status),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(contents)
          .where(isNull(contents.archivedAt)),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(snapshots)
          .where(
            and(
              eq(snapshots.status, "pending"),
              sql`${snapshots.dueAt} <= now()`
            )
          ),

        db.select({ count: sql<number>`count(*)::int` }).from(audios),
        db.select({ count: sql<number>`count(*)::int` }).from(sourceAccounts),
        db.select({ count: sql<number>`count(*)::int` }).from(snippets),

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
    } catch (err) {
      console.error("Error in getSidebarCounts:", err);
      return defaultCounts;
    }
  };

  return withTimeout(fetchCounts(), 3000, defaultCounts);
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

const defaultHomeData: HomeData = {
  counts: defaultCounts,
  weeklyTarget: { target: 3, posted: 0 },
  recentRefs: [],
};

export const getHomeData = cache(async (): Promise<HomeData> => {
  const fetchHome = async (): Promise<HomeData> => {
    try {
      const [counts, settingsQuery, weeklyPostsRes, recentRefsQuery] = await Promise.all([
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
      ]);

      const weeklyTarget = settingsQuery[0]?.weeklyPostTarget ?? 3;
      const weeklyPosted = Number(weeklyPostsRes[0]?.count) || 0;

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
      };
    } catch (err) {
      console.error("Error in getHomeData:", err);
      const counts = await getSidebarCounts();
      return {
        counts,
        weeklyTarget: { target: 3, posted: 0 },
        recentRefs: [],
      };
    }
  };

  return withTimeout(fetchHome(), 3500, defaultHomeData);
});
