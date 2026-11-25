"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contents } from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";

export async function setContentSchedule(input: {
  contentId: string;
  dateStr: string | null; // "YYYY-MM-DD" or null
}): Promise<ActionResult<void>> {
  const user = await requireActionOwner();

  try {
    const [updated] = await db
      .update(contents)
      .set({
        plannedFor: input.dateStr ? input.dateStr : null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(contents.id, input.contentId), eq(contents.userId, user.id)))
      .returning({ id: contents.id });

    if (!updated) {
      return fail("not_found", "Content not found");
    }

    revalidatePath("/planner");
    revalidatePath("/contents");
    revalidatePath(`/contents/${input.contentId}`);
    return ok(undefined);
  } catch (error) {
    console.error("Set content schedule error:", error);
    return fail("internal", "Failed to update content schedule");
  }
}
