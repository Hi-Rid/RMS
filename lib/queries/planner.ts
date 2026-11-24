import "server-only";
import { eq, sql, and, isNull, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contents, posts, appSettings, formats, pillars, contentPillars } from "@/db/schema";
import { startOfWeek, endOfWeek, format } from "date-fns";

export interface PlannerContentItem {
  id: string;
  title: string;
  status: string;
  plannedFor: string | null;
  formatName: string | null;
  postedAt: string | null;
  postUrl: string | null;
}

export async function getPlannerData() {
  try {
    const now = new Date();
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    const sunday = endOfWeek(now, { weekStartsOn: 1 });
    const mondayStr = format(monday, "yyyy-MM-dd");
    const sundayStr = format(sunday, "yyyy-MM-dd");

    // 1. App settings for weekly target
    const [settings] = await db.select().from(appSettings).limit(1);
    const weeklyTarget = settings?.weeklyPostTarget || 3;

    // 2. All active contents with plannedFor
    const scheduledRows = await db
      .select({
        id: contents.id,
        title: contents.title,
        status: contents.status,
        plannedFor: contents.plannedFor,
        formatName: formats.name,
        postedAt: sql<string | null>`(SELECT max(p.posted_at)::text FROM ${posts} p WHERE p.content_id = ${contents.id})`,
        postUrl: sql<string | null>`(SELECT max(p.url) FROM ${posts} p WHERE p.content_id = ${contents.id})`,
      })
      .from(contents)
      .leftJoin(formats, eq(contents.formatId, formats.id))
      .where(and(isNull(contents.archivedAt), sql`${contents.plannedFor} IS NOT NULL`))
      .orderBy(asc(contents.plannedFor));

    // 3. Unscheduled production drafts (PRD §12.14: contents in production without date)
    const unscheduledRows = await db
      .select({
        id: contents.id,
        title: contents.title,
        status: contents.status,
        plannedFor: contents.plannedFor,
        formatName: formats.name,
        postedAt: sql<string | null>`null`,
        postUrl: sql<string | null>`null`,
      })
      .from(contents)
      .leftJoin(formats, eq(contents.formatId, formats.id))
      .where(
        and(
          isNull(contents.archivedAt),
          isNull(contents.plannedFor),
          eq(contents.status, "production")
        )
      )
      .orderBy(desc(contents.createdAt));

    // 4. Posts published this week
    const [thisWeekPostsCountRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(
        sql`posted_at >= ${mondayStr}::timestamptz AND posted_at <= (${sundayStr}::date + INTERVAL '1 day')::timestamptz`
      );

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
