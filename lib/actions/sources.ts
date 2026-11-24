"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceAccounts, refs } from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";

export async function updateSourceNotes(input: {
  id: string;
  notes: string;
}): Promise<ActionResult<void>> {
  await requireActionOwner();

  try {
    await db
      .update(sourceAccounts)
      .set({
        notes: input.notes.trim() || null,
        updatedAt: sql`now()`,
      })
      .where(eq(sourceAccounts.id, input.id));

    revalidatePath("/sources");
    revalidatePath(`/sources/${input.id}`);
    return ok(undefined);
  } catch (error) {
    console.error("Update source notes error:", error);
    return fail("internal", "Failed to update source notes");
  }
}

export async function deleteSource(id: string): Promise<ActionResult<void>> {
  await requireActionOwner();

  try {
    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(refs)
      .where(eq(refs.sourceAccountId, id));

    if ((countRes?.count || 0) > 0) {
      return fail(
        "blocked",
        `Cannot delete: Source has ${countRes.count} references associated.`
      );
    }

    await db.delete(sourceAccounts).where(eq(sourceAccounts.id, id));
    revalidatePath("/sources");
    return ok(undefined);
  } catch (error) {
    console.error("Delete source error:", error);
    return fail("internal", "Failed to delete source account");
  }
}
