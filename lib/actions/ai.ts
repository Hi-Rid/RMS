"use server";

import { z } from "zod";
import { generateText, Output } from "ai";
import { getGoogleClient, runWithModelFallback } from "@/lib/ai/client";
import { ok, fail, type ActionResult } from "@/lib/actions/result";
import { requireActionOwner } from "@/lib/auth/owner";

export interface BedahResult {
  hookText: string;
  hookType: string;
  visualNotes: string;
  keyTakeaway: string;
  adaptIdeas: string[];
  suggestedTags: string[];
}

const bedahSchema = z.object({
  text: z.string().min(1, "Text or URL description is required"),
  platform: z.string().optional(),
});

/**
 * AI Auto-Breakdown: Extracts hook, classification, visual notes, and original adaptation ideas.
 */
export async function aiBedahReference(
  input: z.infer<typeof bedahSchema>
): Promise<ActionResult<BedahResult>> {
  await requireActionOwner();

  const google = getGoogleClient();
  if (!google) {
    return fail(
      "ai_disabled",
      "Google Gemini API key is not configured. Please add your free key in .env.local (GOOGLE_GENERATIVE_AI_API_KEY) or in Settings."
    );
  }

  try {
    const output = await runWithModelFallback(async (model) => {
      const res = await generateText({
        model,
        output: Output.object({
          schema: z.object({
            hookText: z.string().describe("Opening 3-second hook that captures viewer attention"),
            hookType: z.string().describe("Hook archetype (e.g. Curiosity Gap, Bold Claim, Contrarian, Relatable Pain Point)"),
            visualNotes: z.string().describe("Visual styling, pacing, transition, or B-roll cues"),
            keyTakeaway: z.string().describe("Core psychological trigger why this content succeeded"),
            adaptIdeas: z.array(z.string()).min(3).max(4).describe("3 original adaptation ideas distinct from source"),
            suggestedTags: z.array(z.string()).min(2).max(5).describe("Relevant topic category tags"),
          }),
        }),
        prompt: `You are an expert short-form video content strategist and hook breakdown specialist (Reels, Shorts, TikTok).
Perform an in-depth breakdown of this reference content:
Platform: ${input.platform || "Social Media"}
Content/URL: "${input.text}"

Provide clear, sharp, actionable breakdown insights focused on original content creation.`,
      });

      return res.output;
    });

    return ok(output);
  } catch (err: unknown) {
    console.error("AI Bedah error:", err);
    return fail("ai_failed", "Failed to process AI breakdown. Please check your Gemini API key or quota.");
  }
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
  await requireActionOwner();

  const google = getGoogleClient();
  if (!google) {
    return fail(
      "ai_disabled",
      "Google Gemini API key is not configured. Please add your free key in .env.local (GOOGLE_GENERATIVE_AI_API_KEY)."
    );
  }

  try {
    const output = await runWithModelFallback(async (model) => {
      const res = await generateText({
        model,
        output: Output.object({
          schema: z.object({
            hooks: z.array(
              z.object({
                text: z.string().describe("Opening hook line, 1-2 punchy sentences (max 14 words)"),
                archetype: z.string().describe("Hook archetype: Curiosity, Contrarian, Negative, Relatable, Data/Result, Question"),
                whyItWorks: z.string().describe("Brief psychological reason why this stops the scroll"),
              })
            ).min(5).max(7),
          }),
        }),
        prompt: `Generate 6 high-conversion short-form video opening hooks that immediately stop the scroll.
Topic: "${input.topic}"
Content Pillar: "${input.pillar || "General"}"
Format: "${input.format || "Short-form Video"}"

Tone: Natural, confident, direct, and conversational.`,
      });

      return res.output;
    });

    return ok(output);
  } catch (err: unknown) {
    console.error("AI Generate Hooks error:", err);
    return fail("ai_failed", "Failed to generate hooks with AI.");
  }
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
  await requireActionOwner();

  const google = getGoogleClient();
  if (!google) {
    return fail(
      "ai_disabled",
      "Google Gemini API key is not configured. Please add your free key in .env.local."
    );
  }

  try {
    const output = await runWithModelFallback(async (model) => {
      const { text } = await generateText({
        model,
        prompt: `Create a 45-60 second high-retention short-form video production script:
Content Title: "${input.title}"
Opening Hook: "${input.hookText || "Craft the strongest opening hook"}"
Concept Notes: "${input.notes || "None"}"

Structure the script into 4 clear production blocks:
1. [00:00 - 00:03] THE HOOK: Punchy opening line + fast visual framing cue
2. [00:03 - 00:15] THE PROBLEM / TENSION: Why the viewer must care + the core obstacle
3. [00:15 - 00:45] THE INSIGHT / VALUE: Practical solution (2-3 crisp points) + B-roll visual directions
4. [00:45 - 00:60] THE PAYOFF & CTA: Sharp closing takeaway + call to action (comment/save)

Tone: Confident, fast-paced, high retention.`,
      });

      return { script: text };
    });

    return ok(output);
  } catch (err: unknown) {
    console.error("AI Draft Script error:", err);
    return fail("ai_failed", "Failed to draft script with AI.");
  }
}
