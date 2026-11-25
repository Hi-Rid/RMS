import "server-only";
import { eq, desc, sql, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { getOwner } from "@/lib/auth/owner";
import { DEFAULT_CHECKLIST } from "@/lib/auth/workspace-defaults";
import {
  appSettings,
  pillars,
  series,
  formats,
  hookTypes,
  platforms,
  systemLogs,
  aiUsage,
  refPillars,
  contentPillars,
  refs,
  contents,
  posts,
} from "@/db/schema";

export interface AppSettingsQuery {
  hasToken: boolean;
  ingestTokenHint: string | null;
  ingestTokenRotatedAt: string | null;
  weeklyPostTarget: number;
  insightMinSample: number;
  defaultChecklist: string[];
  aiEnabled: boolean;
  aiProvider: string;
  aiTextModel: string | null;
  aiVisionModel: string | null;
  aiEmbedModel: string | null;
  aiDailyCap: number;
  aiOutputLanguage: string;
  aiUsedToday: number;
}

const DEFAULT_SETTINGS_RETURN: AppSettingsQuery = {
  hasToken: false,
  ingestTokenHint: null,
  ingestTokenRotatedAt: null,
  weeklyPostTarget: 3,
  insightMinSample: 3,
  defaultChecklist: DEFAULT_CHECKLIST,
  aiEnabled: true,
  aiProvider: "google",
  aiTextModel: "gemini-flash-lite-latest",
  aiVisionModel: null,
  aiEmbedModel: null,
  aiDailyCap: 100,
  aiOutputLanguage: "id",
  aiUsedToday: 0,
};

export async function getAppSettings(explicitUserId?: string): Promise<AppSettingsQuery> {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) return DEFAULT_SETTINGS_RETURN;

    const [[settings], [usageTodayRes]] = await Promise.all([
      db.select().from(appSettings).where(eq(appSettings.userId, userId)).limit(1),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiUsage)
        .where(
          and(
            eq(aiUsage.userId, userId),
            eq(aiUsage.status, "ok"),
            sql`(created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date`
          )
        )
        .catch(() => [{ count: 0 }]),
    ]);

    return {
      hasToken: Boolean(settings?.ingestTokenHash),
      ingestTokenHint: settings?.ingestTokenHint ?? null,
      ingestTokenRotatedAt: settings?.ingestTokenRotatedAt ?? null,
      weeklyPostTarget: settings?.weeklyPostTarget ?? 3,
      insightMinSample: settings?.insightMinSample ?? 3,
      defaultChecklist:
        settings?.defaultChecklist && settings.defaultChecklist.length > 0
          ? settings.defaultChecklist
          : DEFAULT_CHECKLIST,
      aiEnabled: settings?.aiEnabled ?? true,
      aiProvider: settings?.aiProvider ?? "google",
      aiTextModel: settings?.aiTextModel ?? "gemini-flash-lite-latest",
      aiVisionModel: settings?.aiVisionModel ?? null,
      aiEmbedModel: settings?.aiEmbedModel ?? null,
      aiDailyCap: settings?.aiDailyCap ?? 100,
      aiOutputLanguage: settings?.aiOutputLanguage ?? "id",
      aiUsedToday: Number(usageTodayRes?.count) || 0,
    };
  } catch (err) {
    console.warn("Failed to fetch app settings, using defaults:", err);
    return DEFAULT_SETTINGS_RETURN;
  }
}

export async function getMasterDataForSettings(explicitUserId?: string) {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) {
      return { pillars: [], series: [], formats: [], hookTypes: [], platforms: [] };
    }

    const [
      pillarRows,
      seriesRows,
      formatRows,
      hookTypeRows,
      platformRows,
      refPillarCounts,
      contentPillarCounts,
      seriesContentCounts,
      formatRefCounts,
      formatContentCounts,
      hookRefCounts,
      hookContentCounts,
      platformRefCounts,
      platformPostCounts,
    ] = await Promise.all([
      db.select().from(pillars).where(eq(pillars.userId, userId)).orderBy(pillars.sortOrder, pillars.name),
      db.select().from(series).where(eq(series.userId, userId)).orderBy(series.sortOrder, series.name),
      db.select().from(formats).where(eq(formats.userId, userId)).orderBy(formats.sortOrder, formats.name),
      db.select().from(hookTypes).where(eq(hookTypes.userId, userId)).orderBy(hookTypes.sortOrder, hookTypes.name),
      db.select().from(platforms).where(eq(platforms.userId, userId)).orderBy(platforms.sortOrder, platforms.name),
      db
        .select({ id: refPillars.pillarId, count: sql<number>`count(*)::int` })
        .from(refPillars)
        .innerJoin(refs, and(eq(refPillars.refId, refs.id), eq(refs.userId, userId)))
        .groupBy(refPillars.pillarId)
        .catch(() => []),
      db
        .select({ id: contentPillars.pillarId, count: sql<number>`count(*)::int` })
        .from(contentPillars)
        .innerJoin(contents, and(eq(contentPillars.contentId, contents.id), eq(contents.userId, userId)))
        .groupBy(contentPillars.pillarId)
        .catch(() => []),
      db
        .select({ id: contents.seriesId, count: sql<number>`count(*)::int` })
        .from(contents)
        .where(and(eq(contents.userId, userId), sql`${contents.seriesId} IS NOT NULL`))
        .groupBy(contents.seriesId)
        .catch(() => []),
      db
        .select({ id: refs.formatId, count: sql<number>`count(*)::int` })
        .from(refs)
        .where(and(eq(refs.userId, userId), sql`${refs.formatId} IS NOT NULL`))
        .groupBy(refs.formatId)
        .catch(() => []),
      db
        .select({ id: contents.formatId, count: sql<number>`count(*)::int` })
        .from(contents)
        .where(and(eq(contents.userId, userId), sql`${contents.formatId} IS NOT NULL`))
        .groupBy(contents.formatId)
        .catch(() => []),
      db
        .select({ id: refs.hookTypeId, count: sql<number>`count(*)::int` })
        .from(refs)
        .where(and(eq(refs.userId, userId), sql`${refs.hookTypeId} IS NOT NULL`))
        .groupBy(refs.hookTypeId)
        .catch(() => []),
      db
        .select({ id: contents.hookTypeId, count: sql<number>`count(*)::int` })
        .from(contents)
        .where(and(eq(contents.userId, userId), sql`${contents.hookTypeId} IS NOT NULL`))
        .groupBy(contents.hookTypeId)
        .catch(() => []),
      db
        .select({ id: refs.platformId, count: sql<number>`count(*)::int` })
        .from(refs)
        .where(eq(refs.userId, userId))
        .groupBy(refs.platformId)
        .catch(() => []),
      db
        .select({ id: posts.platformId, count: sql<number>`count(*)::int` })
        .from(posts)
        .where(eq(posts.userId, userId))
        .groupBy(posts.platformId)
        .catch(() => []),
    ]);

    const addToMap = (
      map: Map<string, number>,
      rows: { id: string | null; count: number }[]
    ) => {
      for (const r of rows) {
        if (!r.id) continue;
        map.set(r.id, (map.get(r.id) || 0) + Number(r.count || 0));
      }
    };

    const pillarUsage = new Map<string, number>();
    addToMap(pillarUsage, refPillarCounts);
    addToMap(pillarUsage, contentPillarCounts);

    const seriesUsage = new Map<string, number>();
    addToMap(seriesUsage, seriesContentCounts);

    const formatUsage = new Map<string, number>();
    addToMap(formatUsage, formatRefCounts);
    addToMap(formatUsage, formatContentCounts);

    const hookUsage = new Map<string, number>();
    addToMap(hookUsage, hookRefCounts);
    addToMap(hookUsage, hookContentCounts);

    const platformUsage = new Map<string, number>();
    addToMap(platformUsage, platformRefCounts);
    addToMap(platformUsage, platformPostCounts);

    return {
      pillars: pillarRows.map((r) => ({ ...r, usageCount: pillarUsage.get(r.id) || 0 })),
      series: seriesRows.map((r) => ({ ...r, usageCount: seriesUsage.get(r.id) || 0 })),
      formats: formatRows.map((r) => ({ ...r, usageCount: formatUsage.get(r.id) || 0 })),
      hookTypes: hookTypeRows.map((r) => ({ ...r, usageCount: hookUsage.get(r.id) || 0 })),
      platforms: platformRows.map((r) => ({ ...r, usageCount: platformUsage.get(r.id) || 0 })),
    };
  } catch (err) {
    console.warn("Failed to fetch full master data:", err);
    return {
      pillars: [],
      series: [],
      formats: [],
      hookTypes: [],
      platforms: [],
    };
  }
}

export async function getSystemLogs(limit = 200, explicitUserId?: string) {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) return [];

    return await db
      .select()
      .from(systemLogs)
      .where(eq(systemLogs.userId, userId))
      .orderBy(desc(systemLogs.createdAt))
      .limit(limit);
  } catch (err) {
    console.warn("Failed to fetch system logs:", err);
    return [];
  }
}
