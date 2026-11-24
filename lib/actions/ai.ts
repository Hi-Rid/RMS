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
            hookText: z.string().describe("Kalimat hook 3 detik pertama yang memikat audiens dalam Bahasa Indonesia"),
            hookType: z.string().describe("Tipe hook psikologis (misal: Curiosity Gap, Masalah Relate, Klaim Berani, Kontrarian)"),
            visualNotes: z.string().describe("Catatan visual styling, framing, transisi, pacing, atau B-roll dalam Bahasa Indonesia"),
            keyTakeaway: z.string().describe("Pelajaran inti mengapa konten ini berhasil memikat penonton dalam Bahasa Indonesia"),
            adaptIdeas: z.array(z.string()).min(3).max(4).describe("3 ide adaptasi original yang berbeda dari sumber dalam Bahasa Indonesia"),
            suggestedTags: z.array(z.string()).min(2).max(5).describe("Tag kategori topik yang relevan dalam Bahasa Indonesia"),
          }),
        }),
        prompt: `You are an expert short-form video content strategist and hook breakdown specialist (Reels, Shorts, TikTok).
Perform an in-depth breakdown of this reference content:
Platform: ${input.platform || "Social Media"}
Content/URL: "${input.text}"

WAJIB DIPATUHI:
Tulis SELURUH hasil bedah (hookText, hookType, visualNotes, keyTakeaway, adaptIdeas, suggestedTags) MENGGUNAKAN BAHASA INDONESIA yang kasual, tajam, dan aplikatif untuk content creator solo.
Berikan analisis yang fokus pada orisinalitas dan cara mengadaptasi ide tersebut tanpa menjiplak.`,
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
                text: z.string().describe("Kalimat hook pembuka 1-2 kalimat tajam (maksimal 14 kata) dalam Bahasa Indonesia"),
                archetype: z.string().describe("Sudut pandang hook: Rasa Ingin Tahu, Kontrarian, Masalah Relate, Pertanyaan, dsb."),
                whyItWorks: z.string().describe("Alasan psikologis mengapa hook ini langsung menghentikan scroll dalam Bahasa Indonesia"),
              })
            ).min(5).max(7),
          }),
        }),
        prompt: `Buat 6 variasi hook pembuka video pendek (Reels, TikTok, Shorts) yang langsung menghentikan scroll penonton.
Topik: "${input.topic}"
Pilar Konten: "${input.pillar || "General"}"
Format: "${input.format || "Short-form Video"}"

WAJIB DIPATUHI:
Tulis seluruh hook dan alasan psikologisnya dalam BAHASA INDONESIA yang kasual, percaya diri, dan alami untuk creator.`,
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
        prompt: `Buat naskah produksi video pendek (45-60 detik) berdurasi tinggi dan ber-retensi kuat untuk content creator solo:
Judul Konten: "${input.title}"
Kalimat Hook Pembuka: "${input.hookText || "Rancang hook pembuka paling memikat"}"
Catatan Konsep: "${input.notes || "None"}"

WAJIB DIPATUHI: Tulis naskah dalam BAHASA INDONESIA yang kasual, percaya diri, dan cepat.
Bagi naskah menjadi 4 blok produksi yang jelas:
1. [00:00 - 00:03] THE HOOK: Kalimat hook pembuka yang punchy + arahan visual framing cepat
2. [00:03 - 00:15] THE PROBLEM / TENSION: Masalah inti penonton + mengapa harus peduli
3. [00:15 - 00:45] THE INSIGHT / VALUE: Solusi praktis (2-3 poin tajam) + arahan visual B-roll / aksi
4. [00:45 - 00:60] THE PAYOFF & CTA: Takeaway penutup tajam + ajakan interaksi (komen/save)`,
      });

      return { script: text };
    });

    return ok(output);
  } catch (err: unknown) {
    console.error("AI Draft Script error:", err);
    return fail("ai_failed", "Failed to draft script with AI.");
  }
}

const explainPatternSchema = z.object({
  group: z.enum(["high", "low", "all"]).default("high"),
  items: z.array(
    z.object({
      title: z.string(),
      finalRating: z.number().nullable().optional(),
      formatName: z.string().nullable().optional(),
      hookTypeName: z.string().nullable().optional(),
    })
  ).min(1, "At least one content item is required"),
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
      const res = await generateText({
        model,
        output: Output.object({
          schema: z.object({
            summary: z.string().describe("Concise 1-2 sentence pattern summary across the outlier contents"),
            keyObservations: z
              .array(z.string())
              .min(2)
              .max(4)
              .describe("Bullet points of observable commonalities in hook types, formats, or themes"),
            caveats: z
              .string()
              .describe("Sample size and correlation vs causation caveat note"),
          }),
        }),
        prompt: `Anda adalah analis strategi konten video pendek yang menganalisis kelompok outlier (${input.group === "high" ? "top performers" : "underperformers"}).
Daftar konten:
${JSON.stringify(input.items, null, 2)}

Aturan:
1. Tulis seluruh analisis dalam BAHASA INDONESIA yang lugas, tajam, dan objektif.
2. JANGAN membuat klaim kausal mutlak (gunakan istilah seperti 'cenderung memiliki' atau 'korelasi teramati', bukan 'menyebabkan').
3. Soroti kesamaan pola pada arketipe hook, format, atau gaya penyampaian.
4. Sebutkan keterbatasan ukuran sampel secara eksplisit.`,
      });

      return res.output;
    });

    return ok(output);
  } catch (err: unknown) {
    console.error("AI Explain Pattern error:", err);
    return fail("ai_failed", "Failed to analyze outlier patterns with AI.");
  }
}

