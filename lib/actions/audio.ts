"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, sql, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { audios, refs, contents } from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";

const createAudioSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  artist: z.string().trim().max(200).default(""),
  isOriginal: z.boolean().default(false),
  notes: z.string().trim().optional(),
});

export async function createAudio(
  input: z.infer<typeof createAudioSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();
  const parsed = createAudioSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  const { title, artist, isOriginal, notes } = parsed.data;

  try {
    // Check duplicate by title & artist (case-insensitive) within user workspace
    const [existing] = await db
      .select({ id: audios.id })
      .from(audios)
      .where(
        and(
          eq(audios.userId, user.id),
          sql`lower(btrim(${audios.title})) = ${title.toLowerCase().trim()}`,
          sql`lower(btrim(${audios.artist})) = ${artist.toLowerCase().trim()}`
        )
      )
      .limit(1);

    if (existing) {
      return ok({ id: existing.id });
    }

    const [created] = await db
      .insert(audios)
      .values({
        userId: user.id,
        title: title.trim(),
        artist: artist.trim(),
        isOriginal,
        notes: notes || null,
      })
      .returning({ id: audios.id });

    revalidatePath("/audio");
    return ok({ id: created.id });
  } catch (error) {
    console.error("Create audio error:", error);
    return fail("internal", "Failed to create audio track");
  }
}

const updateAudioSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  artist: z.string().trim().max(200).default(""),
  isOriginal: z.boolean().default(false),
  notes: z.string().trim().optional(),
});

export async function updateAudio(
  input: z.infer<typeof updateAudioSchema>
): Promise<ActionResult<void>> {
  const user = await requireActionOwner();
  const parsed = updateAudioSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  const { id, title, artist, isOriginal, notes } = parsed.data;

  try {
    const [updated] = await db
      .update(audios)
      .set({
        title: title.trim(),
        artist: artist.trim(),
        isOriginal,
        notes: notes || null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(audios.id, id), eq(audios.userId, user.id)))
      .returning({ id: audios.id });

    if (!updated) {
      return fail("not_found", "Audio track not found");
    }

    revalidatePath("/audio");
    revalidatePath(`/audio/${id}`);
    return ok(undefined);
  } catch (error) {
    console.error("Update audio error:", error);
    return fail("internal", "Failed to update audio track");
  }
}

export async function deleteAudio(id: string): Promise<ActionResult<void>> {
  const user = await requireActionOwner();

  try {
    const [existing] = await db
      .select({ id: audios.id })
      .from(audios)
      .where(and(eq(audios.id, id), eq(audios.userId, user.id)))
      .limit(1);

    if (!existing) {
      return fail("not_found", "Audio track not found");
    }

    // Check if used by refs or contents
    const [refCountRes, contentCountRes] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(refs)
        .where(and(eq(refs.audioId, id), eq(refs.userId, user.id))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contents)
        .where(and(eq(contents.audioId, id), eq(contents.userId, user.id))),
    ]);

    const usedInRefs = refCountRes[0]?.count || 0;
    const usedInContents = contentCountRes[0]?.count || 0;

    if (usedInRefs > 0 || usedInContents > 0) {
      return fail(
        "blocked",
        `Cannot delete: Audio is in use by ${usedInRefs} reference(s) and ${usedInContents} content(s).`
      );
    }

    await db
      .delete(audios)
      .where(and(eq(audios.id, id), eq(audios.userId, user.id)));
    revalidatePath("/audio");
    return ok(undefined);
  } catch (error) {
    console.error("Delete audio error:", error);
    return fail("internal", "Failed to delete audio track");
  }
}
