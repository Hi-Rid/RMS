import "server-only";
import { eq, sql, and, isNull, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { getOwner } from "@/lib/auth/owner";
import { contents, posts, appSettings, formats, contentChecklist } from "@/db/schema";
import { startOfWeek as getWibWeekStart } from "@/lib/domain/time";

export interface PlannerContentItem {
  id: string;
  title: string;
  status: string;
  plannedFor: string | null;
  formatName: string | null;
  postedAt: string | null;
  postUrl: string | null;
  checklistTotal: number;
  checklistDone: number;
}

export async function getPlannerData(explicitUserId?: string) {
  try {
    const userId = explicitUserId ?? (await getOwner())?.id;
    if (!userId) {
      return {
        weeklyTarget: 3,
        postedThisWeek: 0,
        scheduledContents: [] as PlannerContentItem[],
        unscheduledContents: [] as PlannerContentItem[],
      };
    }

    const weekStartUtc = getWibWeekStart(new Date());

    const [[settings], scheduledRows, unscheduledRows, [thisWeekPostsCountRes]] = await Promise.all([
      db.select().from(appSettings).where(eq(appSettings.userId, userId)).limit(1),

      db
        .select({
          id: contents.id,
          title: contents.title,
          status: contents.status,
          plannedFor: contents.plannedFor,
          formatName: formats.name,
          postedAt: sql<string | null>`(SELECT max(p.posted_at)::text FROM ${posts} p WHERE p.content_id = ${contents.id})`,
          postUrl: sql<string | null>`(SELECT max(p.url) FROM ${posts} p WHERE p.content_id = ${contents.id})`,
          checklistTotal: sql<number>`(SELECT count(*)::int FROM ${contentChecklist} cc WHERE cc.content_id = ${contents.id})`,
          checklistDone: sql<number>`(SELECT count(*)::int FROM ${contentChecklist} cc WHERE cc.content_id = ${contents.id} AND cc.is_done = true)`,
        })
        .from(contents)
        .leftJoin(formats, eq(contents.formatId, formats.id))
        .where(
          and(
            eq(contents.userId, userId),
            isNull(contents.archivedAt),
            sql`${contents.plannedFor} IS NOT NULL`
          )
        )
        .orderBy(asc(contents.plannedFor)),

      db
        .select({
          id: contents.id,
          title: contents.title,
          status: contents.status,
          plannedFor: contents.plannedFor,
          formatName: formats.name,
          postedAt: sql<string | null>`null`,
          postUrl: sql<string | null>`null`,
          checklistTotal: sql<number>`(SELECT count(*)::int FROM ${contentChecklist} cc WHERE cc.content_id = ${contents.id})`,
          checklistDone: sql<number>`(SELECT count(*)::int FROM ${contentChecklist} cc WHERE cc.content_id = ${contents.id} AND cc.is_done = true)`,
        })
        .from(contents)
        .leftJoin(formats, eq(contents.formatId, formats.id))
        .where(
          and(
            eq(contents.userId, userId),
            isNull(contents.archivedAt),
            isNull(contents.plannedFor),
            eq(contents.status, "production")
          )
        )
        .orderBy(desc(contents.createdAt)),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(
          and(
            eq(posts.userId, userId),
            sql`${posts.postedAt} >= ${weekStartUtc.toISOString()}::timestamptz AND ${posts.postedAt} < (${weekStartUtc.toISOString()}::timestamptz + INTERVAL '7 days')`
          )
        ),
    ]);

    const weeklyTarget = settings?.weeklyPostTarget || 3;
    const postedThisWeek = thisWeekPostsCountRes?.count || 0;

    return {
      weeklyTarget,
      postedThisWeek,
      scheduledContents: scheduledRows as PlannerContentItem[],
      unscheduledContents: unscheduledRows as PlannerContentItem[],
    };
  } catch (error) {
    console.warn("Failed to get planner data:", error);
    return {
      weeklyTarget: 3,
      postedThisWeek: 0,
      scheduledContents: [],
      unscheduledContents: [],
    };
  }
}
