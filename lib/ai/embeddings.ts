import crypto from "node:crypto";
import { embed } from "ai";
import { and, cosineDistance, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contents, platforms, refs, sourceAccounts } from "@/db/schema";
import { getGoogleClient } from "@/lib/ai/client";
import { getUserAiKeyEncrypted } from "@/lib/queries/settings";

const EMBEDDING_MODEL_ID = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

export function computeSearchHash(text: string): string {
  return crypto.createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
}

export async function generateTextEmbedding768(
  text: string,
  customEncryptedKey?: string | null
): Promise<number[] | null> {
  const clean = text.trim();
  if (!clean) return null;

  const client = getGoogleClient(customEncryptedKey);
  if (!client) return null;

  try {
    const res = await embed({
      model: client.embedding(EMBEDDING_MODEL_ID),
      value: clean.slice(0, 6000),
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMENSIONS,
        },
      },
    });

    if (Array.isArray(res.embedding) && res.embedding.length === EMBEDDING_DIMENSIONS) {
      return res.embedding;
    }
    return null;
  } catch (err) {
    console.warn("Embedding generation skipped:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function syncReferenceEmbedding(params: {
  userId: string;
  refId: string;
  text: string;
  customEncryptedKey?: string | null;
}): Promise<boolean> {
  const clean = params.text.trim();
  if (!clean) return false;

  const nextHash = computeSearchHash(clean);
  const [existing] = await db
    .select({
      embeddingHash: refs.embeddingHash,
      hasEmbedding: sql<boolean>`${refs.embedding} IS NOT NULL`,
    })
    .from(refs)
    .where(and(eq(refs.id, params.refId), eq(refs.userId, params.userId)))
    .limit(1);

  if (!existing) return false;
  if (existing.embeddingHash === nextHash && existing.hasEmbedding) {
    return true;
  }

  const key =
    params.customEncryptedKey !== undefined
      ? params.customEncryptedKey
      : await getUserAiKeyEncrypted(params.userId);
  const vec = await generateTextEmbedding768(clean, key);
  if (!vec) return false;

  await db
    .update(refs)
    .set({
      embedding: vec,
      embeddingModel: EMBEDDING_MODEL_ID,
      embeddingHash: nextHash,
    })
    .where(and(eq(refs.id, params.refId), eq(refs.userId, params.userId)));

  return true;
}

export async function syncContentEmbedding(params: {
  userId: string;
  contentId: string;
  text: string;
  customEncryptedKey?: string | null;
}): Promise<boolean> {
  const clean = params.text.trim();
  if (!clean) return false;

  const nextHash = computeSearchHash(clean);
  const [existing] = await db
    .select({
      embeddingHash: contents.embeddingHash,
      hasEmbedding: sql<boolean>`${contents.embedding} IS NOT NULL`,
    })
    .from(contents)
    .where(and(eq(contents.id, params.contentId), eq(contents.userId, params.userId)))
    .limit(1);

  if (!existing) return false;
  if (existing.embeddingHash === nextHash && existing.hasEmbedding) {
    return true;
  }

  const key =
    params.customEncryptedKey !== undefined
      ? params.customEncryptedKey
      : await getUserAiKeyEncrypted(params.userId);
  const vec = await generateTextEmbedding768(clean, key);
  if (!vec) return false;

  await db
    .update(contents)
    .set({
      embedding: vec,
      embeddingModel: EMBEDDING_MODEL_ID,
      embeddingHash: nextHash,
    })
    .where(and(eq(contents.id, params.contentId), eq(contents.userId, params.userId)));

  return true;
}

export interface SimilarReferenceItem {
  id: string;
  url: string;
  hookText: string | null;
  summary: string | null;
  status: string;
  platformName: string;
  platformSlug: string;
  handle: string | null;
  similarity: number;
}

export async function findSimilarReferences(
  userId: string,
  refId: string,
  limit = 4
): Promise<SimilarReferenceItem[]> {
  try {
    const [target] = await db
      .select({ embedding: refs.embedding })
      .from(refs)
      .where(and(eq(refs.id, refId), eq(refs.userId, userId)))
      .limit(1);

    if (!target?.embedding) return [];

    const similarityExpr = sql<number>`(1 - (${cosineDistance(refs.embedding, target.embedding)}))`;

    const rows = await db
      .select({
        id: refs.id,
        url: refs.url,
        hookText: refs.hookText,
        summary: refs.summary,
        status: refs.status,
        platformName: platforms.name,
        platformSlug: platforms.slug,
        handle: sourceAccounts.handle,
        similarity: similarityExpr,
      })
      .from(refs)
      .innerJoin(platforms, eq(refs.platformId, platforms.id))
      .leftJoin(sourceAccounts, eq(refs.sourceAccountId, sourceAccounts.id))
      .where(
        and(
          eq(refs.userId, userId),
          ne(refs.id, refId),
          isNull(refs.archivedAt),
          isNotNull(refs.embedding)
        )
      )
      .orderBy(desc(similarityExpr))
      .limit(limit);

    return rows.filter((r) => Number(r.similarity) >= 0.45);
  } catch {
    return [];
  }
}

export async function findSemanticReferenceIds(
  userId: string,
  query: string,
  limit = 20
): Promise<string[]> {
  const clean = query.trim();
  if (clean.length < 3) return [];

  try {
    const key = await getUserAiKeyEncrypted(userId);
    const queryVec = await generateTextEmbedding768(clean, key);
    if (!queryVec) return [];

    const similarityExpr = sql<number>`(1 - (${cosineDistance(refs.embedding, queryVec)}))`;
    const rows = await db
      .select({
        id: refs.id,
        similarity: similarityExpr,
      })
      .from(refs)
      .where(
        and(
          eq(refs.userId, userId),
          isNull(refs.archivedAt),
          isNotNull(refs.embedding)
        )
      )
      .orderBy(desc(similarityExpr))
      .limit(limit);

    return rows.filter((r) => Number(r.similarity) >= 0.48).map((r) => r.id);
  } catch {
    return [];
  }
}
