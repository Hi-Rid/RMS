import "server-only";
import { NextResponse } from "next/server";
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
      refPillarsData,
      refImagesData,
      contentsData,
      contentPillarsData,
      postsData,
      snapshotsData,
      snippetsData,
    ] = await Promise.all([
      db.select().from(platforms),
      db.select().from(formats),
      db.select().from(series),
      db.select().from(hookTypes),
      db.select().from(pillars),
      db.select().from(appSettings),
      db.select().from(audios),
      db.select().from(sourceAccounts),
      db.select().from(refs),
      db.select().from(refPillars),
      db.select().from(refImages),
      db.select().from(contents),
      db.select().from(contentPillars),
      db.select().from(posts),
      db.select().from(snapshots),
      db.select().from(snippets),
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

    // Audit log
    await db.insert(systemLogs).values({
      kind: "export",
      level: "info",
      message: `Database backup exported by owner (${dateStr})`,
      meta: {
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
