import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { decryptSecret } from "@/lib/crypto";

function resolveApiKey(customEncryptedKey?: string | null): string | null {
  if (customEncryptedKey) {
    const decrypted = decryptSecret(customEncryptedKey);
    if (decrypted && decrypted.trim() && !decrypted.includes("your-")) {
      return decrypted.trim();
    }
  }

  const serverKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    "";

  if (!serverKey || serverKey.trim() === "" || serverKey.includes("your-")) {
    return null;
  }

  return serverKey.trim();
}

export function getGoogleClient(customEncryptedKey?: string | null) {
  const apiKey = resolveApiKey(customEncryptedKey);
  if (!apiKey) return null;

  return createGoogleGenerativeAI({
    apiKey,
  });
}

// Resilient priority order of models available in AI Engine
export const DEFAULT_CANDIDATE_MODELS = [
  process.env.AI_TEXT_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-flash-lite-latest",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
].filter(Boolean) as string[];

export function buildCandidateModels(preferredModel?: string | null): string[] {
  const list = [
    preferredModel?.trim(),
    ...DEFAULT_CANDIDATE_MODELS,
  ].filter(Boolean) as string[];
  return Array.from(new Set(list));
}

export function getGeminiModel(modelName?: string, customEncryptedKey?: string | null) {
  const google = getGoogleClient(customEncryptedKey);
  if (!google) return null;
  return google(modelName || DEFAULT_CANDIDATE_MODELS[0]);
}

/**
 * Runs an AI operation with automatic model fallback in case of high demand (503) or unavailability (404).
 */
export async function runWithModelFallback<T>(
  fn: (
    model: ReturnType<NonNullable<ReturnType<typeof getGoogleClient>>>,
    modelName: string
  ) => Promise<T>,
  preferredModel?: string | null,
  customEncryptedKey?: string | null
): Promise<T> {
  const google = getGoogleClient(customEncryptedKey);
  if (!google) {
    throw new Error("AI Engine client is not configured.");
  }

  const candidates = buildCandidateModels(preferredModel);
  let lastError: unknown;
  for (const modelName of candidates) {
    try {
      const model = google(modelName);
      return await fn(model, modelName);
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Model ${modelName} returned error, attempting fallback:`, msg);
      continue;
    }
  }

  throw lastError;
}
