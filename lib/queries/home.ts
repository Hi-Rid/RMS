import "server-only";
import { cache } from "react";
import { sql, eq, and, isNull, desc, asc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { getOwner } from "@/lib/auth/owner";
import { startOfWeek as getWibWeekStart } from "@/lib/domain/time";
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
  platforms,
} from "@/db/schema";

const WIB_YMD_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const WIB_TODAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const WIB_SHORT_DAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
});

function toWibYmd(date: Date): string {
  return WIB_YMD_FORMATTER.format(date);
}

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

export const getSidebarCounts = cache(async (explicitUserId?: string): Promise<SidebarCounts> => {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) return defaultCounts;

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
        .where(and(eq(refs.userId, userId), isNull(refs.archivedAt)))
        .groupBy(refs.status)
        .catch(() => []),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contents)
        .where(and(eq(contents.userId, userId), isNull(contents.archivedAt)))
        .catch(() => [{ count: 0 }]),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(snapshots)
        .where(
          and(
            eq(snapshots.userId, userId),
            eq(snapshots.status, "pending"),
            sql`${snapshots.dueAt} <= now()`
          )
        )
        .catch(() => [{ count: 0 }]),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(audios)
        .where(eq(audios.userId, userId))
        .catch(() => [{ count: 0 }]),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(sourceAccounts)
        .where(eq(sourceAccounts.userId, userId))
        .catch(() => [{ count: 0 }]),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(snippets)
        .where(eq(snippets.userId, userId))
        .catch(() => [{ count: 0 }]),

      db
        .select({
          id: pillars.id,
          name: pillars.name,
          slug: pillars.slug,
          sortOrder: pillars.sortOrder,
        })
        .from(pillars)
        .where(and(eq(pillars.userId, userId), eq(pillars.isActive, true)))
        .orderBy(pillars.sortOrder)
        .catch(() => []),

      db
        .select({
          pillarId: refPillars.pillarId,
          count: sql<number>`count(*)::int`,
        })
        .from(refPillars)
        .innerJoin(
          refs,
          and(eq(refPillars.refId, refs.id), eq(refs.userId, userId), isNull(refs.archivedAt))
        )
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
  wibTodayYmd: string;
  wibTodayLabel: string;
  wibWeekLabel: string;
  readiness: {
    hasIngestToken: boolean;
    aiKeyReady: boolean;
    aiEnabled: boolean;
    aiAutoEnrich: boolean;
    aiIngestMode: "inbox" | "selected" | "auto_draft";
  };
  weeklyTarget: {
    target: number;
    posted: number;
  };
  upcomingCheckpointsCount: number;
  dueCheckpoints: {
    id: string;
    checkpoint: string;
    dueAt: string;
    contentId: string;
    contentTitle: string;
    platformName: string;
  }[];
  plannedThisWeek: {
    id: string;
    title: string;
    status: string;
    plannedFor: string;
    formatName: string | null;
    checklistTotal: number;
    checklistDone: number;
  }[];
  recentRefs: {
    id: string;
    url: string;
    summary: string | null;
    hookText: string | null;
    status: string;
    savedAt: string;
    platformName: string;
    platformSlug: string;
    formatName: string | null;
    sourceHandle: string | null;
  }[];
  activeContents: {
    id: string;
    title: string;
    formatName: string | null;
    plannedFor: string | null;
    refsCount: number;
    checklistTotal: number;
    checklistDone: number;
  }[];
};

const defaultHomeData: HomeData = {
  counts: defaultCounts,
  wibTodayYmd: "",
  wibTodayLabel: "WIB",
  wibWeekLabel: "This Week",
  readiness: {
    hasIngestToken: false,
    aiKeyReady: false,
    aiEnabled: false,
    aiAutoEnrich: true,
    aiIngestMode: "inbox",
  },
  weeklyTarget: { target: 3, posted: 0 },
  upcomingCheckpointsCount: 0,
  dueCheckpoints: [],
  plannedThisWeek: [],
  recentRefs: [],
  activeContents: [],
};

export const getHomeData = cache(async (explicitUserId?: string): Promise<HomeData> => {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) {
      return defaultHomeData;
    }

    const current = new Date();
    const weekStartDate = getWibWeekStart(current);
    const weekEndInclusive = new Date(weekStartDate.getTime() + 6 * 86_400_000);
    const weekEndExclusive = new Date(weekStartDate.getTime() + 7 * 86_400_000);

    const wibTodayYmd = toWibYmd(current);
    const weekStartYmd = toWibYmd(weekStartDate);
    const weekEndYmd = toWibYmd(weekEndInclusive);
    const wibTodayLabel = `${WIB_TODAY_FORMATTER.format(current)} · WIB`;
    const wibWeekLabel = `${WIB_SHORT_DAY_FORMATTER.format(weekStartDate)} – ${WIB_SHORT_DAY_FORMATTER.format(weekEndInclusive)}`;

    const [
      counts,
      settingsQuery,
      weeklyPostsRes,
      recentRefsQuery,
      activeContentsQuery,
      dueCheckpointsQuery,
      upcomingCheckpointsRes,
      plannedThisWeekQuery,
    ] = await Promise.all([
      getSidebarCounts(userId),

      db
        .select({
          weeklyPostTarget: appSettings.weeklyPostTarget,
          ingestTokenHash: appSettings.ingestTokenHash,
          aiEnabled: appSettings.aiEnabled,
          aiAutoEnrich: appSettings.aiAutoEnrich,
          aiIngestMode: appSettings.aiIngestMode,
          aiApiKeyEnc: appSettings.aiApiKeyEnc,
        })
        .from(appSettings)
        .where(eq(appSettings.userId, userId))
        .limit(1)
        .catch(() => []),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(
          and(
            eq(posts.userId, userId),
            sql`${posts.postedAt} >= ${weekStartDate.toISOString()}::timestamptz AND ${posts.postedAt} < ${weekEndExclusive.toISOString()}::timestamptz`
          )
        )
        .catch(() => [{ count: 0 }]),

      db
        .select({
          id: refs.id,
          url: refs.url,
          summary: refs.summary,
          hookText: refs.hookText,
          status: refs.status,
          savedAt: refs.savedAt,
          platformName: platforms.name,
          platformSlug: platforms.slug,
          formatName: formats.name,
          sourceHandle: sourceAccounts.handle,
        })
        .from(refs)
        .innerJoin(platforms, eq(refs.platformId, platforms.id))
        .leftJoin(formats, eq(refs.formatId, formats.id))
        .leftJoin(sourceAccounts, eq(refs.sourceAccountId, sourceAccounts.id))
        .where(and(eq(refs.userId, userId), isNull(refs.archivedAt)))
        .orderBy(sql`${refs.savedAt} desc`)
        .limit(6)
        .catch(() => []),

      db
        .select({
          id: contents.id,
          title: contents.title,
          plannedFor: contents.plannedFor,
          formatName: formats.name,
        })
        .from(contents)
        .leftJoin(formats, eq(contents.formatId, formats.id))
        .where(
          and(
            eq(contents.userId, userId),
            eq(contents.status, "production"),
            isNull(contents.archivedAt)
          )
        )
        .orderBy(desc(contents.updatedAt))
        .limit(5)
        .catch(() => []),

      db
        .select({
          id: snapshots.id,
          checkpoint: snapshots.checkpoint,
          dueAt: snapshots.dueAt,
          contentId: contents.id,
          contentTitle: contents.title,
          platformName: platforms.name,
        })
        .from(snapshots)
        .innerJoin(posts, eq(snapshots.postId, posts.id))
        .innerJoin(contents, eq(posts.contentId, contents.id))
        .innerJoin(platforms, eq(posts.platformId, platforms.id))
        .where(
          and(
            eq(snapshots.userId, userId),
            eq(snapshots.status, "pending"),
            sql`${snapshots.dueAt} <= now()`
          )
        )
        .orderBy(asc(snapshots.dueAt))
        .limit(4)
        .catch(() => []),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(snapshots)
        .where(
          and(
            eq(snapshots.userId, userId),
            eq(snapshots.status, "pending"),
            sql`${snapshots.dueAt} > now()`
          )
        )
        .catch(() => [{ count: 0 }]),

      db
        .select({
          id: contents.id,
          title: contents.title,
          status: contents.status,
          plannedFor: contents.plannedFor,
          formatName: formats.name,
        })
        .from(contents)
        .leftJoin(formats, eq(contents.formatId, formats.id))
        .where(
          and(
            eq(contents.userId, userId),
            isNull(contents.archivedAt),
            sql`${contents.plannedFor} >= ${weekStartYmd}::date AND ${contents.plannedFor} <= ${weekEndYmd}::date`
          )
        )
        .orderBy(asc(contents.plannedFor))
        .limit(6)
        .catch(() => []),
    ]);

    const settingsRow = settingsQuery?.[0];
    const weeklyTarget = settingsRow?.weeklyPostTarget ?? 3;
    const weeklyPosted = Number(weeklyPostsRes?.[0]?.count) || 0;
    const aiKeyReady = Boolean(
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        settingsRow?.aiApiKeyEnc
    );

    const activeIds = (activeContentsQuery || []).map((c) => c.id);
    const plannedIds = (plannedThisWeekQuery || []).map((c) => c.id);
    const allContentIds = Array.from(new Set([...activeIds, ...plannedIds]));

    const [checklistRows, linkedRefRows] = await Promise.all([
      allContentIds.length > 0
        ? db
            .select({
              contentId: contentChecklist.contentId,
              isDone: contentChecklist.isDone,
            })
            .from(contentChecklist)
            .where(inArray(contentChecklist.contentId, allContentIds))
            .catch(() => [])
        : Promise.resolve([]),
      activeIds.length > 0
        ? db
            .select({
              contentId: refs.contentId,
              count: sql<number>`count(*)::int`,
            })
            .from(refs)
            .where(and(inArray(refs.contentId, activeIds), isNull(refs.archivedAt)))
            .groupBy(refs.contentId)
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const checklistMap = new Map<string, { total: number; done: number }>();
    for (const row of checklistRows) {
      const stat = checklistMap.get(row.contentId) || { total: 0, done: 0 };
      stat.total += 1;
      if (row.isDone) stat.done += 1;
      checklistMap.set(row.contentId, stat);
    }

    const refsCountMap = new Map<string, number>();
    for (const row of linkedRefRows) {
      if (row.contentId) {
        refsCountMap.set(row.contentId, Number(row.count) || 0);
      }
    }

    return {
      counts,
      wibTodayYmd,
      wibTodayLabel,
      wibWeekLabel,
      readiness: {
        hasIngestToken: Boolean(settingsRow?.ingestTokenHash),
        aiKeyReady,
        aiEnabled: settingsRow?.aiEnabled ?? false,
        aiAutoEnrich: settingsRow?.aiAutoEnrich ?? true,
        aiIngestMode:
          (settingsRow?.aiIngestMode as "inbox" | "selected" | "auto_draft" | undefined) ||
          "inbox",
      },
      weeklyTarget: {
        target: weeklyTarget,
        posted: weeklyPosted,
      },
      upcomingCheckpointsCount: Number(upcomingCheckpointsRes?.[0]?.count) || 0,
      dueCheckpoints: (dueCheckpointsQuery || []).map((cp) => ({
        id: cp.id,
        checkpoint: cp.checkpoint,
        dueAt: cp.dueAt ? String(cp.dueAt) : current.toISOString(),
        contentId: cp.contentId,
        contentTitle: cp.contentTitle,
        platformName: cp.platformName,
      })),
      plannedThisWeek: (plannedThisWeekQuery || [])
        .filter((p) => Boolean(p.plannedFor))
        .map((p) => {
          const stats = checklistMap.get(p.id) || { total: 0, done: 0 };
          return {
            id: p.id,
            title: p.title,
            status: p.status,
            plannedFor: String(p.plannedFor),
            formatName: p.formatName,
            checklistTotal: stats.total,
            checklistDone: stats.done,
          };
        }),
      recentRefs: (recentRefsQuery || []).map((r) => ({
        id: r.id,
        url: r.url,
        summary: r.summary,
        hookText: r.hookText,
        status: r.status,
        savedAt: r.savedAt ? String(r.savedAt) : current.toISOString(),
        platformName: r.platformName,
        platformSlug: r.platformSlug,
        formatName: r.formatName,
        sourceHandle: r.sourceHandle,
      })),
      activeContents: (activeContentsQuery || []).map((c) => {
        const stats = checklistMap.get(c.id) || { total: 0, done: 0 };
        return {
          id: c.id,
          title: c.title,
          formatName: c.formatName,
          plannedFor: c.plannedFor ? String(c.plannedFor) : null,
          refsCount: refsCountMap.get(c.id) || 0,
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
