import "server-only";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { getOwner } from "@/lib/auth/owner";
import { snippets, pillars, platforms } from "@/db/schema";

export interface SnippetItem {
  id: string;
  kind: "caption" | "hashtag_set";
  title: string;
  body: string;
  pillarId: string | null;
  pillarName: string | null;
  platformId: string | null;
  platformName: string | null;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export async function listSnippets(
  kind?: "caption" | "hashtag_set",
  explicitUserId?: string
): Promise<SnippetItem[]> {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) return [];

    const whereClause = kind
      ? and(eq(snippets.userId, userId), eq(snippets.kind, kind))
      : eq(snippets.userId, userId);

    const rows = await db
      .select({
        id: snippets.id,
        kind: snippets.kind,
        title: snippets.title,
        body: snippets.body,
        pillarId: snippets.pillarId,
        pillarName: pillars.name,
        platformId: snippets.platformId,
        platformName: platforms.name,
        useCount: snippets.useCount,
        lastUsedAt: snippets.lastUsedAt,
        createdAt: snippets.createdAt,
      })
      .from(snippets)
      .leftJoin(pillars, eq(snippets.pillarId, pillars.id))
      .leftJoin(platforms, eq(snippets.platformId, platforms.id))
      .where(whereClause)
      .orderBy(desc(snippets.useCount), desc(snippets.createdAt));

    return rows as SnippetItem[];
  } catch (error) {
    console.warn("Failed to list snippets:", error);
    return [];
  }
}
