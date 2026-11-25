"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceAccounts, refs } from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";

export async function updateSourceNotes(input: {
  id: string;
  notes: string;
}): Promise<ActionResult<void>> {
  const user = await requireActionOwner();

  try {
    const [updated] = await db
      .update(sourceAccounts)
      .set({
        notes: input.notes.trim() || null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(sourceAccounts.id, input.id), eq(sourceAccounts.userId, user.id)))
      .returning({ id: sourceAccounts.id });

    if (!updated) {
      return fail("not_found", "Source account not found");
    }

    revalidatePath("/sources");
    revalidatePath(`/sources/${input.id}`);
    return ok(undefined);
  } catch (error) {
    console.error("Update source notes error:", error);
    return fail("internal", "Failed to update source notes");
  }
}

export async function deleteSource(id: string): Promise<ActionResult<void>> {
  const user = await requireActionOwner();

  try {
    const [existing] = await db
      .select({ id: sourceAccounts.id })
      .from(sourceAccounts)
      .where(and(eq(sourceAccounts.id, id), eq(sourceAccounts.userId, user.id)))
      .limit(1);

    if (!existing) {
      return fail("not_found", "Source account not found");
    }

    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(refs)
      .where(and(eq(refs.sourceAccountId, id), eq(refs.userId, user.id)));

    if ((countRes?.count || 0) > 0) {
      return fail(
        "blocked",
        `Cannot delete: Source has ${countRes.count} references associated.`
      );
    }

    await db
      .delete(sourceAccounts)
      .where(and(eq(sourceAccounts.id, id), eq(sourceAccounts.userId, user.id)));
    revalidatePath("/sources");
    return ok(undefined);
  } catch (error) {
    console.error("Delete source error:", error);
    return fail("internal", "Failed to delete source account");
  }
}
