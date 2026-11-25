import { generateText, Output } from "ai";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import {
  aiUsage,
  audios,
  contentChecklist,
  contentPillars,
  contents,
  pillars,
  platforms,
  refElements,
  refPillars,
  refs,
  series,
  sourceAccounts,
  systemLogs,
} from "@/db/schema";
import { getGoogleClient, runWithModelFallback } from "@/lib/ai/client";
import { getAppSettings } from "@/lib/queries/settings";
import { getMasterData } from "@/lib/queries/references";
import { matchHookTypeId, normalizeTag } from "@/lib/domain/normalize";
import { recomputeContent } from "@/lib/domain/status";
import {
  fetchSocialMetadata,
  normalizeSocialHandle,
  type SocialMetadata,
} from "@/lib/ingest/metadata";
import { normalizeUrl, type Platform } from "@/lib/domain/url";

export type AiIngestMode = "inbox" | "selected" | "auto_draft";

export interface RunAiAgentInput {
  userId: string;
  refId: string;
  url: string;
  platformSlug: Platform;
  rawInput?: string | null;
  urlHandle?: string | null;
  externalId?: string | null;
  force?: boolean;
}

export interface RunAiAgentResult {
  enriched: boolean;
  metadataFetched: boolean;
  skippedReason?: string;
  mode: AiIngestMode;
  summary: string | null;
  hookText: string | null;
  coverUrl: string | null;
  draftContentId: string | null;
  draftContentTitle: string | null;
}

const VALID_ELEMENTS = ["idea", "hook", "audio", "visual", "topic"] as const;
type RefElementType = (typeof VALID_ELEMENTS)[number];

const baseAgentSchema = z.object({
  summary: z
    .string()
    .describe("Concise 1-2 sentence summary of what this reference covers and its core insight"),
  hookText: z
    .string()
    .describe("Opening 3-second hook text or punchy angle distilled from this reference (max 240 chars)"),
  hookTypeSlug: z
    .string()
    .nullable()
    .describe("Best matching hook type slug from the configured hookTypes list, or null"),
  formatSlug: z
    .string()
    .nullable()
    .describe("Best matching content format slug from the configured formats list, or null"),
  pillarSlugs: z
    .array(z.string())
    .max(4)
    .describe("1 to 3 matching content pillar slugs from the configured pillars list"),
  tags: z
    .array(z.string())
    .max(12)
    .describe("Relevant short keyword tags (lowercase, no # prefix)"),
  creatorHandle: z
    .string()
    .nullable()
    .describe("Creator handle without @ if identifiable from metadata/URL, else null"),
  visualNotes: z
    .string()
    .describe("Visual composition, framing, pacing, text overlay, or editing takeaways grounded in metadata"),
  agentNotes: z
    .string()
    .describe("Personalized recommendation from the Creator Agent on why this matters and how to adapt it"),
  elements: z
    .array(z.enum(VALID_ELEMENTS))
    .max(5)
    .describe("Which reusable elements make this reference worth keeping (subset of idea, hook, audio, visual, topic)"),
});

const contentDraftSchema = z.object({
  title: z
    .string()
    .max(180)
    .describe("Compelling production title tailored for the creator's own channel and persona"),
  hookText: z
    .string()
    .max(280)
    .describe("Adapted opening hook written in the creator's own voice"),
  seriesSlug: z
    .string()
    .nullable()
    .describe("Matching active series slug from configured series list, or null"),
  changesNote: z
    .string()
    .describe("What angle, format, or framing the creator should tweak from the original reference"),
  productionScript: z
    .string()
    .describe("Ready-to-shoot 45-60s outline/script structured cleanly with [HOOK], [BODY / BEATS], [VISUAL CUES], and [CTA]"),
  captionDraft: z
    .string()
    .describe("Ready-to-post caption matching the creator's voice + 3-5 relevant hashtags"),
});

const fullAutoAgentSchema = baseAgentSchema.extend({
  contentDraft: contentDraftSchema,
});

type AgentAiOutput = z.infer<typeof baseAgentSchema> & {
  contentDraft?: z.infer<typeof contentDraftSchema>;
};

const FALLBACK_CHECKLIST = [
  "Script / outline",
  "Shoot or draw",
  "Edit",
  "Cover",
  "Caption and hashtags",
  "Audio checked",
];

export function buildCreatorPersonaPrompt(settings: {
  creatorNiche?: string | null;
  creatorAudience?: string | null;
  creatorVoice?: string | null;
}): string {
  const parts: string[] = [];
  if (settings.creatorNiche?.trim()) {
    parts.push(`- Niche / Core Topics: ${settings.creatorNiche.trim()}`);
  }
  if (settings.creatorAudience?.trim()) {
    parts.push(`- Target Audience: ${settings.creatorAudience.trim()}`);
  }
  if (settings.creatorVoice?.trim()) {
    parts.push(`- Brand Voice & Delivery Style: ${settings.creatorVoice.trim()}`);
  }
  if (parts.length === 0) return "";
  return `CREATOR PERSONA (tailor every recommendation, hook, and draft strictly to this creator):\n${parts.join("\n")}`;
}

function sanitizeTags(candidates: string[], max = 30): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of candidates) {
    const clean = normalizeTag(raw);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}

function buildSearchText(parts: Array<string | null | undefined>): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function generateAgentPlan(
  model: ReturnType<NonNullable<ReturnType<typeof getGoogleClient>>>,
  prompt: string,
  includeDraft: boolean
): Promise<{
  output: AgentAiOutput;
  inputTokens?: number;
  outputTokens?: number;
}> {
  if (includeDraft) {
    const res = await generateText({
      model,
      output: Output.object({ schema: fullAutoAgentSchema }),
      prompt,
    });
    return {
      output: res.output,
      inputTokens: res.usage?.inputTokens,
      outputTokens: res.usage?.outputTokens,
    };
  }

  const res = await generateText({
    model,
    output: Output.object({ schema: baseAgentSchema }),
    prompt,
  });
  return {
    output: res.output,
    inputTokens: res.usage?.inputTokens,
    outputTokens: res.usage?.outputTokens,
  };
}

function buildFallbackSummary(metadata: SocialMetadata): string | null {
  const parts = [metadata.title, metadata.sharedText].filter(
    (s): s is string => Boolean(s && s.trim())
  );
  if (parts.length === 0 && metadata.description) {
    parts.push(metadata.description);
  }
  if (parts.length === 0) return null;
  const joined = parts.join(" — ").replace(/\s+/g, " ").trim();
  return joined.slice(0, 500);
}

/**
 * Autonomous Social Metadata + AI Content Agent Pipeline.
 * 1. Fetches social metadata (oEmbed / OpenGraph / share-sheet context) cleanly.
 * 2. When enabled (or forced), runs Gemini with Creator Persona to auto-fill Reference fields.
 * 3. Depending on `aiIngestMode` (`inbox` | `selected` | `auto_draft`), promotes or drafts Content in Studio.
 */
export async function runAiAgentForReference(
  input: RunAiAgentInput
): Promise<RunAiAgentResult> {
  const [settings, existingRows] = await Promise.all([
    getAppSettings(input.userId),
    db
      .select()
      .from(refs)
      .where(and(eq(refs.id, input.refId), eq(refs.userId, input.userId)))
      .limit(1),
  ]);

  const refRow = existingRows[0];
  const mode = (settings.aiIngestMode as AiIngestMode) || "inbox";

  if (!refRow) {
    return {
      enriched: false,
      metadataFetched: false,
      skippedReason: "not_found",
      mode,
      summary: null,
      hookText: null,
      coverUrl: null,
      draftContentId: null,
      draftContentTitle: null,
    };
  }

  const metadata = await fetchSocialMetadata({
    url: input.url,
    platform: input.platformSlug,
    rawInputText: input.rawInput,
    urlHandle: input.urlHandle,
    externalId: input.externalId,
  });

  const metadataFetched = Boolean(
    metadata.title ||
      metadata.description ||
      metadata.sharedText ||
      metadata.authorHandle ||
      metadata.coverUrl
  );

  const shouldRunAi = Boolean(input.force || (settings.aiEnabled && settings.aiAutoEnrich));
  const google = getGoogleClient();

  let aiOutput: AgentAiOutput | null = null;
  let aiSkippedReason: string | undefined;

  if (!settings.aiEnabled) {
    aiSkippedReason = "ai_disabled";
  } else if (!shouldRunAi) {
    aiSkippedReason = "auto_enrich_disabled";
  } else if (!google) {
    aiSkippedReason = "missing_api_key";
  } else if (settings.aiDailyCap > 0 && settings.aiUsedToday >= settings.aiDailyCap) {
    aiSkippedReason = "daily_cap";
    await db
      .insert(aiUsage)
      .values({
        userId: input.userId,
        feature: mode === "auto_draft" ? "auto_draft" : "auto_enrich",
        provider: settings.aiProvider || "google",
        model: settings.aiTextModel || "gemini-flash-lite-latest",
        status: "blocked_cap",
        error: `Daily cap reached (${settings.aiUsedToday}/${settings.aiDailyCap})`,
      })
      .catch(() => {});
  } else {
    const [master, activeSeries] = await Promise.all([
      getMasterData(input.userId),
      db
        .select({
          id: series.id,
          slug: series.slug,
          name: series.name,
        })
        .from(series)
        .where(and(eq(series.userId, input.userId), eq(series.isActive, true)))
        .orderBy(desc(series.sortOrder), series.name),
    ]);

    const includeDraft = mode === "auto_draft" && refRow.contentId === null;

    const langInstruction =
      settings.aiOutputLanguage === "en"
        ? "Write all human-readable fields strictly in sharp, practical English acting as the user's personal Content Strategist Agent."
        : "Tulis semua field teks untuk creator MENGGUNAKAN BAHASA INDONESIA yang tajam, kasual, natural, dan aplikatif sebagai Agen Konten Pribadi user.";
    const personaPrompt = buildCreatorPersonaPrompt(settings);

    const allowedPillars = master.pillars.map((p) => `${p.slug} (${p.name})`).join(", ");
    const allowedHookTypes = master.hookTypes.map((h) => `${h.slug} (${h.name})`).join(", ");
    const allowedFormats = master.formats.map((f) => `${f.slug} (${f.name})`).join(", ");
    const allowedSeries = activeSeries.map((s) => `${s.slug} (${s.name})`).join(", ");

    const prompt = `You are the user's autonomous AI Content Agent for their personal Reference & Content Studio.
Analyze the newly saved social media reference below and populate structured metadata + creative strategy.
${personaPrompt ? `\n${personaPrompt}\n` : ""}
LANGUAGE & VOICE RULES:
- ${langInstruction}
- Ground your analysis in the extracted metadata below. If a platform blocked full scraping and metadata is sparse, NEVER fabricate unseen visuals; explicitly derive practical strategic angles from the available URL structure, handle, platform conventions, and shared text.
- Match slugs ONLY from the allowed lists below when applicable, otherwise return null/empty array.

INGESTED REFERENCE METADATA:
- URL: ${input.url}
- Platform: ${input.platformSlug}
- Metadata Provider: ${metadata.provider}
- Title / Caption: ${metadata.title || "(not available)"}
- Description: ${metadata.description || "(not available)"}
- User Shared Context Text: ${metadata.sharedText || "(none)"}
- Creator Handle Clue: ${metadata.authorHandle ? `@${metadata.authorHandle}` : "(unknown)"}
- Creator Display Name Clue: ${metadata.authorName || "(unknown)"}
- Audio Clue: ${metadata.audioTitle ? `${metadata.audioTitle}${metadata.audioArtist ? ` - ${metadata.audioArtist}` : ""}` : "(none)"}
- Extracted Hashtags: ${metadata.hashtags.length > 0 ? metadata.hashtags.join(", ") : "(none)"}

CONFIGURED TAXONOMY SLUGS (use exact slug values):
- pillars: ${allowedPillars || "(none)"}
- hookTypes: ${allowedHookTypes || "(none)"}
- formats: ${allowedFormats || "(none)"}
${includeDraft ? `- series: ${allowedSeries || "(none)"}` : ""}

${
  includeDraft
    ? `AUTO-DRAFT MODE ACTIVE:
Also generate \`contentDraft\` — adapt this inspiration into an ORIGINAL ready-to-shoot content piece tailored specifically to the Creator Persona above (do not copy verbatim; adapt angle, hook, script beats, visual cues, and caption).`
    : ""
}`;

    const start = Date.now();
    let usedModel = settings.aiTextModel || "gemini-flash-lite-latest";

    try {
      const result = await runWithModelFallback(async (model, modelName) => {
        usedModel = modelName;
        return await generateAgentPlan(model, prompt, includeDraft);
      }, settings.aiTextModel);

      aiOutput = result.output;
      const latencyMs = Date.now() - start;

      await db
        .insert(aiUsage)
        .values({
          userId: input.userId,
          feature: includeDraft ? "auto_draft" : "auto_enrich",
          provider: settings.aiProvider || "google",
          model: usedModel,
          status: "ok",
          inputTokens: result.inputTokens ?? null,
          outputTokens: result.outputTokens ?? null,
          latencyMs,
        })
        .catch(() => {});
    } catch (err) {
      const latencyMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes("429") || msg.toLowerCase().includes("quota");
      aiSkippedReason = isRateLimit ? "rate_limited" : "ai_error";

      await db
        .insert(aiUsage)
        .values({
          userId: input.userId,
          feature: includeDraft ? "auto_draft" : "auto_enrich",
          provider: settings.aiProvider || "google",
          model: usedModel,
          status: isRateLimit ? "rate_limited" : "error",
          latencyMs,
          error: msg.slice(0, 400),
        })
        .catch(() => {});
    }
  }

  // Persist scraped metadata + AI enrichments + optional Content draft in one atomic transaction
  const [master, activeSeries] = await Promise.all([
    getMasterData(input.userId),
    db
      .select({ id: series.id, slug: series.slug, name: series.name })
      .from(series)
      .where(and(eq(series.userId, input.userId), eq(series.isActive, true))),
  ]);

  const txResult = await withTx(async (tx) => {
    // 1. Source account upsert if missing on reference or forced
    let nextSourceAccountId = refRow.sourceAccountId;
    const candidateHandle = normalizeSocialHandle(
      aiOutput?.creatorHandle ?? metadata.authorHandle ?? input.urlHandle
    );

    if (candidateHandle && (!nextSourceAccountId || input.force)) {
      const [existingSource] = await tx
        .select({ id: sourceAccounts.id })
        .from(sourceAccounts)
        .where(
          and(
            eq(sourceAccounts.userId, input.userId),
            eq(sourceAccounts.platformId, refRow.platformId),
            eq(sourceAccounts.handle, candidateHandle)
          )
        )
        .limit(1);

      if (existingSource) {
        nextSourceAccountId = existingSource.id;
      } else {
        const [createdSource] = await tx
          .insert(sourceAccounts)
          .values({
            userId: input.userId,
            platformId: refRow.platformId,
            handle: candidateHandle,
          })
          .returning({ id: sourceAccounts.id });
        nextSourceAccountId = createdSource.id;
      }
    }

    // 2. Audio upsert when explicitly extracted from social metadata
    let nextAudioId = refRow.audioId;
    if (metadata.audioTitle && (!nextAudioId || input.force)) {
      const cleanTitle = metadata.audioTitle.trim().slice(0, 200);
      const cleanArtist = (metadata.audioArtist ?? "").trim().slice(0, 200);
      if (cleanTitle) {
        const [existingAudio] = await tx
          .select({ id: audios.id })
          .from(audios)
          .where(
            and(
              eq(audios.userId, input.userId),
              sql`lower(btrim(${audios.title})) = lower(btrim(${cleanTitle}))`,
              sql`lower(btrim(${audios.artist})) = lower(btrim(${cleanArtist}))`
            )
          )
          .limit(1);

        if (existingAudio) {
          nextAudioId = existingAudio.id;
        } else {
          const [createdAudio] = await tx
            .insert(audios)
            .values({
              userId: input.userId,
              title: cleanTitle,
              artist: cleanArtist,
            })
            .returning({ id: audios.id });
          nextAudioId = createdAudio.id;
        }
      }
    }

    // 3. Match format & hookType against master data
    const matchedFormatId =
      aiOutput?.formatSlug
        ? (master.formats.find((f) => f.slug === aiOutput.formatSlug)?.id ?? null)
        : null;
    const nextFormatId =
      (!refRow.formatId || input.force) && matchedFormatId
        ? matchedFormatId
        : refRow.formatId;

    const matchedHookTypeId = aiOutput?.hookTypeSlug
      ? (master.hookTypes.find((h) => h.slug === aiOutput.hookTypeSlug)?.id ??
        matchHookTypeId(aiOutput.hookTypeSlug, master.hookTypes))
      : null;
    const nextHookTypeId =
      (!refRow.hookTypeId || input.force) && matchedHookTypeId
        ? matchedHookTypeId
        : refRow.hookTypeId;

    // 4. Text fields & tags
    const fallbackSummary = buildFallbackSummary(metadata);
    const nextSummary =
      (!refRow.summary || input.force) && (aiOutput?.summary || fallbackSummary)
        ? (aiOutput?.summary ?? fallbackSummary)!.trim().slice(0, 1200)
        : refRow.summary;

    const nextHookText =
      (!refRow.hookText || input.force) && aiOutput?.hookText
        ? aiOutput.hookText.trim().slice(0, 400)
        : refRow.hookText;

    const nextVisualNotes =
      (!refRow.visualNotes || input.force) && aiOutput?.visualNotes
        ? aiOutput.visualNotes.trim().slice(0, 1500)
        : refRow.visualNotes;

    const combinedAgentNotes = aiOutput?.agentNotes
      ? aiOutput.agentNotes.trim()
      : metadata.sharedText && !refRow.notes
        ? metadata.sharedText
        : null;

    const nextNotes =
      (!refRow.notes || input.force) && combinedAgentNotes
        ? combinedAgentNotes.slice(0, 2000)
        : refRow.notes;

    const nextCoverUrl = metadata.coverUrl || refRow.coverUrl || null;

    const mergedTags = sanitizeTags(
      [...(refRow.tags || []), ...metadata.hashtags, ...(aiOutput?.tags || [])],
      30
    );

    // 5. Match pillars
    const matchedPillarIds =
      aiOutput?.pillarSlugs
        ?.map((slug) => master.pillars.find((p) => p.slug === slug)?.id)
        .filter((id): id is string => Boolean(id)) ?? [];

    const existingPillarRows = await tx
      .select({ pillarId: refPillars.pillarId })
      .from(refPillars)
      .where(eq(refPillars.refId, refRow.id));

    if (matchedPillarIds.length > 0 && (existingPillarRows.length === 0 || input.force)) {
      await tx.delete(refPillars).where(eq(refPillars.refId, refRow.id));
      const uniquePillarIds = Array.from(new Set(matchedPillarIds));
      await tx.insert(refPillars).values(
        uniquePillarIds.map((pillarId) => ({
          refId: refRow.id,
          pillarId,
        }))
      );
    }

    // 6. Elements (bedah badges)
    const validAiElements: RefElementType[] = Array.from(
      new Set(
        (aiOutput?.elements || []).filter((el): el is RefElementType =>
          (VALID_ELEMENTS as readonly string[]).includes(el)
        )
      )
    );
    const existingElements = await tx
      .select({ element: refElements.element })
      .from(refElements)
      .where(eq(refElements.refId, refRow.id));

    if (validAiElements.length > 0 && (existingElements.length === 0 || input.force)) {
      await tx.delete(refElements).where(eq(refElements.refId, refRow.id));
      await tx.insert(refElements).values(
        validAiElements.map((element) => ({
          refId: refRow.id,
          element,
        }))
      );
    }

    // 7. Auto-Draft Content or Status Transition
    let draftContentId: string | null = refRow.contentId ?? null;
    let draftContentTitle: string | null = null;
    let nextStatus = refRow.status;
    let nextContentId = refRow.contentId;
    let nextContentPosition = refRow.contentPosition;
    let touchStatusChanged = false;

    if (
      mode === "auto_draft" &&
      !refRow.contentId &&
      aiOutput?.contentDraft &&
      aiOutput.contentDraft.title.trim().length > 0
    ) {
      const draft = aiOutput.contentDraft;
      const draftTitle = draft.title.trim().slice(0, 200);
      const draftHook = (draft.hookText || nextHookText || "").trim().slice(0, 400);
      const matchedSeriesId = draft.seriesSlug
        ? (activeSeries.find((s) => s.slug === draft.seriesSlug)?.id ?? null)
        : null;

      const draftNotesParts = [
        draft.productionScript?.trim(),
        draft.captionDraft?.trim()
          ? `--- CAPTION DRAFT ---\n${draft.captionDraft.trim()}`
          : null,
      ].filter(Boolean);
      const draftNotes = draftNotesParts.join("\n\n") || null;
      const draftChangesNote = draft.changesNote?.trim() || null;

      const [createdContent] = await tx
        .insert(contents)
        .values({
          userId: input.userId,
          title: draftTitle,
          formatId: nextFormatId || null,
          seriesId: matchedSeriesId,
          audioId: nextAudioId || null,
          hookText: draftHook || null,
          hookTypeId: nextHookTypeId || null,
          notes: draftNotes,
          changesNote: draftChangesNote,
          tags: mergedTags,
          status: "production",
          searchText: buildSearchText([
            draftTitle,
            draftHook,
            draftNotes,
            draftChangesNote,
            ...mergedTags,
          ]),
        })
        .returning({ id: contents.id, title: contents.title });

      draftContentId = createdContent.id;
      draftContentTitle = createdContent.title;
      nextContentId = createdContent.id;
      nextContentPosition = 1;
      nextStatus = "production";
      touchStatusChanged = true;

      const finalPillarIds =
        matchedPillarIds.length > 0
          ? Array.from(new Set(matchedPillarIds))
          : existingPillarRows.map((p) => p.pillarId);

      if (finalPillarIds.length > 0) {
        const ownedPillars = await tx
          .select({ id: pillars.id })
          .from(pillars)
          .where(and(eq(pillars.userId, input.userId), inArray(pillars.id, finalPillarIds)));
        if (ownedPillars.length > 0) {
          await tx.insert(contentPillars).values(
            ownedPillars.map((p) => ({
              contentId: createdContent.id,
              pillarId: p.id,
            }))
          );
        }
      }

      const checklistSteps =
        settings.defaultChecklist && settings.defaultChecklist.length > 0
          ? settings.defaultChecklist
          : FALLBACK_CHECKLIST;

      await tx.insert(contentChecklist).values(
        checklistSteps.map((label, idx) => ({
          contentId: createdContent.id,
          label,
          isDone: false,
          position: idx + 1,
        }))
      );

      await recomputeContent(tx, createdContent.id);
    } else if (
      (mode === "selected" || mode === "auto_draft") &&
      !refRow.contentId &&
      refRow.status === "inbox" &&
      aiOutput
    ) {
      nextStatus = "selected";
      touchStatusChanged = true;
    }

    const searchText = buildSearchText([
      input.url,
      metadata.title,
      metadata.description,
      metadata.sharedText,
      candidateHandle,
      nextSummary,
      nextHookText,
      nextVisualNotes,
      nextNotes,
      ...mergedTags,
    ]);

    await tx
      .update(refs)
      .set({
        sourceAccountId: nextSourceAccountId,
        audioId: nextAudioId,
        formatId: nextFormatId,
        hookTypeId: nextHookTypeId,
        summary: nextSummary,
        hookText: nextHookText,
        visualNotes: nextVisualNotes,
        notes: nextNotes,
        coverUrl: nextCoverUrl,
        tags: mergedTags,
        status: nextStatus,
        contentId: nextContentId,
        contentPosition: nextContentPosition,
        searchText,
        ...(touchStatusChanged ? { statusChangedAt: sql`now()` } : {}),
        ...(aiOutput ? { bedahCompletedAt: sql`now()` } : {}),
      })
      .where(and(eq(refs.id, refRow.id), eq(refs.userId, input.userId)));

    await tx
      .insert(systemLogs)
      .values({
        userId: input.userId,
        kind: aiOutput ? "ai" : "ingest",
        level: "info",
        message: aiOutput
          ? draftContentTitle
            ? `AI Agent enriched ref & drafted "${draftContentTitle}" (${metadata.provider})`
            : `AI Agent enriched reference from ${input.platformSlug} (${metadata.provider})`
          : `Metadata extracted from ${input.platformSlug} (${metadata.provider}); AI skipped: ${aiSkippedReason || "disabled"}`,
      })
      .catch(() => {});

    return {
      summary: nextSummary,
      hookText: nextHookText,
      coverUrl: nextCoverUrl,
      draftContentId,
      draftContentTitle,
    };
  });

  return {
    enriched: Boolean(aiOutput),
    metadataFetched,
    skippedReason: aiSkippedReason,
    mode,
    summary: txResult.summary,
    hookText: txResult.hookText,
    coverUrl: txResult.coverUrl,
    draftContentId: txResult.draftContentId,
    draftContentTitle: txResult.draftContentTitle,
  };
}

/**
 * Re-runs or manually triggers AI Agent enrichment for an existing Reference owned by `userId`.
 */
export async function enrichReferenceById(params: {
  userId: string;
  refId: string;
  force?: boolean;
}): Promise<RunAiAgentResult> {
  const [row] = await db
    .select({
      id: refs.id,
      url: refs.url,
      urlOriginal: refs.urlOriginal,
      externalId: refs.externalId,
      platformSlug: platforms.slug,
    })
    .from(refs)
    .innerJoin(platforms, eq(refs.platformId, platforms.id))
    .where(and(eq(refs.id, params.refId), eq(refs.userId, params.userId)))
    .limit(1);

  if (!row) {
    return {
      enriched: false,
      metadataFetched: false,
      skippedReason: "not_found",
      mode: "inbox",
      summary: null,
      hookText: null,
      coverUrl: null,
      draftContentId: null,
      draftContentTitle: null,
    };
  }

  const normalized = await normalizeUrl(row.urlOriginal || row.url).catch(() => null);

  return runAiAgentForReference({
    userId: params.userId,
    refId: row.id,
    url: row.url,
    platformSlug: (normalized?.platform ?? (row.platformSlug as Platform) ?? "other") as Platform,
    rawInput: row.urlOriginal,
    urlHandle: normalized?.handle ?? null,
    externalId: row.externalId ?? normalized?.externalId ?? null,
    force: params.force ?? true,
  });
}

/**
 * Enriches up to `limit` Inbox items that do not have an AI summary or hook yet.
 */
export async function enrichInboxBatchForUser(
  userId: string,
  limit = 5
): Promise<{
  processedCount: number;
  enrichedCount: number;
  draftedCount: number;
}> {
  const candidates = await db
    .select({ id: refs.id })
    .from(refs)
    .where(
      and(
        eq(refs.userId, userId),
        eq(refs.status, "inbox"),
        isNull(refs.archivedAt),
        or(isNull(refs.summary), isNull(refs.hookText))
      )
    )
    .orderBy(asc(refs.createdAt))
    .limit(limit);

  let enrichedCount = 0;
  let draftedCount = 0;

  for (const item of candidates) {
    const res = await enrichReferenceById({
      userId,
      refId: item.id,
      force: true,
    }).catch(() => null);

    if (res?.enriched) enrichedCount++;
    if (res?.draftContentId) draftedCount++;
  }

  return {
    processedCount: candidates.length,
    enrichedCount,
    draftedCount,
  };
}

