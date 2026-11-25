import { connection } from "next/server";
import { getInsightData } from "@/lib/queries/insight";
import { getAppSettings } from "@/lib/queries/settings";
import { InsightClient } from "./insight-client";

export const instant = false;

export default async function InsightPage() {
  await connection();
  const [data, settings] = await Promise.all([getInsightData(), getAppSettings()]);
  const hasGeminiKey = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      settings.hasPersonalAiKey
  );

  return <InsightClient initialData={data} hasGeminiKey={hasGeminiKey} />;
}
