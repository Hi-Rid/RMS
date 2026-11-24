/**
 * RMS Reference and Content Status State Machine (PRD §10.3, §10.4, §10.5)
 */

import { eq, and, isNull, sql } from "drizzle-orm";
import type { Tx } from "@/lib/db";
import { contents, refs, posts, snapshots } from "@/db/schema";

export type ContentStatus = "production" | "posted" | "evaluating";
export type RefStatus =
  | "inbox"
  | "selected"
  | "production"
  | "posted"
  | "evaluating"
  | "skipped";

/**
 * Derives content status automatically from its associated posts and snapshots:
 * - postCount === 0 -> "production"
 * - postCount > 0 && doneSnapshotCount === 0 -> "posted"
 * - postCount > 0 && doneSnapshotCount > 0 -> "evaluating"
 * (If all posts were deleted, reverts to "production")
 */
export function deriveContentStatus({
  postCount,
  doneSnapshotCount,
}: {
  postCount: number;
  doneSnapshotCount: number;
}): ContentStatus {
  if (postCount === 0) {
    return "production";
  }
  if (doneSnapshotCount > 0) {
    return "evaluating";
  }
  return "posted";
}

/**
 * Checks whether a manual transition is permitted for a reference:
 * - If reference is tied to content (hasContent = true), manual status changes are forbidden.
 * - Allowed manual transitions: only between inbox <-> selected <-> skipped.
 * - "production", "posted", "evaluating" cannot be set manually.
 */
export function isAllowedRefTransition(
  currentStatus: string,
  nextStatus: string,
  hasContent: boolean
): boolean {
  if (hasContent) {
    return false;
  }

  const manualAllowedStatuses = new Set(["inbox", "selected", "skipped"]);
  if (!manualAllowedStatuses.has(currentStatus) || !manualAllowedStatuses.has(nextStatus)) {
    return false;
  }

  return currentStatus !== nextStatus;
}

/**
 * Recomputes content status and updates all linked refs in a single transaction (PRD §10.3):
 * 1. Counts active posts and done snapshots for the given content.
 * 2. Derives content status.
 * 3. Updates contents row.
 * 4. Updates all linked refs rows to match the content status.
 */
export async function recomputeContent(
  tx: Tx,
  contentId: string
): Promise<ContentStatus> {
  // Query posts count
  const [postCountRes] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.contentId, contentId));

  const postCount = Number(postCountRes?.count) || 0;

  // Query done snapshots count
  const [snapshotCountRes] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(snapshots)
    .innerJoin(posts, eq(snapshots.postId, posts.id))
    .where(and(eq(posts.contentId, contentId), eq(snapshots.status, "done")));

  const doneSnapshotCount = Number(snapshotCountRes?.count) || 0;

  const newStatus = deriveContentStatus({ postCount, doneSnapshotCount });

  // Update content status
  await tx
    .update(contents)
    .set({
      status: newStatus,
      updatedAt: sql`now()`,
    })
    .where(eq(contents.id, contentId));

  // Update all linked active refs in a single statement
  await tx
    .update(refs)
    .set({
      status: newStatus,
      updatedAt: sql`now()`,
    })
    .where(and(eq(refs.contentId, contentId), isNull(refs.archivedAt)));

  return newStatus;
}
