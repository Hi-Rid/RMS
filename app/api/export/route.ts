import "server-only";
import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { requireRouteOwner } from "@/lib/auth/owner";
import { db } from "@/lib/db";
import {
  platforms,
  formats,
  series,
  hookTypes,
  pillars,
  appSettings,
  audios,
  sourceAccounts,
  refs,
  refPillars,
  refImages,
  contents,
  contentPillars,
  posts,
  snapshots,
  snippets,
  systemLogs,
} from "@/db/schema";

export async function GET() {
  const auth = await requireRouteOwner();
  if (auth instanceof Response) {
    return auth;
  }

  const userId = auth.id;

  try {
    const [
      platformsData,
      formatsData,
      seriesData,
      hookTypesData,
      pillarsData,
      settingsData,
      audiosData,
      sourceAccountsData,
      refsData,
      contentsData,
      postsData,
      snapshotsData,
      snippetsData,
    ] = await Promise.all([
      db.select().from(platforms).where(eq(platforms.userId, userId)),
      db.select().from(formats).where(eq(formats.userId, userId)),
      db.select().from(series).where(eq(series.userId, userId)),
      db.select().from(hookTypes).where(eq(hookTypes.userId, userId)),
      db.select().from(pillars).where(eq(pillars.userId, userId)),
      db.select().from(appSettings).where(eq(appSettings.userId, userId)),
      db.select().from(audios).where(eq(audios.userId, userId)),
      db.select().from(sourceAccounts).where(eq(sourceAccounts.userId, userId)),
      db.select().from(refs).where(eq(refs.userId, userId)),
      db.select().from(contents).where(eq(contents.userId, userId)),
      db.select().from(posts).where(eq(posts.userId, userId)),
      db.select().from(snapshots).where(eq(snapshots.userId, userId)),
      db.select().from(snippets).where(eq(snippets.userId, userId)),
    ]);

    const refIds = refsData.map((r) => r.id);
    const contentIds = contentsData.map((c) => c.id);

    const [refPillarsData, refImagesData, contentPillarsData] = await Promise.all([
      refIds.length > 0
        ? db.select().from(refPillars).where(inArray(refPillars.refId, refIds))
        : Promise.resolve([]),
      refIds.length > 0
        ? db.select().from(refImages).where(inArray(refImages.refId, refIds))
        : Promise.resolve([]),
      contentIds.length > 0
        ? db.select().from(contentPillars).where(inArray(contentPillars.contentId, contentIds))
        : Promise.resolve([]),
    ]);

    // PRD §9.5: exclude embedding columns from refs
    const sanitizedRefs = refsData.map(({ embedding, ...rest }) => rest);

    // PRD §9.5: exclude ingestTokenHash from appSettings
    const sanitizedSettings = settingsData.map(({ ingestTokenHash, ...rest }) => rest);

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];

    const exportPayload = {
      version: 2,
      exported_at: now.toISOString(),
      tables: {
        platforms: platformsData,
        formats: formatsData,
        series: seriesData,
        hook_types: hookTypesData,
        pillars: pillarsData,
        app_settings: sanitizedSettings,
        audios: audiosData,
        source_accounts: sourceAccountsData,
        refs: sanitizedRefs,
        ref_pillars: refPillarsData,
        ref_images: refImagesData,
        contents: contentsData,
        content_pillars: contentPillarsData,
        posts: postsData,
        snapshots: snapshotsData,
        snippets: snippetsData,
      },
    };

    // Audit log (respects system_logs_kind_check constraint)
    await db.insert(systemLogs).values({
      userId,
      kind: "import",
      level: "info",
      message: `Database backup exported by owner (${dateStr})`,
      meta: {
        operation: "export",
        tables_count: Object.keys(exportPayload.tables).length,
        refs_count: sanitizedRefs.length,
        contents_count: contentsData.length,
      },
    });

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="folio-export-${dateStr}.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "internal", message: "Failed to export database" } },
      { status: 500 }
    );
  }
}
