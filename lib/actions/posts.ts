"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { posts, snapshots } from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";
import { recomputeContent } from "@/lib/domain/status";
import { dueAt, CHECKPOINTS } from "@/lib/domain/checkpoints";

const addPostSchema = z.object({
  contentId: z.string().uuid(),
  platformId: z.string().uuid(),
  url: z.string().url().nullable().optional(),
  caption: z.string().optional(),
  postedAt: z.string().optional(),
});

/**
 * Adds a published post to content and creates the 3 checkpoint snapshots (PRD §10.5).
 */
export async function addPost(
  input: z.infer<typeof addPostSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireActionOwner();

  const parsed = addPostSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid post data");
  }

  const { contentId, platformId, url, caption, postedAt } = parsed.data;
  const postDate = postedAt ? new Date(postedAt) : new Date();

  return await withTx(async (tx) => {
    // 1. Check if post for this platform already exists on this content (unique constraint)
    const [existing] = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(sql`${posts.contentId} = ${contentId} AND ${posts.platformId} = ${platformId}`)
      .limit(1);

    if (existing) {
      return fail("conflict", "A post for this platform already exists on this content");
    }

    // 2. Insert post
    const [createdPost] = await tx
      .insert(posts)
      .values({
        contentId,
        platformId,
        url: url || null,
        caption: caption || null,
        postedAt: postDate.toISOString(),
      })
      .returning({ id: posts.id });

    const postId = createdPost.id;

    // 3. Create the 3 snapshots (h24, d7, d30)
    for (const checkpoint of CHECKPOINTS) {
      const checkpointDue = dueAt(postDate, checkpoint);
      await tx.insert(snapshots).values({
        postId,
        checkpoint,
        dueAt: checkpointDue.toISOString(),
        status: "pending",
      });
    }

    // 4. Recompute content status (transitions to "posted")
    await recomputeContent(tx, contentId);

    revalidatePath("/");
    revalidatePath("/contents");
    revalidatePath(`/contents/${contentId}`);
    revalidatePath("/evaluate");
    revalidatePath("/references");

    return ok({ id: postId });
  });
}

const deletePostSchema = z.object({
  postId: z.string().uuid(),
  contentId: z.string().uuid(),
});

/**
 * Deletes a post, cascades snapshots, and reverts content status if needed.
 */
export async function deletePost(
  input: z.infer<typeof deletePostSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireActionOwner();

  const parsed = deletePostSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid parameters");

  return await withTx(async (tx) => {
    // Snapshots cascade on post delete (via foreign key)
    await tx.delete(posts).where(eq(posts.id, parsed.data.postId));

    await recomputeContent(tx, parsed.data.contentId);

    revalidatePath("/");
    revalidatePath("/contents");
    revalidatePath(`/contents/${parsed.data.contentId}`);
    revalidatePath("/evaluate");

    return ok({ id: parsed.data.postId });
  });
}
