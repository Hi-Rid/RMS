"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { snapshots, posts } from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";
import { recomputeContent } from "@/lib/domain/status";

const saveSnapshotSchema = z.object({
  id: z.string().uuid(),
  views: z.number().int().min(0).nullable().optional(),
  likes: z.number().int().min(0).nullable().optional(),
  comments: z.number().int().min(0).nullable().optional(),
  shares: z.number().int().min(0).nullable().optional(),
  saves: z.number().int().min(0).nullable().optional(),
  reach: z.number().int().min(0).nullable().optional(),
  followerDelta: z.number().int().nullable().optional(),
  profileVisits: z.number().int().min(0).nullable().optional(),
  avgWatchSeconds: z.string().nullable().optional(),
  retentionPct: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().optional(),
});

export async function saveSnapshotMetrics(
  input: z.infer<typeof saveSnapshotSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = saveSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid snapshot data");
  }

  const {
    id,
    views,
    likes,
    comments,
    shares,
    saves,
    reach,
    followerDelta,
    profileVisits,
    avgWatchSeconds,
    retentionPct,
    rating,
    notes,
  } = parsed.data;

  return await withTx(async (tx) => {
    // 1. Fetch snapshot and find contentId (scoped to user)
    const [snap] = await tx
      .select({
        id: snapshots.id,
        postId: snapshots.postId,
        contentId: posts.contentId,
      })
      .from(snapshots)
      .innerJoin(posts, eq(snapshots.postId, posts.id))
      .where(
        and(
          eq(snapshots.id, id),
          eq(snapshots.userId, user.id),
          eq(posts.userId, user.id)
        )
      )
      .limit(1);

    if (!snap) return fail("not_found", "Snapshot not found");

    // 2. Update snapshot
    await tx
      .update(snapshots)
      .set({
        status: "done",
        views: views ?? null,
        likes: likes ?? null,
        comments: comments ?? null,
        shares: shares ?? null,
        saves: saves ?? null,
        reach: reach ?? null,
        followerDelta: followerDelta ?? null,
        profileVisits: profileVisits ?? null,
        avgWatchSeconds: avgWatchSeconds?.trim() ? avgWatchSeconds.trim() : null,
        retentionPct: retentionPct?.trim() ? retentionPct.trim() : null,
        rating: rating ?? null,
        notes: notes || null,
        filledAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(snapshots.id, id), eq(snapshots.userId, user.id)));

    // 3. Recompute content status (advances content and linked refs to "evaluating")
    await recomputeContent(tx, snap.contentId);

    revalidatePath("/home");
    revalidatePath("/evaluate");
    revalidatePath(`/contents/${snap.contentId}`);
    revalidatePath("/references");

    return ok({ id });
  });
}

const skipSnapshotSchema = z.object({
  id: z.string().uuid(),
});

export async function skipSnapshot(
  input: z.infer<typeof skipSnapshotSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = skipSnapshotSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid snapshot ID");

  return await withTx(async (tx) => {
    const [snap] = await tx
      .select({
        id: snapshots.id,
        contentId: posts.contentId,
      })
      .from(snapshots)
      .innerJoin(posts, eq(snapshots.postId, posts.id))
      .where(
        and(
          eq(snapshots.id, parsed.data.id),
          eq(snapshots.userId, user.id),
          eq(posts.userId, user.id)
        )
      )
      .limit(1);

    if (!snap) return fail("not_found", "Snapshot not found");

    await tx
      .update(snapshots)
      .set({
        status: "skipped",
        filledAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(snapshots.id, parsed.data.id), eq(snapshots.userId, user.id)));

    await recomputeContent(tx, snap.contentId);

    revalidatePath("/home");
    revalidatePath("/evaluate");
    revalidatePath(`/contents/${snap.contentId}`);

    return ok({ id: parsed.data.id });
  });
}
