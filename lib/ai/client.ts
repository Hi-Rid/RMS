import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function getGoogleClient() {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    "";

  if (!apiKey || apiKey.trim() === "" || apiKey.includes("your-")) {
    return null;
  }

  return createGoogleGenerativeAI({
    apiKey: apiKey.trim(),
  });
}

// Resilient priority order of models available in Google AI Studio
export const DEFAULT_CANDIDATE_MODELS = [
  process.env.AI_TEXT_MODEL,
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-pro-latest",
].filter(Boolean) as string[];

export function buildCandidateModels(preferredModel?: string | null): string[] {
  const list = [
    preferredModel?.trim(),
    ...DEFAULT_CANDIDATE_MODELS,
  ].filter(Boolean) as string[];
  return Array.from(new Set(list));
}

export function getGeminiModel(modelName?: string) {
  const google = getGoogleClient();
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
  preferredModel?: string | null
): Promise<T> {
  const google = getGoogleClient();
  if (!google) {
    throw new Error("Google Gemini API client is not configured.");
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
