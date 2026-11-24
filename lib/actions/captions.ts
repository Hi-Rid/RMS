"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { snippets } from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";

const createSnippetSchema = z.object({
  kind: z.enum(["caption", "hashtag_set"]),
  title: z.string().trim().min(1, "Title is required").max(120),
  body: z.string().trim().min(1, "Body is required"),
  pillarId: z.string().uuid().optional().nullable(),
  platformId: z.string().uuid().optional().nullable(),
});

export async function createSnippet(
  input: z.infer<typeof createSnippetSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireActionOwner();
  const parsed = createSnippetSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  try {
    const [created] = await db
      .insert(snippets)
      .values({
        kind: parsed.data.kind,
        title: parsed.data.title,
        body: parsed.data.body,
        pillarId: parsed.data.pillarId || null,
        platformId: parsed.data.platformId || null,
      })
      .returning({ id: snippets.id });

    revalidatePath("/captions");
    return ok({ id: created.id });
  } catch (error) {
    console.error("Create snippet error:", error);
    return fail("internal", "Failed to create snippet");
  }
}

const updateSnippetSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(120),
  body: z.string().trim().min(1, "Body is required"),
  pillarId: z.string().uuid().optional().nullable(),
  platformId: z.string().uuid().optional().nullable(),
});

export async function updateSnippet(
  input: z.infer<typeof updateSnippetSchema>
): Promise<ActionResult<void>> {
  await requireActionOwner();
  const parsed = updateSnippetSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  try {
    await db
      .update(snippets)
      .set({
        title: parsed.data.title,
        body: parsed.data.body,
        pillarId: parsed.data.pillarId || null,
        platformId: parsed.data.platformId || null,
        updatedAt: sql`now()`,
      })
      .where(eq(snippets.id, parsed.data.id));

    revalidatePath("/captions");
    return ok(undefined);
  } catch (error) {
    console.error("Update snippet error:", error);
    return fail("internal", "Failed to update snippet");
  }
}

export async function deleteSnippet(id: string): Promise<ActionResult<void>> {
  await requireActionOwner();

  try {
    await db.delete(snippets).where(eq(snippets.id, id));
    revalidatePath("/captions");
    return ok(undefined);
  } catch (error) {
    console.error("Delete snippet error:", error);
    return fail("internal", "Failed to delete snippet");
  }
}

export async function markSnippetUsed(id: string): Promise<ActionResult<void>> {
  try {
    await db
      .update(snippets)
      .set({
        useCount: sql`${snippets.useCount} + 1`,
        lastUsedAt: sql`now()`,
      })
      .where(eq(snippets.id, id));

    return ok(undefined);
  } catch (error) {
    console.error("Mark snippet used error:", error);
    return fail("internal", "Failed to record usage");
  }
}
