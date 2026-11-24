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
export const CANDIDATE_MODELS = [
  process.env.AI_TEXT_MODEL,
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-pro-latest",
].filter(Boolean) as string[];

export function getGeminiModel(modelName?: string) {
  const google = getGoogleClient();
  if (!google) return null;
  return google(modelName || CANDIDATE_MODELS[0]);
}

/**
 * Runs an AI operation with automatic model fallback in case of high demand (503) or unavailability (404).
 */
export async function runWithModelFallback<T>(
  fn: (model: ReturnType<NonNullable<ReturnType<typeof getGoogleClient>>>) => Promise<T>
): Promise<T> {
  const google = getGoogleClient();
  if (!google) {
    throw new Error("Google Gemini API client is not configured.");
  }

  let lastError: unknown;
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = google(modelName);
      return await fn(model);
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${modelName} returned error, attempting fallback:`, err?.message || err);
      continue;
    }
  }

  throw lastError;
}
