import "server-only";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appSettings,
  pillars,
  series,
  formats,
  hookTypes,
  platforms,
  systemLogs,
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
}

export async function getAppSettings(): Promise<AppSettingsQuery> {
  try {
    const [settings] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .limit(1);

    return {
      hasToken: Boolean(settings?.ingestTokenHash),
      ingestTokenHint: settings?.ingestTokenHint ?? null,
      ingestTokenRotatedAt: settings?.ingestTokenRotatedAt ?? null,
      weeklyPostTarget: settings?.weeklyPostTarget ?? 3,
      insightMinSample: settings?.insightMinSample ?? 3,
      defaultChecklist: settings?.defaultChecklist ?? [
        "Script / outline",
        "Shoot or draw",
        "Edit",
        "Cover",
        "Caption and hashtags",
        "Audio checked",
      ],
      aiEnabled: settings?.aiEnabled ?? true,
      aiProvider: settings?.aiProvider ?? "google",
      aiTextModel: settings?.aiTextModel ?? "gemini-flash-lite-latest",
      aiVisionModel: settings?.aiVisionModel ?? null,
      aiEmbedModel: settings?.aiEmbedModel ?? null,
      aiDailyCap: settings?.aiDailyCap ?? 100,
      aiOutputLanguage: settings?.aiOutputLanguage ?? "id",
    };
  } catch (err) {
    console.warn("Failed to fetch app settings, using defaults:", err);
    return {
      hasToken: false,
      ingestTokenHint: null,
      ingestTokenRotatedAt: null,
      weeklyPostTarget: 3,
      insightMinSample: 3,
      defaultChecklist: [
        "Script / outline",
        "Shoot or draw",
        "Edit",
        "Cover",
        "Caption and hashtags",
        "Audio checked",
      ],
      aiEnabled: true,
      aiProvider: "google",
      aiTextModel: "gemini-flash-lite-latest",
      aiVisionModel: null,
      aiEmbedModel: null,
      aiDailyCap: 100,
      aiOutputLanguage: "id",
    };
  }
}

export async function getMasterDataForSettings() {
  try {
    const [pillarRows, seriesRows, formatRows, hookTypeRows, platformRows] =
      await Promise.all([
        db.select().from(pillars).orderBy(pillars.sortOrder, pillars.name),
        db.select().from(series).orderBy(series.sortOrder, series.name),
        db.select().from(formats).orderBy(formats.sortOrder, formats.name),
        db.select().from(hookTypes).orderBy(hookTypes.sortOrder, hookTypes.name),
        db.select().from(platforms).orderBy(platforms.sortOrder, platforms.name),
      ]);

    return {
      pillars: pillarRows,
      series: seriesRows,
      formats: formatRows,
      hookTypes: hookTypeRows,
      platforms: platformRows,
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

export async function getSystemLogs(limit = 200) {
  try {
    return await db
      .select()
      .from(systemLogs)
      .orderBy(desc(systemLogs.createdAt))
      .limit(limit);
  } catch (err) {
    console.warn("Failed to fetch system logs:", err);
    return [];
  }
}
