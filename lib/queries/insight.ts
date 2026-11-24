import "server-only";
import { sql, eq, isNull, desc, asc, and } from "drizzle-orm";
import { db } from "@/lib/db";
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
} from "@/db/schema";

export interface RankingRow {
  name: string;
  avgRating: number | null;
  medianViews: number;
  sampleSize: number;
  isSmallSample: boolean; // n < 3 per PRD §12.16
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

export async function getInsightData(): Promise<InsightData> {
  try {
    // 1. Gather all filled snapshot views and ratings
    const snapshotRows = await db
      .select({
        views: snapshots.views,
        rating: snapshots.rating,
        contentId: posts.contentId,
        checkpoint: snapshots.checkpoint,
        platformId: posts.platformId,
      })
      .from(snapshots)
      .innerJoin(posts, eq(snapshots.postId, posts.id))
      .where(eq(snapshots.status, "done"));

    const allViews = snapshotRows
      .map((s) => s.views)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    // Calculate median views
    let medianViews = 0;
    if (allViews.length > 0) {
      const mid = Math.floor(allViews.length / 2);
      medianViews =
        allViews.length % 2 !== 0
          ? allViews[mid]
          : Math.round((allViews[mid - 1] + allViews[mid]) / 2);
    }

    // 2. Count distinct contents with metrics
    const measuredContentIds = new Set(snapshotRows.map((s) => s.contentId));
    const measuredContentsCount = measuredContentIds.size;

    // 3. Original vs Referenced count
    const allContents = await db
      .select({
        id: contents.id,
        hasRefs: sql<boolean>`EXISTS (SELECT 1 FROM ${refs} WHERE ${refs.contentId} = ${contents.id})`,
      })
      .from(contents)
      .where(isNull(contents.archivedAt));

    const originalContentsCount = allContents.filter((c) => !c.hasRefs).length;
    const referencedContentsCount = allContents.filter((c) => c.hasRefs).length;

    // 4. Unused references and audio counts
    const [unusedRefsRes, unusedAudiosRes] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(refs)
        .where(
          and(
            isNull(refs.contentId),
            isNull(refs.archivedAt),
            sql`${refs.status} != 'skipped'`
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(audios)
        .where(
          sql`NOT EXISTS (SELECT 1 FROM ${contents} WHERE ${contents.audioId} = ${audios.id} AND ${contents.archivedAt} IS NULL)`
        ),
    ]);

    const unusedRefsCount = unusedRefsRes[0]?.count || 0;
    const unusedAudiosCount = unusedAudiosRes[0]?.count || 0;

    // 5. Pillar Rankings (PRD §12.16)
    const pillarRows = await db
      .select({
        pillarName: pillars.name,
        avgRating: sql<number | null>`round(avg(${contents.finalRating})::numeric, 1)`,
        sampleSize: sql<number>`count(distinct ${contents.id})::int`,
      })
      .from(pillars)
      .innerJoin(contentPillars, eq(contentPillars.pillarId, pillars.id))
      .innerJoin(contents, eq(contentPillars.contentId, contents.id))
      .where(isNull(contents.archivedAt))
      .groupBy(pillars.name)
      .orderBy(desc(sql`count(distinct ${contents.id})`));

    const pillarRankings: RankingRow[] = pillarRows.map((p) => ({
      name: p.pillarName,
      avgRating: p.avgRating ? Number(p.avgRating) : null,
      medianViews: 0,
      sampleSize: p.sampleSize,
      isSmallSample: p.sampleSize < 3,
    }));

    // 6. Format Rankings
    const formatRows = await db
      .select({
        formatName: formats.name,
        avgRating: sql<number | null>`round(avg(${contents.finalRating})::numeric, 1)`,
        sampleSize: sql<number>`count(distinct ${contents.id})::int`,
      })
      .from(formats)
      .innerJoin(contents, eq(contents.formatId, formats.id))
      .where(isNull(contents.archivedAt))
      .groupBy(formats.name)
      .orderBy(desc(sql`count(distinct ${contents.id})`));

    const formatRankings: RankingRow[] = formatRows.map((f) => ({
      name: f.formatName,
      avgRating: f.avgRating ? Number(f.avgRating) : null,
      medianViews: 0,
      sampleSize: f.sampleSize,
      isSmallSample: f.sampleSize < 3,
    }));

    // 7. Hook Type Rankings
    const hookRows = await db
      .select({
        hookName: hookTypes.name,
        avgRating: sql<number | null>`round(avg(${contents.finalRating})::numeric, 1)`,
        sampleSize: sql<number>`count(distinct ${contents.id})::int`,
      })
      .from(hookTypes)
      .innerJoin(contents, eq(contents.hookTypeId, hookTypes.id))
      .where(isNull(contents.archivedAt))
      .groupBy(hookTypes.name)
      .orderBy(desc(sql`count(distinct ${contents.id})`));

    const hookRankings: RankingRow[] = hookRows.map((h) => ({
      name: h.hookName,
      avgRating: h.avgRating ? Number(h.avgRating) : null,
      medianViews: 0,
      sampleSize: h.sampleSize,
      isSmallSample: h.sampleSize < 3,
    }));

    // 8. Sources Rankings
    const sourceRows = await db
      .select({
        handle: sourceAccounts.handle,
        avgRating: sql<number | null>`round(avg(${contents.finalRating})::numeric, 1)`,
        sampleSize: sql<number>`count(distinct ${contents.id})::int`,
      })
      .from(sourceAccounts)
      .innerJoin(refs, eq(refs.sourceAccountId, sourceAccounts.id))
      .innerJoin(contents, eq(refs.contentId, contents.id))
      .where(isNull(contents.archivedAt))
      .groupBy(sourceAccounts.handle)
      .orderBy(desc(sql`count(distinct ${contents.id})`));

    const sourceRankings: RankingRow[] = sourceRows.map((s) => ({
      name: `@${s.handle}`,
      avgRating: s.avgRating ? Number(s.avgRating) : null,
      medianViews: 0,
      sampleSize: s.sampleSize,
      isSmallSample: s.sampleSize < 3,
    }));

    // 9. Audio Rankings
    const audioRows = await db
      .select({
        title: audios.title,
        artist: audios.artist,
        avgRating: sql<number | null>`round(avg(${contents.finalRating})::numeric, 1)`,
        sampleSize: sql<number>`count(distinct ${contents.id})::int`,
      })
      .from(audios)
      .innerJoin(contents, eq(contents.audioId, audios.id))
      .where(isNull(contents.archivedAt))
      .groupBy(audios.title, audios.artist)
      .orderBy(desc(sql`count(distinct ${contents.id})`));

    const audioRankings: RankingRow[] = audioRows.map((a) => ({
      name: `${a.title}${a.artist ? ` - ${a.artist}` : ""}`,
      avgRating: a.avgRating ? Number(a.avgRating) : null,
      medianViews: 0,
      sampleSize: a.sampleSize,
      isSmallSample: a.sampleSize < 3,
    }));

    // 10. Series Rankings
    const seriesRows = await db
      .select({
        seriesName: series.name,
        avgRating: sql<number | null>`round(avg(${contents.finalRating})::numeric, 1)`,
        sampleSize: sql<number>`count(distinct ${contents.id})::int`,
      })
      .from(series)
      .innerJoin(contents, eq(contents.seriesId, series.id))
      .where(isNull(contents.archivedAt))
      .groupBy(series.name)
      .orderBy(desc(sql`count(distinct ${contents.id})`));

    const seriesRankings: RankingRow[] = seriesRows.map((sr) => ({
      name: sr.seriesName,
      avgRating: sr.avgRating ? Number(sr.avgRating) : null,
      medianViews: 0,
      sampleSize: sr.sampleSize,
      isSmallSample: sr.sampleSize < 3,
    }));

    // 11. Top & Bottom Outliers (PRD §12.16 & FR-63)
    const baseOutlierQuery = db
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
      .where(and(isNull(contents.archivedAt), sql`${contents.finalRating} IS NOT NULL`));

    const [topOutliers, bottomOutliers] = await Promise.all([
      baseOutlierQuery.orderBy(desc(contents.finalRating)).limit(5),
      baseOutlierQuery.orderBy(asc(contents.finalRating)).limit(5),
    ]);

    // 12. Checkpoint Curve Data (PRD §12.16)
    const curveContents = await db
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
      .where(and(isNull(contents.archivedAt), eq(snapshots.status, "done")))
      .orderBy(desc(contents.createdAt))
      .limit(30);

    // Group by content + platform
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
        high: topOutliers,
        low: bottomOutliers,
      },
      curves: Array.from(curveMap.values()),
    };
  } catch (error) {
    console.warn("Failed to get insight data:", error);
    return {
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
  }
}
