"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sourceAccounts, platforms, refs } from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";
import { normalizeHandle } from "@/lib/domain/normalize";

const createSourceSchema = z.object({
  platformId: z.string().uuid("Select a valid platform"),
  handle: z.string().trim().min(1, "Creator handle is required").max(120),
  notes: z.string().trim().optional(),
});

export async function createSource(
  input: z.infer<typeof createSourceSchema>
): Promise<ActionResult<{ id: string; duplicate: boolean }>> {
  const user = await requireActionOwner();
  const parsed = createSourceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid creator input");
  }

  const cleanHandle = normalizeHandle(parsed.data.handle);
  if (!cleanHandle) {
    return fail("validation", "Creator handle cannot be empty");
  }

  try {
    const [platform] = await db
      .select({ id: platforms.id })
      .from(platforms)
      .where(and(eq(platforms.id, parsed.data.platformId), eq(platforms.userId, user.id)))
      .limit(1);

    if (!platform) {
      return fail("not_found", "Selected platform not found");
    }

    const [existing] = await db
      .select({ id: sourceAccounts.id })
      .from(sourceAccounts)
      .where(
        and(
          eq(sourceAccounts.userId, user.id),
          eq(sourceAccounts.platformId, parsed.data.platformId),
          eq(sourceAccounts.handle, cleanHandle)
        )
      )
      .limit(1);

    if (existing) {
      return ok({ id: existing.id, duplicate: true });
    }

    const [created] = await db
      .insert(sourceAccounts)
      .values({
        userId: user.id,
        platformId: parsed.data.platformId,
        handle: cleanHandle,
        notes: parsed.data.notes?.trim() || null,
      })
      .returning({ id: sourceAccounts.id });

    revalidatePath("/sources");
    revalidatePath("/home");
    return ok({ id: created.id, duplicate: false });
  } catch (error) {
    console.error("Create source error:", error);
    return fail("internal", "Failed to create creator account");
  }
}

const updateSourceSchema = z.object({
  id: z.string().uuid(),
  handle: z.string().trim().min(1, "Handle is required").max(120).optional(),
  notes: z.string(),
});

export async function updateSource(
  input: z.infer<typeof updateSourceSchema>
): Promise<ActionResult<void>> {
  const user = await requireActionOwner();
  const parsed = updateSourceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid update input");
  }

  try {
    const [existing] = await db
      .select({
        id: sourceAccounts.id,
        platformId: sourceAccounts.platformId,
        handle: sourceAccounts.handle,
      })
      .from(sourceAccounts)
      .where(and(eq(sourceAccounts.id, parsed.data.id), eq(sourceAccounts.userId, user.id)))
      .limit(1);

    if (!existing) {
      return fail("not_found", "Source account not found");
    }

    let nextHandle = existing.handle;
    if (parsed.data.handle !== undefined) {
      const normalized = normalizeHandle(parsed.data.handle);
      if (!normalized) {
        return fail("validation", "Creator handle cannot be empty");
      }
      if (normalized !== existing.handle) {
        const [dup] = await db
          .select({ id: sourceAccounts.id })
          .from(sourceAccounts)
          .where(
            and(
              eq(sourceAccounts.userId, user.id),
              eq(sourceAccounts.platformId, existing.platformId),
              eq(sourceAccounts.handle, normalized),
              ne(sourceAccounts.id, existing.id)
            )
          )
          .limit(1);

        if (dup) {
          return fail(
            "conflict",
            `Creator @${normalized} already exists on this platform`
          );
        }
        nextHandle = normalized;
      }
    }

    await db
      .update(sourceAccounts)
      .set({
        handle: nextHandle,
        notes: parsed.data.notes.trim() || null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(sourceAccounts.id, parsed.data.id), eq(sourceAccounts.userId, user.id)));

    revalidatePath("/sources");
    revalidatePath(`/sources/${parsed.data.id}`);
    revalidatePath("/references");
    revalidatePath("/inbox");
    return ok(undefined);
  } catch (error) {
    console.error("Update source error:", error);
    return fail("internal", "Failed to update source account");
  }
}

export async function updateSourceNotes(input: {
  id: string;
  notes: string;
}): Promise<ActionResult<void>> {
  return updateSource({ id: input.id, notes: input.notes });
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
    revalidatePath("/home");
    return ok(undefined);
  } catch (error) {
    console.error("Delete source error:", error);
    return fail("internal", "Failed to delete source account");
  }
}
