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

export function getGeminiModel() {
  const google = getGoogleClient();
  if (!google) return null;

  // Use configured model or robust default
  const modelName = process.env.AI_TEXT_MODEL || "gemini-2.5-flash";
  return google(modelName);
}
