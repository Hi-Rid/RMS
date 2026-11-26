"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { withTx } from "@/lib/db";
import { snapshots, posts } from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";
import { recomputeContent } from "@/lib/domain/status";

const nonNegDecimalString = (label: string, max?: number) =>
  z
    .string()
    .trim()
    .refine((val) => {
      if (!val) return true;
      const normalized = val.replace(/,/g, ".");
      const n = Number(normalized);
      if (!Number.isFinite(n) || n < 0) return false;
      if (max !== undefined && n > max) return false;
      return true;
    }, `${label} must be a valid number${max !== undefined ? ` between 0 and ${max}` : " >= 0"}`)
    .nullable()
    .optional();

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
  avgWatchSeconds: nonNegDecimalString("Avg watch seconds"),
  retentionPct: nonNegDecimalString("Retention %", 100),
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

  const cleanWatch = avgWatchSeconds?.trim() ? avgWatchSeconds.trim().replace(/,/g, ".") : null;
  const cleanRetention = retentionPct?.trim() ? retentionPct.trim().replace(/,/g, ".") : null;
  const cleanNotes = notes?.trim() ? notes.trim() : null;

  const hasAnyValue =
    views != null ||
    likes != null ||
    comments != null ||
    shares != null ||
    saves != null ||
    reach != null ||
    followerDelta != null ||
    profileVisits != null ||
    cleanWatch != null ||
    cleanRetention != null ||
    rating != null ||
    cleanNotes != null;

  if (!hasAnyValue) {
    return fail("validation", "Enter at least one metric, rating, or note before saving.");
  }

  try {
    return await withTx(async (tx) => {
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
          avgWatchSeconds: cleanWatch,
          retentionPct: cleanRetention,
          rating: rating ?? null,
          notes: cleanNotes,
          filledAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(snapshots.id, id), eq(snapshots.userId, user.id)));

      await recomputeContent(tx, snap.contentId);

      revalidatePath("/home");
      revalidatePath("/evaluate");
      revalidatePath(`/contents/${snap.contentId}`);
      revalidatePath("/references");

      return ok({ id });
    });
  } catch (err) {
    console.error("Error saving snapshot metrics:", err);
    return fail("internal", "Could not save metrics. Please check your numeric inputs.");
  }
}

const snapshotIdSchema = z.object({
  id: z.string().uuid(),
});

export async function skipSnapshot(
  input: z.infer<typeof snapshotIdSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = snapshotIdSchema.safeParse(input);
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

export async function restoreSnapshot(
  input: z.infer<typeof snapshotIdSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = snapshotIdSchema.safeParse(input);
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
        status: "pending",
        filledAt: null,
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
