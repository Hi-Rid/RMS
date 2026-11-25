"use server";

import { z } from "zod";
import { generateText, Output } from "ai";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiUsage, refs } from "@/db/schema";
import { buildCreatorPersonaPrompt } from "@/lib/ai/agent";
import { getGoogleClient, runWithModelFallback } from "@/lib/ai/client";
import { resolveAndMirrorThumbnail } from "@/lib/storage/thumbnails";
import { getAppSettings, getUserAiKeyEncrypted } from "@/lib/queries/settings";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";

type AiFeature = "bedah" | "hooks" | "script" | "insight" | "caption";

async function executeWithAiGuard<T>(
  feature: AiFeature,
  runner: (ctx: {
    userId: string;
    model: ReturnType<NonNullable<ReturnType<typeof getGoogleClient>>>;
    langInstruction: string;
  }) => Promise<{ data: T; inputTokens?: number; outputTokens?: number }>
): Promise<ActionResult<T>> {
  const user = await requireActionOwner();

  const settings = await getAppSettings(user.id);
  if (!settings.aiEnabled) {
    return fail(
      "ai_disabled",
      "AI features are turned off. Enable them in Settings -> AI Automation."
    );
  }

  const personalKeyEnc = await getUserAiKeyEncrypted(user.id);
  const google = getGoogleClient(personalKeyEnc);
  if (!google) {
    return fail(
      "ai_disabled",
      "AI Engine is not configured yet. Add a Personal AI API Key in Settings or check your environment configuration."
    );
  }

  if (settings.aiDailyCap > 0 && settings.aiUsedToday >= settings.aiDailyCap) {
    await db
      .insert(aiUsage)
      .values({
        userId: user.id,
        feature,
        provider: settings.aiProvider || "google",
        model: settings.aiTextModel || "gemini-flash-lite-latest",
        status: "blocked_cap",
        error: `Daily cap reached (${settings.aiUsedToday}/${settings.aiDailyCap})`,
      })
      .catch(() => {});

    return fail(
      "ai_cap_reached",
      `Daily AI limit reached (${settings.aiUsedToday}/${settings.aiDailyCap}). Increase cap in Settings.`
    );
  }

  const baseInstruction =
    settings.aiOutputLanguage === "en"
      ? "Write the ENTIRE output strictly in natural, sharp English acting as the user's personal Content Strategist & Creative Agent."
      : "Tulis SELURUH output MENGGUNAKAN BAHASA INDONESIA yang kasual, tajam, dan aplikatif sebagai Agen Konten Pribadi user.";
  const personaPrompt = buildCreatorPersonaPrompt(settings);
  const langInstruction = personaPrompt
    ? `${baseInstruction}\n\n${personaPrompt}`
    : baseInstruction;

  const start = Date.now();
  let usedModel = settings.aiTextModel || "gemini-flash-lite-latest";

  try {
    const result = await runWithModelFallback(
      async (model, modelName) => {
        usedModel = modelName;
        return await runner({ userId: user.id, model, langInstruction });
      },
      settings.aiTextModel,
      personalKeyEnc
    );

    const latencyMs = Date.now() - start;
    await db
      .insert(aiUsage)
      .values({
        userId: user.id,
        feature,
        provider: settings.aiProvider || "google",
        model: usedModel,
        status: "ok",
        inputTokens: result.inputTokens ?? null,
        outputTokens: result.outputTokens ?? null,
        latencyMs,
      })
      .catch(() => {});

    return ok(result.data);
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit = msg.includes("429") || msg.toLowerCase().includes("quota");

    await db
      .insert(aiUsage)
      .values({
        userId: user.id,
        feature,
        provider: settings.aiProvider || "google",
        model: usedModel,
        status: isRateLimit ? "rate_limited" : "error",
        latencyMs,
        error: msg.slice(0, 400),
      })
      .catch(() => {});

    console.error(`AI ${feature} error:`, err);
    return fail(
      isRateLimit ? "rate_limited" : "ai_failed",
      isRateLimit
        ? "AI engine rate limit hit. Please try again in a moment."
        : "Failed to process AI request. Please check your AI quota or try again."
    );
  }
}

export interface BedahResult {
  hookText: string;
  hookType: string;
  visualNotes: string;
  keyTakeaway: string;
  adaptIdeas: string[];
  suggestedTags: string[];
}

const bedahSchema = z.object({
  refId: z.string().uuid().optional(),
  text: z.string().min(1, "Text or URL description is required"),
  platform: z.string().optional(),
});

/**
 * AI Auto-Breakdown: Extracts hook, classification, visual notes, and original adaptation ideas.
 */
export async function aiBedahReference(
  input: z.infer<typeof bedahSchema>
): Promise<ActionResult<BedahResult>> {
  const parsed = bedahSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  return executeWithAiGuard("bedah", async ({ userId, model, langInstruction }) => {
    let imagePart: { type: "file"; data: Uint8Array; mediaType: string } | null = null;
    if (parsed.data.refId) {
      const [refRow] = await db
        .select({ id: refs.id, coverUrl: refs.coverUrl })
        .from(refs)
        .where(and(eq(refs.id, parsed.data.refId), eq(refs.userId, userId)))
        .limit(1);

      if (refRow?.coverUrl) {
        const thumb = await resolveAndMirrorThumbnail({
          userId,
          refId: refRow.id,
          sourceUrl: refRow.coverUrl,
        });
        if (thumb.imageBuffer && thumb.mimeType) {
          imagePart = {
            type: "file",
            data: thumb.imageBuffer,
            mediaType: thumb.mimeType,
          };
        }
      }
    }

    const breakdownPrompt = `You are an expert short-form video content strategist and hook breakdown specialist (Reels, Shorts, TikTok).
Perform a factual, grounded breakdown of this reference content:
Platform: ${parsed.data.platform || "Social Media"}
Content/Context: "${parsed.data.text}"

RULES:
- NEVER write generic clickbait like "Hal yang tidak disangka-sangka..." or fluffy filler like "komposisi yang bersih memanjakan mata".
- Describe concrete opening framing, camera transitions, props, subject/wardrobe details, and psychological retention mechanics.
- Provide 3 distinct, actionable adaptation ideas and specific searchable tags (no platform names like instagram/reel/video).
- ${langInstruction}`;

    const schema = z.object({
      hookText: z.string().describe("Concrete 3-second opening hook (spoken/text or factual [Visual Hook] framing)"),
      hookType: z
        .string()
        .describe("Hook archetype (e.g. POV, Curiosity gap, Bold statement, Reveal / transformation)"),
      visualNotes: z.string().describe("Shot-by-shot visual styling, framing, camera motion, pacing, or B-roll cues"),
      keyTakeaway: z.string().describe("Concrete reason this structure retains viewers + how to replicate it"),
      adaptIdeas: z
        .array(z.string())
        .min(3)
        .max(4)
        .describe("3 original adaptation ideas distinct from the source"),
      suggestedTags: z.array(z.string()).min(3).max(6).describe("Specific searchable topic/camera/style tags"),
    });

    const res = imagePart
      ? await generateText({
          model,
          output: Output.object({ schema }),
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: breakdownPrompt }, imagePart],
            },
          ],
        })
      : await generateText({
          model,
          output: Output.object({ schema }),
          prompt: breakdownPrompt,
        });

    return {
      data: res.output,
      inputTokens: res.usage?.inputTokens,
      outputTokens: res.usage?.outputTokens,
    };
  });
}

const hooksSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  pillar: z.string().optional(),
  format: z.string().optional(),
});

export interface GeneratedHook {
  text: string;
  archetype: string;
  whyItWorks: string;
}

/**
 * Generates 6 high-conversion viral hooks based on topic and pillar.
 */
export async function aiGenerateHooks(
  input: z.infer<typeof hooksSchema>
): Promise<ActionResult<{ hooks: GeneratedHook[] }>> {
  const parsed = hooksSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  return executeWithAiGuard("hooks", async ({ model, langInstruction }) => {
    const res = await generateText({
      model,
      output: Output.object({
        schema: z.object({
          hooks: z
            .array(
              z.object({
                text: z.string().describe("Punchy opening hook (1-2 sentences, max 14 words)"),
                archetype: z.string().describe("Hook angle (Curiosity, Contrarian, Mistake, Relatable, Question)"),
                whyItWorks: z.string().describe("Brief psychological trigger explaining why this stops the scroll"),
              })
            )
            .min(5)
            .max(7),
        }),
      }),
      prompt: `Generate 6 scroll-stopping opening hooks for short-form video (Reels, TikTok, Shorts).
Topic: "${parsed.data.topic}"
Content Pillar: "${parsed.data.pillar || "General"}"
Format: "${parsed.data.format || "Short-form Video"}"

${langInstruction}`,
    });

    return {
      data: res.output,
      inputTokens: res.usage?.inputTokens,
      outputTokens: res.usage?.outputTokens,
    };
  });
}

const scriptSchema = z.object({
  title: z.string().min(1, "Title is required"),
  hookText: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Drafts an end-to-end production script with visual cues.
 */
export async function aiDraftScript(
  input: z.infer<typeof scriptSchema>
): Promise<ActionResult<{ script: string }>> {
  const parsed = scriptSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  return executeWithAiGuard("script", async ({ model, langInstruction }) => {
    const res = await generateText({
      model,
      prompt: `Create a high-retention 45-60 second short-form video production script for a solo creator:
Title: "${parsed.data.title}"
Opening Hook: "${parsed.data.hookText || "Craft the strongest opening hook"}"
Concept Notes: "${parsed.data.notes || "None"}"

${langInstruction}
Structure the script into 4 clear production blocks:
1. [00:00 - 00:03] THE HOOK: Punchy opening line + fast visual framing cue
2. [00:03 - 00:15] THE PROBLEM / TENSION: Core viewer tension + why it matters
3. [00:15 - 00:45] THE INSIGHT / VALUE: 2-3 practical points + B-roll visual directions
4. [00:45 - 00:60] THE PAYOFF & CTA: Sharp closing takeaway + save/comment call to action`,
    });

    return {
      data: { script: res.text },
      inputTokens: res.usage?.inputTokens,
      outputTokens: res.usage?.outputTokens,
    };
  });
}

const explainPatternSchema = z.object({
  group: z.enum(["high", "low", "all"]).default("high"),
  items: z
    .array(
      z.object({
        title: z.string(),
        finalRating: z.number().nullable().optional(),
        formatName: z.string().nullable().optional(),
        hookTypeName: z.string().nullable().optional(),
      })
    )
    .min(1, "At least one content item is required"),
});

export interface ExplainPatternResult {
  summary: string;
  keyObservations: string[];
  caveats: string;
}

/**
 * AI-09: Explain outlier performance patterns without making causal claims.
 */
export async function aiExplainPattern(
  input: z.infer<typeof explainPatternSchema>
): Promise<ActionResult<ExplainPatternResult>> {
  const parsed = explainPatternSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  return executeWithAiGuard("insight", async ({ model, langInstruction }) => {
    const res = await generateText({
      model,
      output: Output.object({
        schema: z.object({
          summary: z.string().describe("Concise 1-2 sentence pattern summary across the outlier contents"),
          keyObservations: z
            .array(z.string())
            .min(2)
            .max(4)
            .describe("Observable commonalities in hook types, formats, or themes"),
          caveats: z.string().describe("Sample size and correlation vs causation caveat note"),
        }),
      }),
      prompt: `Analyze these short-form content outliers (${
        parsed.data.group === "high" ? "top performers" : "underperformers"
      }):
${JSON.stringify(parsed.data.items, null, 2)}

Rules:
1. ${langInstruction}
2. Do NOT make definitive causal claims (use observed correlation phrasing, never claim X caused Y).
3. Highlight patterns in hook type, format, or presentation style.
4. Explicitly state sample size limitations.`,
    });

    return {
      data: res.output,
      inputTokens: res.usage?.inputTokens,
      outputTokens: res.usage?.outputTokens,
    };
  });
}

const generateCaptionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  hookText: z.string().optional(),
  notes: z.string().optional(),
  platform: z.string().optional(),
});

/**
 * Generates a platform-ready social caption and relevant hashtags for a piece of content.
 */
export async function aiGenerateCaption(
  input: z.infer<typeof generateCaptionSchema>
): Promise<ActionResult<{ caption: string }>> {
  const parsed = generateCaptionSchema.safeParse(input);
  if (!parsed.success) {
    return fail("validation", parsed.error.issues[0]?.message || "Invalid input");
  }

  return executeWithAiGuard("caption", async ({ model, langInstruction }) => {
    const res = await generateText({
      model,
      prompt: `Write an engaging, concise short-form video caption tailored for ${parsed.data.platform || "Instagram Reels / TikTok"}.
Title: "${parsed.data.title}"
Opening Hook: "${parsed.data.hookText || "None"}"
Notes / Context: "${parsed.data.notes || "None"}"

${langInstruction}
Format cleanly with:
1. A punchy 1-2 line opener complementing the video hook (do not repeat the exact spoken hook word-for-word if avoidable).
2. A short actionable takeaway or conversation prompt CTA (save / comment).
3. One blank line followed by 4-6 relevant, clean niche hashtags (no spammy generic tags).
Return only the ready-to-paste caption text without markdown fences or preamble.`,
    });

    return {
      data: { caption: res.text.trim() },
      inputTokens: res.usage?.inputTokens,
      outputTokens: res.usage?.outputTokens,
    };
  });
}
