import "server-only";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import {
  appSettings,
  pillars,
  series,
  hookTypes,
  platforms,
  formats,
} from "@/db/schema";
import {
  DEFAULT_CHECKLIST,
  STARTER_FORMATS,
  STARTER_HOOK_TYPES,
  STARTER_PILLARS,
  STARTER_PLATFORMS,
  STARTER_SERIES,
} from "@/lib/auth/workspace-defaults";

const g = globalThis as unknown as {
  seededUserIds?: Set<string>;
  inFlightSeeds?: Map<string, Promise<void>>;
};

const seededUserIds = (g.seededUserIds ??= new Set<string>());
const inFlightSeeds = (g.inFlightSeeds ??= new Map<string, Promise<void>>());

/**
 * Ensures a newly registered user has an isolated workspace (app_settings + starter master data).
 * Idempotent and deduplicated per userId.
 */
export async function ensureUserWorkspace(userId: string): Promise<void> {
  if (!userId || seededUserIds.has(userId)) {
    return;
  }

  const pending = inFlightSeeds.get(userId);
  if (pending) {
    return pending;
  }

  const job = (async () => {
    try {
      const [existing] = await db
        .select({ id: appSettings.id })
        .from(appSettings)
        .where(eq(appSettings.userId, userId))
        .limit(1);

      if (existing) {
        seededUserIds.add(userId);
        return;
      }

      await withTx(async (tx) => {
        await tx
          .insert(appSettings)
          .values({
            userId,
            weeklyPostTarget: 3,
            insightMinSample: 3,
            defaultChecklist: DEFAULT_CHECKLIST,
            aiEnabled: true,
            aiProvider: "google",
            aiTextModel: "gemini-flash-lite-latest",
            aiDailyCap: 100,
            aiOutputLanguage: "id",
            aiAutoEnrich: true,
            aiIngestMode: "inbox",
          })
          .onConflictDoNothing();

        await tx
          .insert(pillars)
          .values(STARTER_PILLARS.map((p) => ({ ...p, userId, isActive: true })))
          .onConflictDoNothing();

        await tx
          .insert(series)
          .values(STARTER_SERIES.map((s) => ({ ...s, userId, isActive: true })))
          .onConflictDoNothing();

        await tx
          .insert(hookTypes)
          .values(STARTER_HOOK_TYPES.map((h) => ({ ...h, userId, isActive: true })))
          .onConflictDoNothing();

        await tx
          .insert(platforms)
          .values(STARTER_PLATFORMS.map((pl) => ({ ...pl, userId, isActive: true })))
          .onConflictDoNothing();

        await tx
          .insert(formats)
          .values(STARTER_FORMATS.map((f) => ({ ...f, userId, isActive: true })))
          .onConflictDoNothing();
      });

      seededUserIds.add(userId);
    } finally {
      inFlightSeeds.delete(userId);
    }
  })();

  inFlightSeeds.set(userId, job);
  return job;
}
