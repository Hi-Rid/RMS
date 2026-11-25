import { and, eq, sql } from "drizzle-orm";
import { withTx } from "@/lib/db";
import {
  audios,
  contentPillars,
  contents,
  formats,
  hookTypes,
  pillars,
  platforms,
  refPillars,
  refs,
  series,
  snippets,
  sourceAccounts,
  systemLogs,
} from "@/db/schema";
import { normalizeHandle, normalizeTag, slugify } from "@/lib/domain/normalize";

interface BackupRow {
  id?: string;
  [key: string]: unknown;
}

export interface BackupImportSummary {
  importedMaster: number;
  importedRefs: number;
  importedContents: number;
  importedSnippets: number;
  skippedDuplicates: number;
}

function asArray(val: unknown): BackupRow[] {
  return Array.isArray(val) ? (val as BackupRow[]) : [];
}

function safeStr(val: unknown, maxLen = 2000): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

export async function importBackupPayload(
  userId: string,
  rawJson: string
): Promise<BackupImportSummary> {
  const parsed = JSON.parse(rawJson) as { tables?: Record<string, unknown> };
  const tables = parsed?.tables;
  if (!tables || typeof tables !== "object") {
    throw new Error("Invalid RMS backup format: missing `tables` object.");
  }

  return await withTx(async (tx) => {
    let importedMaster = 0;
    let importedRefs = 0;
    let importedContents = 0;
    let importedSnippets = 0;
    let skippedDuplicates = 0;

    // Map exported UUIDs -> active DB UUIDs scoped to userId
    const platformMap = new Map<string, string>();
    const formatMap = new Map<string, string>();
    const seriesMap = new Map<string, string>();
    const hookTypeMap = new Map<string, string>();
    const pillarMap = new Map<string, string>();
    const sourceMap = new Map<string, string>();
    const audioMap = new Map<string, string>();
    const refMap = new Map<string, string>();
    const contentMap = new Map<string, string>();

    // 1. Seed maps from user's existing master records
    const [existingPlatforms, existingFormats, existingSeries, existingHooks, existingPillars] =
      await Promise.all([
        tx.select().from(platforms).where(eq(platforms.userId, userId)),
        tx.select().from(formats).where(eq(formats.userId, userId)),
        tx.select().from(series).where(eq(series.userId, userId)),
        tx.select().from(hookTypes).where(eq(hookTypes.userId, userId)),
        tx.select().from(pillars).where(eq(pillars.userId, userId)),
      ]);

    const platformBySlug = new Map(existingPlatforms.map((r) => [r.slug, r.id]));
    const formatBySlug = new Map(existingFormats.map((r) => [r.slug, r.id]));
    const seriesBySlug = new Map(existingSeries.map((r) => [r.slug, r.id]));
    const hookBySlug = new Map(existingHooks.map((r) => [r.slug, r.id]));
    const pillarBySlug = new Map(existingPillars.map((r) => [r.slug, r.id]));

    for (const row of asArray(tables.platforms)) {
      const oldId = safeStr(row.id, 64);
      const name = safeStr(row.name, 60);
      const slug = safeStr(row.slug, 60) || (name ? slugify(name) : null);
      if (!slug || !name) continue;
      let activeId = platformBySlug.get(slug);
      if (!activeId) {
        const [ins] = await tx
          .insert(platforms)
          .values({
            userId,
            name,
            slug,
            domains: Array.isArray(row.domains) ? (row.domains as string[]) : [],
            isSource: typeof row.isSource === "boolean" ? row.isSource : true,
            isTarget: typeof row.isTarget === "boolean" ? row.isTarget : true,
            sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
            isActive: typeof row.isActive === "boolean" ? row.isActive : true,
          })
          .returning({ id: platforms.id });
        activeId = ins.id;
        platformBySlug.set(slug, activeId);
        importedMaster++;
      }
      if (oldId) platformMap.set(oldId, activeId);
    }

    for (const row of asArray(tables.formats)) {
      const oldId = safeStr(row.id, 64);
      const name = safeStr(row.name, 60);
      const slug = safeStr(row.slug, 60) || (name ? slugify(name) : null);
      if (!slug || !name) continue;
      let activeId = formatBySlug.get(slug);
      if (!activeId) {
        const [ins] = await tx
          .insert(formats)
          .values({
            userId,
            name,
            slug,
            hasCheckpoints: typeof row.hasCheckpoints === "boolean" ? row.hasCheckpoints : true,
            sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
            isActive: typeof row.isActive === "boolean" ? row.isActive : true,
          })
          .returning({ id: formats.id });
        activeId = ins.id;
        formatBySlug.set(slug, activeId);
        importedMaster++;
      }
      if (oldId) formatMap.set(oldId, activeId);
    }

    for (const row of asArray(tables.series)) {
      const oldId = safeStr(row.id, 64);
      const name = safeStr(row.name, 80);
      const slug = safeStr(row.slug, 80) || (name ? slugify(name) : null);
      if (!slug || !name) continue;
      let activeId = seriesBySlug.get(slug);
      if (!activeId) {
        const [ins] = await tx
          .insert(series)
          .values({
            userId,
            name,
            slug,
            sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
            isActive: typeof row.isActive === "boolean" ? row.isActive : true,
          })
          .returning({ id: series.id });
        activeId = ins.id;
        seriesBySlug.set(slug, activeId);
        importedMaster++;
      }
      if (oldId) seriesMap.set(oldId, activeId);
    }

    for (const row of asArray(tables.hook_types)) {
      const oldId = safeStr(row.id, 64);
      const name = safeStr(row.name, 80);
      const slug = safeStr(row.slug, 80) || (name ? slugify(name) : null);
      if (!slug || !name) continue;
      let activeId = hookBySlug.get(slug);
      if (!activeId) {
        const [ins] = await tx
          .insert(hookTypes)
          .values({
            userId,
            name,
            slug,
            sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
            isActive: typeof row.isActive === "boolean" ? row.isActive : true,
          })
          .returning({ id: hookTypes.id });
        activeId = ins.id;
        hookBySlug.set(slug, activeId);
        importedMaster++;
      }
      if (oldId) hookTypeMap.set(oldId, activeId);
    }

    for (const row of asArray(tables.pillars)) {
      const oldId = safeStr(row.id, 64);
      const name = safeStr(row.name, 60);
      const slug = safeStr(row.slug, 60) || (name ? slugify(name) : null);
      if (!slug || !name) continue;
      let activeId = pillarBySlug.get(slug);
      if (!activeId) {
        const [ins] = await tx
          .insert(pillars)
          .values({
            userId,
            name,
            slug,
            sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
            isActive: typeof row.isActive === "boolean" ? row.isActive : true,
          })
          .returning({ id: pillars.id });
        activeId = ins.id;
        pillarBySlug.set(slug, activeId);
        importedMaster++;
      }
      if (oldId) pillarMap.set(oldId, activeId);
    }

    const fallbackPlatformId =
      platformBySlug.get("other") ?? existingPlatforms[0]?.id ?? null;

    // 2. Restore source_accounts
    for (const row of asArray(tables.source_accounts)) {
      const oldId = safeStr(row.id, 64);
      const rawHandle = safeStr(row.handle, 120);
      const handle = rawHandle ? normalizeHandle(rawHandle) : null;
      const mappedPlatformId =
        (safeStr(row.platformId, 64) ? platformMap.get(safeStr(row.platformId, 64)!) : null) ??
        fallbackPlatformId;
      if (!handle || !mappedPlatformId) continue;

      const [existingSource] = await tx
        .select({ id: sourceAccounts.id })
        .from(sourceAccounts)
        .where(
          and(
            eq(sourceAccounts.userId, userId),
            eq(sourceAccounts.platformId, mappedPlatformId),
            eq(sourceAccounts.handle, handle)
          )
        )
        .limit(1);

      if (existingSource) {
        if (oldId) sourceMap.set(oldId, existingSource.id);
      } else {
        const [ins] = await tx
          .insert(sourceAccounts)
          .values({
            userId,
            platformId: mappedPlatformId,
            handle,
            notes: safeStr(row.notes, 1000),
          })
          .returning({ id: sourceAccounts.id });
        if (oldId) sourceMap.set(oldId, ins.id);
      }
    }

    // 3. Restore audios
    for (const row of asArray(tables.audios)) {
      const oldId = safeStr(row.id, 64);
      const title = safeStr(row.title, 200);
      const artist = safeStr(row.artist, 200) || "";
      if (!title) continue;

      const [existingAudio] = await tx
        .select({ id: audios.id })
        .from(audios)
        .where(
          and(
            eq(audios.userId, userId),
            sql`lower(btrim(${audios.title})) = lower(btrim(${title}))`,
            sql`lower(btrim(${audios.artist})) = lower(btrim(${artist}))`
          )
        )
        .limit(1);

      if (existingAudio) {
        if (oldId) audioMap.set(oldId, existingAudio.id);
      } else {
        const [ins] = await tx
          .insert(audios)
          .values({
            userId,
            title,
            artist,
            isOriginal: typeof row.isOriginal === "boolean" ? row.isOriginal : false,
            notes: safeStr(row.notes, 1000),
          })
          .returning({ id: audios.id });
        if (oldId) audioMap.set(oldId, ins.id);
      }
    }

    // 4. Restore contents (before refs so linked content_id can map cleanly!)
    const existingContentTitles = new Set(
      (
        await tx
          .select({ title: contents.title })
          .from(contents)
          .where(eq(contents.userId, userId))
      ).map((c) => c.title.trim().toLowerCase())
    );

    for (const row of asArray(tables.contents)) {
      const oldId = safeStr(row.id, 64);
      const title = safeStr(row.title, 200);
      if (!title) continue;
      if (existingContentTitles.has(title.toLowerCase())) {
        skippedDuplicates++;
        continue;
      }

      const tags = Array.isArray(row.tags)
        ? (row.tags as unknown[])
            .map((t) => (typeof t === "string" ? normalizeTag(t) : ""))
            .filter(Boolean)
            .slice(0, 30)
        : [];

      const mappedFormatId = safeStr(row.formatId, 64)
        ? formatMap.get(safeStr(row.formatId, 64)!) ?? null
        : null;
      const mappedSeriesId = safeStr(row.seriesId, 64)
        ? seriesMap.get(safeStr(row.seriesId, 64)!) ?? null
        : null;
      const mappedAudioId = safeStr(row.audioId, 64)
        ? audioMap.get(safeStr(row.audioId, 64)!) ?? null
        : null;
      const mappedHookId = safeStr(row.hookTypeId, 64)
        ? hookTypeMap.get(safeStr(row.hookTypeId, 64)!) ?? null
        : null;

      const [ins] = await tx
        .insert(contents)
        .values({
          userId,
          title,
          formatId: mappedFormatId,
          seriesId: mappedSeriesId,
          audioId: mappedAudioId,
          hookText: safeStr(row.hookText, 400),
          hookTypeId: mappedHookId,
          notes: safeStr(row.notes, 4000),
          changesNote: safeStr(row.changesNote, 2000),
          workUrl:
            safeStr(row.workUrl, 500) && /^https?:\/\//i.test(safeStr(row.workUrl, 500)!)
              ? safeStr(row.workUrl, 500)
              : null,
          plannedFor: safeStr(row.plannedFor, 20),
          tags,
          status: "production",
          searchText: safeStr(row.searchText, 4000) || title.toLowerCase(),
        })
        .returning({ id: contents.id });

      existingContentTitles.add(title.toLowerCase());
      if (oldId) contentMap.set(oldId, ins.id);
      importedContents++;
    }

    for (const row of asArray(tables.content_pillars)) {
      const cId = safeStr(row.contentId, 64);
      const pId = safeStr(row.pillarId, 64);
      const newC = cId ? contentMap.get(cId) : null;
      const newP = pId ? pillarMap.get(pId) : null;
      if (newC && newP) {
        await tx
          .insert(contentPillars)
          .values({ contentId: newC, pillarId: newP })
          .onConflictDoNothing();
      }
    }

    // 5. Restore refs (dedupe by canonical url per user)
    const existingUrls = new Set(
      (
        await tx
          .select({ url: refs.url })
          .from(refs)
          .where(eq(refs.userId, userId))
      ).map((r) => r.url)
    );

    for (const row of asArray(tables.refs)) {
      const oldId = safeStr(row.id, 64);
      const url = safeStr(row.url, 1000);
      if (!url || !/^https?:\/\//i.test(url)) continue;

      if (existingUrls.has(url)) {
        skippedDuplicates++;
        continue;
      }

      const mappedPlatformId =
        (safeStr(row.platformId, 64) ? platformMap.get(safeStr(row.platformId, 64)!) : null) ??
        fallbackPlatformId;
      if (!mappedPlatformId) continue;

      const tags = Array.isArray(row.tags)
        ? (row.tags as unknown[])
            .map((t) => (typeof t === "string" ? normalizeTag(t) : ""))
            .filter(Boolean)
            .slice(0, 30)
        : [];

      const rawStatus = safeStr(row.status, 24);
      const safeStatus: "inbox" | "selected" | "skipped" =
        rawStatus === "selected" || rawStatus === "skipped" ? rawStatus : "inbox";

      const [ins] = await tx
        .insert(refs)
        .values({
          userId,
          url,
          urlOriginal: safeStr(row.urlOriginal, 1000) || url,
          platformId: mappedPlatformId,
          formatId: safeStr(row.formatId, 64)
            ? formatMap.get(safeStr(row.formatId, 64)!) ?? null
            : null,
          sourceAccountId: safeStr(row.sourceAccountId, 64)
            ? sourceMap.get(safeStr(row.sourceAccountId, 64)!) ?? null
            : null,
          audioId: safeStr(row.audioId, 64)
            ? audioMap.get(safeStr(row.audioId, 64)!) ?? null
            : null,
          hookTypeId: safeStr(row.hookTypeId, 64)
            ? hookTypeMap.get(safeStr(row.hookTypeId, 64)!) ?? null
            : null,
          externalId: safeStr(row.externalId, 200),
          summary: safeStr(row.summary, 1200),
          hookText: safeStr(row.hookText, 400),
          visualNotes: safeStr(row.visualNotes, 1500),
          notes: safeStr(row.notes, 2000),
          coverUrl: safeStr(row.coverUrl, 1000),
          tags,
          status: safeStatus,
          searchText: safeStr(row.searchText, 4000) || url.toLowerCase(),
        })
        .returning({ id: refs.id });

      existingUrls.add(url);
      if (oldId) refMap.set(oldId, ins.id);
      importedRefs++;
    }

    for (const row of asArray(tables.ref_pillars)) {
      const rId = safeStr(row.refId, 64);
      const pId = safeStr(row.pillarId, 64);
      const newR = rId ? refMap.get(rId) : null;
      const newP = pId ? pillarMap.get(pId) : null;
      if (newR && newP) {
        await tx
          .insert(refPillars)
          .values({ refId: newR, pillarId: newP })
          .onConflictDoNothing();
      }
    }

    // 6. Restore snippets
    const existingSnippetTitles = new Set(
      (
        await tx
          .select({ title: snippets.title })
          .from(snippets)
          .where(eq(snippets.userId, userId))
      ).map((s) => s.title.trim().toLowerCase())
    );

    for (const row of asArray(tables.snippets)) {
      const title = safeStr(row.title, 120);
      const body = safeStr(row.body, 4000);
      if (!title || !body) continue;
      if (existingSnippetTitles.has(title.toLowerCase())) {
        skippedDuplicates++;
        continue;
      }

      const rawKind = safeStr(row.kind, 30);
      const kind: "caption" | "hashtag_set" =
        rawKind === "hashtag_set" ? "hashtag_set" : "caption";

      await tx.insert(snippets).values({
        userId,
        kind,
        title,
        body,
        pillarId: safeStr(row.pillarId, 64)
          ? pillarMap.get(safeStr(row.pillarId, 64)!) ?? null
          : null,
        platformId: safeStr(row.platformId, 64)
          ? platformMap.get(safeStr(row.platformId, 64)!) ?? null
          : null,
      });

      existingSnippetTitles.add(title.toLowerCase());
      importedSnippets++;
    }

    await tx.insert(systemLogs).values({
      userId,
      kind: "import",
      level: "info",
      message: `Backup restored: +${importedRefs} refs, +${importedContents} contents, +${importedSnippets} snippets`,
      meta: { importedMaster, importedRefs, importedContents, importedSnippets, skippedDuplicates },
    });

    return {
      importedMaster,
      importedRefs,
      importedContents,
      importedSnippets,
      skippedDuplicates,
    };
  });
}
