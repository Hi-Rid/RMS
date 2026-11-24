import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/db/schema";

export interface AppSettingsQuery {
  hasToken: boolean;
  weeklyPostTarget: number;
}

export const getAppSettings = cache(async (): Promise<AppSettingsQuery> => {
  try {
    const [settings] = await db
      .select({
        ingestTokenHash: appSettings.ingestTokenHash,
        weeklyPostTarget: appSettings.weeklyPostTarget,
      })
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .limit(1)
      .catch(() => []);

    return {
      hasToken: Boolean(settings?.ingestTokenHash),
      weeklyPostTarget: settings?.weeklyPostTarget ?? 3,
    };
  } catch {
    return {
      hasToken: false,
      weeklyPostTarget: 3,
    };
  }
});
