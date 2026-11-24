import "server-only";
import { eq, sql, desc, asc, and, or, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { audios, refs, contents, posts, platforms } from "@/db/schema";

export interface AudioListItem {
  id: string;
  title: string;
  artist: string;
  isOriginal: boolean;
  notes: string | null;
  refsCount: number;
  contentsCount: number;
  lastUsedAt: string | null;
  isUnused: boolean;
  createdAt: string;
}

export interface ListAudiosParams {
  unusedOnly?: boolean;
  searchText?: string;
  sortBy?: "title" | "recent" | "refs";
}

export async function listAudios(params: ListAudiosParams = {}): Promise<AudioListItem[]> {
  try {
    const { unusedOnly = false, searchText, sortBy = "recent" } = params;

    // Fetch all audios with aggregation counts
    const rows = await db
      .select({
        id: audios.id,
        title: audios.title,
        artist: audios.artist,
        isOriginal: audios.isOriginal,
        notes: audios.notes,
        createdAt: audios.createdAt,
        refsCount: sql<number>`(SELECT count(*)::int FROM ${refs} WHERE ${refs.audioId} = ${audios.id} AND ${refs.archivedAt} IS NULL)`,
        contentsCount: sql<number>`(SELECT count(*)::int FROM ${contents} WHERE ${contents.audioId} = ${audios.id} AND ${contents.archivedAt} IS NULL)`,
        lastUsedAt: sql<string | null>`(
          SELECT max(p.posted_at)::text 
          FROM ${posts} p
          JOIN ${contents} c ON c.id = p.content_id
          WHERE c.audio_id = ${audios.id}
        )`,
      })
      .from(audios);

    let items: AudioListItem[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      isOriginal: r.isOriginal,
      notes: r.notes,
      refsCount: r.refsCount || 0,
      contentsCount: r.contentsCount || 0,
      lastUsedAt: r.lastUsedAt,
      isUnused: (r.contentsCount || 0) === 0,
      createdAt: r.createdAt,
    }));

    // Filter search text
    if (searchText && searchText.trim()) {
      const term = searchText.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(term) ||
          i.artist.toLowerCase().includes(term) ||
          (i.notes && i.notes.toLowerCase().includes(term))
      );
    }

    // Filter unused
    if (unusedOnly) {
      items = items.filter((i) => i.isUnused);
    }

    // Sorting
    if (sortBy === "title") {
      items.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "refs") {
      items.sort((a, b) => b.refsCount - a.refsCount);
    } else {
      // recent: sort by lastUsedAt desc, then createdAt desc
      items.sort((a, b) => {
        if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt);
        if (a.lastUsedAt) return -1;
        if (b.lastUsedAt) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    }

    return items;
  } catch (error) {
    console.warn("Failed to list audios:", error);
    return [];
  }
}

export async function getAudioById(id: string) {
  try {
    const [audio] = await db
      .select()
      .from(audios)
      .where(eq(audios.id, id))
      .limit(1);

    if (!audio) return null;

    // References using this audio
    const usingRefs = await db
      .select({
        id: refs.id,
        url: refs.url,
        summary: refs.summary,
        hookText: refs.hookText,
        status: refs.status,
        savedAt: refs.savedAt,
        platformName: platforms.name,
      })
      .from(refs)
      .innerJoin(platforms, eq(refs.platformId, platforms.id))
      .where(and(eq(refs.audioId, id), isNull(refs.archivedAt)))
      .orderBy(desc(refs.savedAt));

    // Contents using this audio
    const usingContents = await db
      .select({
        id: contents.id,
        title: contents.title,
        status: contents.status,
        createdAt: contents.createdAt,
        lastPostedAt: sql<string | null>`(SELECT max(posted_at)::text FROM ${posts} WHERE content_id = ${contents.id})`,
      })
      .from(contents)
      .where(and(eq(contents.audioId, id), isNull(contents.archivedAt)))
      .orderBy(desc(contents.createdAt));

    return {
      audio,
      usingRefs,
      usingContents,
      canDelete: usingRefs.length === 0 && usingContents.length === 0,
    };
  } catch (error) {
    console.warn(`Failed to get audio by ID ${id}:`, error);
    return null;
  }
}
