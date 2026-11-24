import "server-only";
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
  platforms,
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

export async function getSidebarCounts(): Promise<SidebarCounts> {
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
    const now = new Date();

    // 1. Ref counts per status (active only)
    const statusCountsQuery = await db
      .select({
        status: refs.status,
        count: sql<number>`count(*)::int`,
      })
      .from(refs)
      .where(isNull(refs.archivedAt))
      .groupBy(refs.status);

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

    // 2. Active contents count
    const [contentCountRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contents)
      .where(isNull(contents.archivedAt));

    // 3. Due snapshots count
    const [dueSnapshotsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(snapshots)
      .where(
        and(
          eq(snapshots.status, "pending"),
          lte(snapshots.dueAt, sql`now()`)
        )
      );

    // 4. Audios, sources, snippets
    const [audioRes] = await db.select({ count: sql<number>`count(*)::int` }).from(audios);
    const [sourcesRes] = await db.select({ count: sql<number>`count(*)::int` }).from(sourceAccounts);
    const [snippetsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(snippets);

    // 5. Active pillars with count of active refs
    const activePillars = await db
      .select({
        id: pillars.id,
        name: pillars.name,
        slug: pillars.slug,
        sortOrder: pillars.sortOrder,
      })
      .from(pillars)
      .where(eq(pillars.isActive, true))
      .orderBy(pillars.sortOrder);

    const pillarCountsQuery = await db
      .select({
        pillarId: refPillars.pillarId,
        count: sql<number>`count(*)::int`,
      })
      .from(refPillars)
      .innerJoin(refs, and(eq(refPillars.refId, refs.id), isNull(refs.archivedAt)))
      .groupBy(refPillars.pillarId);

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
      contents: Number(contentCountRes?.count) || 0,
      evaluate: Number(dueSnapshotsRes?.count) || 0,
      audio: Number(audioRes?.count) || 0,
      sources: Number(sourcesRes?.count) || 0,
      captions: Number(snippetsRes?.count) || 0,
      pillars: pillarList,
      statuses: statusMap,
    };
  } catch (error) {
    console.error("Failed to fetch sidebar counts:", error);
    return defaultCounts;
  }
}

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

export async function getHomeData(): Promise<HomeData> {
  const counts = await getSidebarCounts();

  try {
    // 1. Weekly target & posts this week (WIB timezone, Monday-Sunday)
    let weeklyTarget = 3;
    const [settings] = await db.select({ weeklyPostTarget: appSettings.weeklyPostTarget }).from(appSettings).limit(1);
    if (settings?.weeklyPostTarget) {
      weeklyTarget = settings.weeklyPostTarget;
    }

    // Posts posted in the last 7 days / this week
    const [weeklyPostsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(sql`posted_at >= date_trunc('week', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'`);

    // 2. Recent 6 references
    const recentRefsQuery = await db
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
      .limit(6);

    return {
      counts,
      weeklyTarget: {
        target: weeklyTarget,
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
    return {
      counts,
      weeklyTarget: { target: 3, posted: 0 },
      recentRefs: [],
    };
  }
}
