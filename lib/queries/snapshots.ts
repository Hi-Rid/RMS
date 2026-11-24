import { eq, and, sql, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { snapshots, posts, contents, platforms } from "@/db/schema";

export interface SnapshotItem {
  id: string;
  checkpoint: string;
  dueAt: string;
  status: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  retentionPct: string | null;
  rating: number | null;
  notes: string | null;
  filledAt: string | null;
  post: {
    id: string;
    url: string | null;
    caption: string | null;
    postedAt: string;
    platform: { id: string; name: string; slug: string };
  };
  content: {
    id: string;
    title: string;
    status: string;
  };
}

export interface ListSnapshotsParams {
  filter?: "due" | "upcoming" | "done" | "all";
}

/**
 * Retrieves snapshot checkpoints filtered by due, upcoming, or completed status.
 */
export async function listSnapshots(params: ListSnapshotsParams = {}): Promise<{
  items: SnapshotItem[];
  counts: { due: number; upcoming: number; done: number };
}> {
  const { filter = "due" } = params;

  // Query counts for tabs
  const [dueCountRes, upcomingCountRes, doneCountRes] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(snapshots)
      .where(and(eq(snapshots.status, "pending"), sql`${snapshots.dueAt} <= now()`)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(snapshots)
      .where(and(eq(snapshots.status, "pending"), sql`${snapshots.dueAt} > now()`)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(snapshots)
      .where(eq(snapshots.status, "done")),
  ]);

  const counts = {
    due: dueCountRes[0]?.count || 0,
    upcoming: upcomingCountRes[0]?.count || 0,
    done: doneCountRes[0]?.count || 0,
  };

  // Conditions for list query
  const conditions = [];
  if (filter === "due") {
    conditions.push(eq(snapshots.status, "pending"));
    conditions.push(sql`${snapshots.dueAt} <= now()`);
  } else if (filter === "upcoming") {
    conditions.push(eq(snapshots.status, "pending"));
    conditions.push(sql`${snapshots.dueAt} > now()`);
  } else if (filter === "done") {
    conditions.push(eq(snapshots.status, "done"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      snapshot: snapshots,
      post: posts,
      content: contents,
      platform: platforms,
    })
    .from(snapshots)
    .innerJoin(posts, eq(snapshots.postId, posts.id))
    .innerJoin(contents, eq(posts.contentId, contents.id))
    .innerJoin(platforms, eq(posts.platformId, platforms.id))
    .where(whereClause)
    .orderBy(filter === "done" ? desc(snapshots.filledAt) : asc(snapshots.dueAt))
    .limit(50);

  const items: SnapshotItem[] = rows.map((r) => ({
    id: r.snapshot.id,
    checkpoint: r.snapshot.checkpoint,
    dueAt: r.snapshot.dueAt,
    status: r.snapshot.status,
    views: r.snapshot.views,
    likes: r.snapshot.likes,
    comments: r.snapshot.comments,
    shares: r.snapshot.shares,
    saves: r.snapshot.saves,
    retentionPct: r.snapshot.retentionPct,
    rating: r.snapshot.rating,
    notes: r.snapshot.notes,
    filledAt: r.snapshot.filledAt,
    post: {
      id: r.post.id,
      url: r.post.url,
      caption: r.post.caption,
      postedAt: r.post.postedAt,
      platform: {
        id: r.platform.id,
        name: r.platform.name,
        slug: r.platform.slug,
      },
    },
    content: {
      id: r.content.id,
      title: r.content.title,
      status: r.content.status,
    },
  }));

  return { items, counts };
}
