"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import {
  contents,
  contentPillars,
  contentChecklist,
  refs,
  appSettings,
  pillars,
} from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";
import { recomputeContent } from "@/lib/domain/status";

const createContentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  formatId: z.string().uuid().nullable().optional(),
  seriesId: z.string().uuid().nullable().optional(),
  audioId: z.string().uuid().nullable().optional(),
  pillarIds: z.array(z.string().uuid()).optional(),
  refIds: z.array(z.string().uuid()).optional(),
  hookText: z.string().optional(),
  hookTypeId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  changesNote: z.string().optional(),
  workUrl: z.string().url().nullable().optional(),
  plannedFor: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export async function createContent(
  input: z.infer<typeof createContentSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = createContentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid content data");
  }

  const {
    title,
    formatId,
    seriesId,
    audioId,
    pillarIds,
    refIds,
    hookText,
    hookTypeId,
    notes,
    changesNote,
    workUrl,
    plannedFor,
    tags,
  } = parsed.data;

  return await withTx(async (tx) => {
    // 1. Insert content record
    const [created] = await tx
      .insert(contents)
      .values({
        userId: user.id,
        title: title.trim(),
        formatId: formatId || null,
        seriesId: seriesId || null,
        audioId: audioId || null,
        hookText: hookText || null,
        hookTypeId: hookTypeId || null,
        notes: notes || null,
        changesNote: changesNote || null,
        workUrl: workUrl || null,
        plannedFor: plannedFor || null,
        tags: tags || [],
        status: "production",
        searchText: [title, hookText || "", notes || "", changesNote || "", ...(tags || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })
      .returning({ id: contents.id });

    const contentId = created.id;

    // 2. Insert pillars (scoped to current user)
    if (pillarIds && pillarIds.length > 0) {
      const ownedPillars = await tx
        .select({ id: pillars.id })
        .from(pillars)
        .where(and(eq(pillars.userId, user.id), inArray(pillars.id, pillarIds)));
      if (ownedPillars.length > 0) {
        await tx.insert(contentPillars).values(
          ownedPillars.map((p) => ({
            contentId,
            pillarId: p.id,
          }))
        );
      }
    }

    // 3. Link references (scoped to current user)
    if (refIds && refIds.length > 0) {
      for (let i = 0; i < refIds.length; i++) {
        await tx
          .update(refs)
          .set({
            contentId,
            contentPosition: i + 1,
            status: "production",
            statusChangedAt: sql`now()`,
          })
          .where(and(eq(refs.id, refIds[i]), eq(refs.userId, user.id)));
      }
    }

    // 4. Insert default checklist items from app_settings
    const [settingsRow] = await tx
      .select({ defaultChecklist: appSettings.defaultChecklist })
      .from(appSettings)
      .where(eq(appSettings.userId, user.id))
      .limit(1);

    const fallbackChecklist = [
      "Script / outline",
      "Shoot or draw",
      "Edit",
      "Cover",
      "Caption and hashtags",
      "Audio checked",
    ];
    const checklistSteps =
      settingsRow?.defaultChecklist && settingsRow.defaultChecklist.length > 0
        ? settingsRow.defaultChecklist
        : fallbackChecklist;

    await tx.insert(contentChecklist).values(
      checklistSteps.map((label, idx) => ({
        contentId,
        label,
        isDone: false,
        position: idx + 1,
      }))
    );

    // 5. Recompute status
    await recomputeContent(tx, contentId);

    revalidatePath("/");
    revalidatePath("/contents");
    revalidatePath("/inbox");
    revalidatePath("/references");

    return ok({ id: contentId });
  });
}

const updateContentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  formatId: z.string().uuid().nullable().optional(),
  seriesId: z.string().uuid().nullable().optional(),
  audioId: z.string().uuid().nullable().optional(),
  pillarIds: z.array(z.string().uuid()).optional(),
  hookText: z.string().optional(),
  hookTypeId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  changesNote: z.string().optional(),
  workUrl: z.string().nullable().optional(),
  plannedFor: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  finalRating: z.number().int().min(1).max(5).nullable().optional(),
  finalRatingNote: z.string().optional(),
});

export async function updateContent(
  input: z.infer<typeof updateContentSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = updateContentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid update data");
  }

  const { id, pillarIds, ...updates } = parsed.data;

  return await withTx(async (tx) => {
    const [existing] = await tx
      .select({
        title: contents.title,
        hookText: contents.hookText,
        notes: contents.notes,
        changesNote: contents.changesNote,
        tags: contents.tags,
      })
      .from(contents)
      .where(and(eq(contents.id, id), eq(contents.userId, user.id)))
      .limit(1);

    if (!existing) {
      return fail("not_found", "Content not found");
    }

    const valuesToUpdate: Record<string, any> = {
      updatedAt: sql`now()`,
    };

    if (updates.title !== undefined) valuesToUpdate.title = updates.title.trim();
    if (updates.formatId !== undefined) valuesToUpdate.formatId = updates.formatId;
    if (updates.seriesId !== undefined) valuesToUpdate.seriesId = updates.seriesId;
    if (updates.audioId !== undefined) valuesToUpdate.audioId = updates.audioId;
    if (updates.hookText !== undefined) valuesToUpdate.hookText = updates.hookText;
    if (updates.hookTypeId !== undefined) valuesToUpdate.hookTypeId = updates.hookTypeId;
    if (updates.notes !== undefined) valuesToUpdate.notes = updates.notes;
    if (updates.changesNote !== undefined) valuesToUpdate.changesNote = updates.changesNote;
    if (updates.workUrl !== undefined) valuesToUpdate.workUrl = updates.workUrl || null;
    if (updates.plannedFor !== undefined) valuesToUpdate.plannedFor = updates.plannedFor || null;
    if (updates.tags !== undefined) valuesToUpdate.tags = updates.tags;
    if (updates.finalRating !== undefined) valuesToUpdate.finalRating = updates.finalRating;
    if (updates.finalRatingNote !== undefined) valuesToUpdate.finalRatingNote = updates.finalRatingNote;

    const mergedTitle = updates.title !== undefined ? updates.title.trim() : existing.title;
    const mergedHook = updates.hookText !== undefined ? updates.hookText : existing.hookText || "";
    const mergedNotes = updates.notes !== undefined ? updates.notes : existing.notes || "";
    const mergedChanges =
      updates.changesNote !== undefined ? updates.changesNote : existing.changesNote || "";
    const mergedTags = updates.tags !== undefined ? updates.tags : existing.tags || [];
    valuesToUpdate.searchText = [mergedTitle, mergedHook, mergedNotes, mergedChanges, ...mergedTags]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    await tx
      .update(contents)
      .set(valuesToUpdate)
      .where(and(eq(contents.id, id), eq(contents.userId, user.id)));

    if (pillarIds) {
      await tx.delete(contentPillars).where(eq(contentPillars.contentId, id));
      if (pillarIds.length > 0) {
        const ownedPillars = await tx
          .select({ id: pillars.id })
          .from(pillars)
          .where(and(eq(pillars.userId, user.id), inArray(pillars.id, pillarIds)));
        if (ownedPillars.length > 0) {
          await tx.insert(contentPillars).values(
            ownedPillars.map((p) => ({
              contentId: id,
              pillarId: p.id,
            }))
          );
        }
      }
    }

    revalidatePath("/");
    revalidatePath("/contents");
    revalidatePath(`/contents/${id}`);

    return ok({ id });
  });
}

const toggleChecklistSchema = z.object({
  id: z.string().uuid(),
  isDone: z.boolean(),
});

export async function toggleChecklistItem(
  input: z.infer<typeof toggleChecklistSchema>
): Promise<ActionResult<{ id: string; isDone: boolean }>> {
  const user = await requireActionOwner();

  const parsed = toggleChecklistSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid checklist item ID");

  const [item] = await db
    .select({ id: contentChecklist.id })
    .from(contentChecklist)
    .innerJoin(contents, eq(contentChecklist.contentId, contents.id))
    .where(and(eq(contentChecklist.id, parsed.data.id), eq(contents.userId, user.id)))
    .limit(1);

  if (!item) return fail("not_found", "Checklist item not found");

  await db
    .update(contentChecklist)
    .set({ isDone: parsed.data.isDone })
    .where(eq(contentChecklist.id, parsed.data.id));

  return ok({ id: parsed.data.id, isDone: parsed.data.isDone });
}

const addChecklistSchema = z.object({
  contentId: z.string().uuid(),
  label: z.string().min(1).max(120),
});

export async function addChecklistItem(
  input: z.infer<typeof addChecklistSchema>
): Promise<ActionResult<{ id: string; label: string }>> {
  const user = await requireActionOwner();

  const parsed = addChecklistSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid checklist item");

  const [ownedContent] = await db
    .select({ id: contents.id })
    .from(contents)
    .where(and(eq(contents.id, parsed.data.contentId), eq(contents.userId, user.id)))
    .limit(1);

  if (!ownedContent) return fail("not_found", "Content not found");

  const [countRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contentChecklist)
    .where(eq(contentChecklist.contentId, parsed.data.contentId));

  const position = (countRes?.count || 0) + 1;

  const [created] = await db
    .insert(contentChecklist)
    .values({
      contentId: parsed.data.contentId,
      label: parsed.data.label.trim(),
      position,
      isDone: false,
    })
    .returning({ id: contentChecklist.id });

  revalidatePath(`/contents/${parsed.data.contentId}`);
  return ok({ id: created.id, label: parsed.data.label });
}

const deleteChecklistSchema = z.object({
  id: z.string().uuid(),
  contentId: z.string().uuid(),
});

export async function deleteChecklistItem(
  input: z.infer<typeof deleteChecklistSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = deleteChecklistSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid checklist item");

  const [item] = await db
    .select({ id: contentChecklist.id })
    .from(contentChecklist)
    .innerJoin(contents, eq(contentChecklist.contentId, contents.id))
    .where(
      and(
        eq(contentChecklist.id, parsed.data.id),
        eq(contentChecklist.contentId, parsed.data.contentId),
        eq(contents.userId, user.id)
      )
    )
    .limit(1);

  if (!item) return fail("not_found", "Checklist item not found");

  await db
    .delete(contentChecklist)
    .where(
      and(
        eq(contentChecklist.id, parsed.data.id),
        eq(contentChecklist.contentId, parsed.data.contentId)
      )
    );

  revalidatePath(`/contents/${parsed.data.contentId}`);
  return ok({ id: parsed.data.id });
}

const linkRefSchema = z.object({
  contentId: z.string().uuid(),
  refId: z.string().uuid(),
});

export async function linkReferenceToContent(
  input: z.infer<typeof linkRefSchema>
): Promise<ActionResult<{ contentId: string; refId: string }>> {
  const user = await requireActionOwner();

  const parsed = linkRefSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid parameters");

  return await withTx(async (tx) => {
    const [ownedContent] = await tx
      .select({ id: contents.id })
      .from(contents)
      .where(and(eq(contents.id, parsed.data.contentId), eq(contents.userId, user.id)))
      .limit(1);

    if (!ownedContent) {
      return fail("not_found", "Content not found");
    }

    const [refRow] = await tx
      .select({ id: refs.id, contentId: refs.contentId })
      .from(refs)
      .where(and(eq(refs.id, parsed.data.refId), eq(refs.userId, user.id)))
      .limit(1);

    if (!refRow) {
      return fail("not_found", "Reference not found");
    }
    if (refRow.contentId && refRow.contentId !== parsed.data.contentId) {
      return fail("conflict", "Reference is already linked to another content piece");
    }

    const [existingCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(refs)
      .where(and(eq(refs.contentId, parsed.data.contentId), eq(refs.userId, user.id)));

    const nextPosition = (existingCount?.count || 0) + 1;

    await tx
      .update(refs)
      .set({
        contentId: parsed.data.contentId,
        contentPosition: nextPosition,
        status: "production",
        statusChangedAt: sql`now()`,
      })
      .where(and(eq(refs.id, parsed.data.refId), eq(refs.userId, user.id)));

    await recomputeContent(tx, parsed.data.contentId);

    revalidatePath(`/contents/${parsed.data.contentId}`);
    revalidatePath("/references");
    revalidatePath("/inbox");

    return ok({ contentId: parsed.data.contentId, refId: parsed.data.refId });
  });
}

export async function unlinkReferenceFromContent(
  input: z.infer<typeof linkRefSchema>
): Promise<ActionResult<{ contentId: string; refId: string }>> {
  const user = await requireActionOwner();

  const parsed = linkRefSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid parameters");

  return await withTx(async (tx) => {
    const [unlinked] = await tx
      .update(refs)
      .set({
        contentId: null,
        contentPosition: null,
        status: "selected",
        statusChangedAt: sql`now()`,
      })
      .where(
        and(
          eq(refs.id, parsed.data.refId),
          eq(refs.contentId, parsed.data.contentId),
          eq(refs.userId, user.id)
        )
      )
      .returning({ id: refs.id });

    if (!unlinked) {
      return fail("not_found", "Linked reference not found");
    }

    await recomputeContent(tx, parsed.data.contentId);

    revalidatePath(`/contents/${parsed.data.contentId}`);
    revalidatePath("/references");
    revalidatePath("/inbox");

    return ok({ contentId: parsed.data.contentId, refId: parsed.data.refId });
  });
}

const archiveContentSchema = z.object({
  id: z.string().uuid(),
});

export async function archiveContent(
  input: z.infer<typeof archiveContentSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = archiveContentSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid content ID");

  const [updated] = await db
    .update(contents)
    .set({ archivedAt: sql`now()` })
    .where(and(eq(contents.id, parsed.data.id), eq(contents.userId, user.id)))
    .returning({ id: contents.id });

  if (!updated) return fail("not_found", "Content not found");

  revalidatePath("/contents");
  revalidatePath(`/contents/${parsed.data.id}`);
  revalidatePath("/");

  return ok({ id: parsed.data.id });
}

export async function restoreContent(
  input: z.infer<typeof archiveContentSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = archiveContentSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid content ID");

  const [updated] = await db
    .update(contents)
    .set({ archivedAt: null, updatedAt: sql`now()` })
    .where(and(eq(contents.id, parsed.data.id), eq(contents.userId, user.id)))
    .returning({ id: contents.id });

  if (!updated) return fail("not_found", "Content not found");

  revalidatePath("/contents");
  revalidatePath(`/contents/${parsed.data.id}`);
  revalidatePath("/");

  return ok({ id: parsed.data.id });
}

export async function deleteContentPermanently(
  input: z.infer<typeof archiveContentSchema>
): Promise<ActionResult<{ id: string }>> {
  const user = await requireActionOwner();

  const parsed = archiveContentSchema.safeParse(input);
  if (!parsed.success) return fail("validation", "Invalid content ID");

  return await withTx(async (tx) => {
    const [existing] = await tx
      .select({ id: contents.id })
      .from(contents)
      .where(and(eq(contents.id, parsed.data.id), eq(contents.userId, user.id)))
      .limit(1);

    if (!existing) {
      return fail("not_found", "Content not found");
    }

    // Release linked references cleanly so refs_status_content_chk & ON DELETE RESTRICT are satisfied
    await tx
      .update(refs)
      .set({
        contentId: null,
        contentPosition: null,
        status: "selected",
        statusChangedAt: sql`now()`,
      })
      .where(and(eq(refs.contentId, parsed.data.id), eq(refs.userId, user.id)));

    await tx
      .delete(contents)
      .where(and(eq(contents.id, parsed.data.id), eq(contents.userId, user.id)));

    revalidatePath("/contents");
    revalidatePath("/references");
    revalidatePath("/inbox");
    revalidatePath("/evaluate");
    revalidatePath("/");

    return ok({ id: parsed.data.id });
  });
}
