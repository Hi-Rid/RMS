"use server";

import { z } from "zod";
import { generateObject, generateText } from "ai";
import { getGeminiModel } from "@/lib/ai/client";
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
 * AI Auto-Bedah: Extracts hook, classification, visual notes, and original adaptation ideas.
 */
export async function aiBedahReference(
  input: z.infer<typeof bedahSchema>
): Promise<ActionResult<BedahResult>> {
  await requireActionOwner();

  const model = getGeminiModel();
  if (!model) {
    return fail(
      "ai_disabled",
      "Google Gemini API key belum terpasang. Masukkan API key gratis Anda di .env.local (GOOGLE_GENERATIVE_AI_API_KEY) atau di Settings."
    );
  }

  try {
    const { object } = await generateObject({
      model,
      schema: z.object({
        hookText: z.string().describe("Kalimat hook 3 detik pertama yang memikat audiens"),
        hookType: z.string().describe("Tipe hook (misal: Curiosity Gap, Negative Hook, Bold Claim, Relatable Pain Point)"),
        visualNotes: z.string().describe("Catatan gaya visual, ritme potongan, transisi, atau b-roll"),
        keyTakeaway: z.string().describe("Pemicu psikologis utama kenapa video ini berhasil"),
        adaptIdeas: z.array(z.string()).min(3).max(4).describe("3 ide adaptasi orisinal yang berbeda dari sumber agar tidak plagiasi"),
        suggestedTags: z.array(z.string()).min(2).max(5).describe("Tag kategori yang relevan"),
      }),
      prompt: `Anda adalah pakar bedah konten video viral (Shorts, Reels, TikTok) berbahasa Indonesia.
Lakukan analisis dan bedah mendalam terhadap konten referensi ini:
Platform: ${input.platform || "Social Media"}
Konten/URL: "${input.text}"

Berikan keluaran dalam bahasa Indonesia dengan nada kreatif, lugas, dan berfokus pada eksekusi konten orisinal.`,
    });

    return ok(object);
  } catch (err: unknown) {
    console.error("AI Bedah error:", err);
    return fail("ai_failed", "Gagal memproses bedah AI. Periksa kembali kuota atau API key Gemini Anda.");
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

  const model = getGeminiModel();
  if (!model) {
    return fail(
      "ai_disabled",
      "Google Gemini API key belum terpasang. Masukkan API key gratis Anda di .env.local (GOOGLE_GENERATIVE_AI_API_KEY)."
    );
  }

  try {
    const { object } = await generateObject({
      model,
      schema: z.object({
        hooks: z.array(
          z.object({
            text: z.string().describe("Kalimat hook pembuka 1-2 kalimat (max 12 kata)"),
            archetype: z.string().describe("Jenis hook: Curiosity, Contrarian, Negative, Challenge, Relatable, dsb"),
            whyItWorks: z.string().describe("Alasan psikologis singkat kenapa hook ini menghentikan scroll"),
          })
        ).min(5).max(7),
      }),
      prompt: `Hasilkan 6 variasi hook pembuka video pendek (Reels/TikTok) yang mematikan dan membuat penonton berhenti scrolling.
Topik: "${input.topic}"
Pilar Konten: "${input.pillar || "General"}"
Format: "${input.format || "Short-form Video"}"

Bahasa: Bahasa Indonesia kasual yang natural, tidak kaku, dan langsung to-the-point.`,
    });

    return ok(object);
  } catch (err: unknown) {
    console.error("AI Generate Hooks error:", err);
    return fail("ai_failed", "Gagal menghasilkan hook dengan AI.");
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

  const model = getGeminiModel();
  if (!model) {
    return fail(
      "ai_disabled",
      "Google Gemini API key belum terpasang. Masukkan API key gratis Anda di .env.local."
    );
  }

  try {
    const { text } = await generateText({
      model,
      prompt: `Buat naskah video pendek berdurasi 45-60 detik dengan struktur retensi tinggi:
Judul Konten: "${input.title}"
Hook Pembuka: "${input.hookText || "Tentukan hook terbaik"}"
Catatan Konsep: "${input.notes || "Tidak ada catatan tambahan"}"

Format naskah harus terbagi rapi ke dalam 4 bagian:
1. [00:00 - 00:03] THE HOOK: Kalimat pembuka + visual framing cepat
2. [00:03 - 00:15] THE PROBLEM / TENSION: Kenapa audiens harus peduli + masalah yang dihadapi
3. [00:15 - 00:45] THE INSIGHT / VALUE: Solusi nyata (2-3 poin praktis) + petunjuk B-Roll visual
4. [00:45 - 00:60] THE PAYOFF & CTA: Kesimpulan tajam + ajakan bertindak (komen/save)

Gunakan bahasa Indonesia kasual, modern, dan percaya diri seperti kreator top.`,
    });

    return ok({ script: text });
  } catch (err: unknown) {
    console.error("AI Draft Script error:", err);
    return fail("ai_failed", "Gagal menyusun naskah dengan AI.");
  }
}
