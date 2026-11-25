import "server-only";
import { sql, eq, isNull, desc, asc, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { getOwner } from "@/lib/auth/owner";
import {
  contents,
  posts,
  snapshots,
  pillars,
  contentPillars,
  formats,
  hookTypes,
  series,
  sourceAccounts,
  audios,
  refs,
  platforms,
  appSettings,
} from "@/db/schema";

export interface RankingRow {
  name: string;
  avgRating: number | null;
  medianViews: number;
  sampleSize: number;
  isSmallSample: boolean;
}

export interface OutlierItem {
  id: string;
  title: string;
  finalRating: number | null;
  status: string;
  formatName: string | null;
  hookTypeName: string | null;
  medianViews?: number | null;
}

export interface CheckpointCurveItem {
  contentId: string;
  contentTitle: string;
  platformName: string;
  h24Views: number | null;
  d7Views: number | null;
  d30Views: number | null;
}

export interface InsightData {
  insightMinSample: number;
  summary: {
    medianViews: number;
    measuredContentsCount: number;
    originalContentsCount: number;
    referencedContentsCount: number;
    unusedRefsCount: number;
    unusedAudiosCount: number;
  };
  rankings: {
    pillars: RankingRow[];
    formats: RankingRow[];
    hooks: RankingRow[];
    sources: RankingRow[];
    audio: RankingRow[];
    series: RankingRow[];
  };
  outliers: {
    high: OutlierItem[];
    low: OutlierItem[];
  };
  curves: CheckpointCurveItem[];
}

const EMPTY_INSIGHT: InsightData = {
  insightMinSample: 3,
  summary: {
    medianViews: 0,
    measuredContentsCount: 0,
    originalContentsCount: 0,
    referencedContentsCount: 0,
    unusedRefsCount: 0,
    unusedAudiosCount: 0,
  },
  rankings: {
    pillars: [],
    formats: [],
    hooks: [],
    sources: [],
    audio: [],
    series: [],
  },
  outliers: {
    high: [],
    low: [],
  },
  curves: [],
};

function calcMedian(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

interface DimensionEntry {
  key: string;
  contentId: string;
  finalRating: number | null;
}

function buildRankings(
  entries: DimensionEntry[],
  contentMaxViews: Map<string, number>,
  minSample: number
): RankingRow[] {
  const buckets = new Map<string, Map<string, number | null>>();
  for (const e of entries) {
    if (!e.key) continue;
    let contentMap = buckets.get(e.key);
    if (!contentMap) {
      contentMap = new Map();
      buckets.set(e.key, contentMap);
    }
    if (!contentMap.has(e.contentId)) {
      contentMap.set(e.contentId, e.finalRating);
    }
  }

  const rows: RankingRow[] = [];
  for (const [name, contentMap] of buckets.entries()) {
    const sampleSize = contentMap.size;
    const ratings: number[] = [];
    const viewsList: number[] = [];

    for (const [cid, rating] of contentMap.entries()) {
      if (rating !== null) ratings.push(rating);
      const maxViews = contentMaxViews.get(cid);
      if (maxViews !== undefined) viewsList.push(maxViews);
    }

    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

    rows.push({
      name,
      avgRating,
      medianViews: calcMedian(viewsList),
      sampleSize,
      isSmallSample: sampleSize < minSample,
    });
  }

  return rows.sort((a, b) => {
    if (a.avgRating !== null && b.avgRating !== null && b.avgRating !== a.avgRating) {
      return b.avgRating - a.avgRating;
    }
    if (a.avgRating !== null && b.avgRating === null) return -1;
    if (a.avgRating === null && b.avgRating !== null) return 1;
    if (b.medianViews !== a.medianViews) return b.medianViews - a.medianViews;
    return b.sampleSize - a.sampleSize;
  });
}

export async function getInsightData(explicitUserId?: string): Promise<InsightData> {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) return EMPTY_INSIGHT;

    const [
      [settings],
      snapshotRows,
      allContents,
      unusedRefsRes,
      unusedAudiosRes,
      pillarContentRows,
      sourceContentRows,
      topOutliers,
      bottomOutliers,
      curveContents,
    ] = await Promise.all([
      db
        .select({ insightMinSample: appSettings.insightMinSample })
        .from(appSettings)
        .where(eq(appSettings.userId, userId))
        .limit(1)
        .catch(() => []),

      db
        .select({
          views: snapshots.views,
          rating: snapshots.rating,
          contentId: posts.contentId,
        })
        .from(snapshots)
        .innerJoin(posts, eq(snapshots.postId, posts.id))
        .innerJoin(contents, eq(posts.contentId, contents.id))
        .where(
          and(
            eq(snapshots.userId, userId),
            eq(snapshots.status, "done"),
            isNull(contents.archivedAt)
          )
        ),

      db
        .select({
          id: contents.id,
          finalRating: contents.finalRating,
          formatName: formats.name,
          hookName: hookTypes.name,
          seriesName: series.name,
          audioTitle: audios.title,
          audioArtist: audios.artist,
          hasRefs: sql<boolean>`EXISTS (SELECT 1 FROM ${refs} WHERE ${refs.contentId} = ${contents.id} AND ${refs.userId} = ${userId} AND ${refs.archivedAt} IS NULL)`,
        })
        .from(contents)
        .leftJoin(formats, eq(contents.formatId, formats.id))
        .leftJoin(hookTypes, eq(contents.hookTypeId, hookTypes.id))
        .leftJoin(series, eq(contents.seriesId, series.id))
        .leftJoin(audios, eq(contents.audioId, audios.id))
        .where(and(eq(contents.userId, userId), isNull(contents.archivedAt))),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(refs)
        .where(
          and(
            eq(refs.userId, userId),
            isNull(refs.contentId),
            isNull(refs.archivedAt),
            sql`${refs.status} != 'skipped'`
          )
        ),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(audios)
        .where(
          and(
            eq(audios.userId, userId),
            sql`NOT EXISTS (SELECT 1 FROM ${contents} WHERE ${contents.audioId} = ${audios.id} AND ${contents.userId} = ${userId} AND ${contents.archivedAt} IS NULL)`
          )
        ),

      db
        .select({
          pillarName: pillars.name,
          contentId: contents.id,
          finalRating: contents.finalRating,
        })
        .from(contentPillars)
        .innerJoin(pillars, eq(contentPillars.pillarId, pillars.id))
        .innerJoin(contents, eq(contentPillars.contentId, contents.id))
        .where(and(eq(contents.userId, userId), isNull(contents.archivedAt))),

      db
        .select({
          handle: sourceAccounts.handle,
          contentId: contents.id,
          finalRating: contents.finalRating,
        })
        .from(refs)
        .innerJoin(sourceAccounts, eq(refs.sourceAccountId, sourceAccounts.id))
        .innerJoin(contents, eq(refs.contentId, contents.id))
        .where(and(eq(refs.userId, userId), isNull(refs.archivedAt), isNull(contents.archivedAt))),

      db
        .select({
          id: contents.id,
          title: contents.title,
          finalRating: contents.finalRating,
          status: contents.status,
          formatName: formats.name,
          hookTypeName: hookTypes.name,
        })
        .from(contents)
        .leftJoin(formats, eq(contents.formatId, formats.id))
        .leftJoin(hookTypes, eq(contents.hookTypeId, hookTypes.id))
        .where(
          and(
            eq(contents.userId, userId),
            isNull(contents.archivedAt),
            sql`${contents.finalRating} IS NOT NULL`
          )
        )
        .orderBy(desc(contents.finalRating))
        .limit(5),

      db
        .select({
          id: contents.id,
          title: contents.title,
          finalRating: contents.finalRating,
          status: contents.status,
          formatName: formats.name,
          hookTypeName: hookTypes.name,
        })
        .from(contents)
        .leftJoin(formats, eq(contents.formatId, formats.id))
        .leftJoin(hookTypes, eq(contents.hookTypeId, hookTypes.id))
        .where(
          and(
            eq(contents.userId, userId),
            isNull(contents.archivedAt),
            sql`${contents.finalRating} IS NOT NULL`
          )
        )
        .orderBy(asc(contents.finalRating))
        .limit(5),

      db
        .select({
          contentId: contents.id,
          contentTitle: contents.title,
          platformName: platforms.name,
          checkpoint: snapshots.checkpoint,
          views: snapshots.views,
        })
        .from(contents)
        .innerJoin(posts, eq(posts.contentId, contents.id))
        .innerJoin(platforms, eq(posts.platformId, platforms.id))
        .innerJoin(snapshots, eq(snapshots.postId, posts.id))
        .where(
          and(
            eq(contents.userId, userId),
            isNull(contents.archivedAt),
            eq(snapshots.status, "done")
          )
        )
        .orderBy(desc(contents.createdAt))
        .limit(30),
    ]);

    const insightMinSample = settings?.insightMinSample ?? 3;

    const contentMaxViews = new Map<string, number>();
    const allViews: number[] = [];
    const measuredContentIds = new Set<string>();

    for (const s of snapshotRows) {
      measuredContentIds.add(s.contentId);
      if (s.views !== null) {
        allViews.push(s.views);
        const prev = contentMaxViews.get(s.contentId);
        if (prev === undefined || s.views > prev) {
          contentMaxViews.set(s.contentId, s.views);
        }
      }
    }

    const medianViews = calcMedian(allViews);
    const measuredContentsCount = measuredContentIds.size;
    const originalContentsCount = allContents.filter((c) => !c.hasRefs).length;
    const referencedContentsCount = allContents.filter((c) => c.hasRefs).length;
    const unusedRefsCount = unusedRefsRes[0]?.count || 0;
    const unusedAudiosCount = unusedAudiosRes[0]?.count || 0;

    const pillarRankings = buildRankings(
      pillarContentRows.map((r) => ({
        key: r.pillarName,
        contentId: r.contentId,
        finalRating: r.finalRating,
      })),
      contentMaxViews,
      insightMinSample
    );

    const formatRankings = buildRankings(
      allContents
        .filter((c) => c.formatName)
        .map((c) => ({
          key: c.formatName!,
          contentId: c.id,
          finalRating: c.finalRating,
        })),
      contentMaxViews,
      insightMinSample
    );

    const hookRankings = buildRankings(
      allContents
        .filter((c) => c.hookName)
        .map((c) => ({
          key: c.hookName!,
          contentId: c.id,
          finalRating: c.finalRating,
        })),
      contentMaxViews,
      insightMinSample
    );

    const sourceRankings = buildRankings(
      sourceContentRows.map((s) => ({
        key: `@${s.handle}`,
        contentId: s.contentId,
        finalRating: s.finalRating,
      })),
      contentMaxViews,
      insightMinSample
    );

    const audioRankings = buildRankings(
      allContents
        .filter((c) => c.audioTitle)
        .map((c) => ({
          key: `${c.audioTitle}${c.audioArtist ? ` - ${c.audioArtist}` : ""}`,
          contentId: c.id,
          finalRating: c.finalRating,
        })),
      contentMaxViews,
      insightMinSample
    );

    const seriesRankings = buildRankings(
      allContents
        .filter((c) => c.seriesName)
        .map((c) => ({
          key: c.seriesName!,
          contentId: c.id,
          finalRating: c.finalRating,
        })),
      contentMaxViews,
      insightMinSample
    );

    const curveMap = new Map<string, CheckpointCurveItem>();
    for (const row of curveContents) {
      const key = `${row.contentId}-${row.platformName}`;
      if (!curveMap.has(key)) {
        curveMap.set(key, {
          contentId: row.contentId,
          contentTitle: row.contentTitle,
          platformName: row.platformName,
          h24Views: null,
          d7Views: null,
          d30Views: null,
        });
      }
      const item = curveMap.get(key)!;
      if (row.checkpoint === "h24") item.h24Views = row.views;
      if (row.checkpoint === "d7") item.d7Views = row.views;
      if (row.checkpoint === "d30") item.d30Views = row.views;
    }

    return {
      insightMinSample,
      summary: {
        medianViews,
        measuredContentsCount,
        originalContentsCount,
        referencedContentsCount,
        unusedRefsCount,
        unusedAudiosCount,
      },
      rankings: {
        pillars: pillarRankings,
        formats: formatRankings,
        hooks: hookRankings,
        sources: sourceRankings,
        audio: audioRankings,
        series: seriesRankings,
      },
      outliers: {
        high: topOutliers.map((o) => ({ ...o, medianViews: contentMaxViews.get(o.id) ?? null })),
        low: bottomOutliers.map((o) => ({ ...o, medianViews: contentMaxViews.get(o.id) ?? null })),
      },
      curves: Array.from(curveMap.values()),
    };
  } catch (error) {
    console.warn("Failed to get insight data:", error);
    return EMPTY_INSIGHT;
  }
}
