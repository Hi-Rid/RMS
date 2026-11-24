import { connection } from "next/server";
import { getInsightData } from "@/lib/queries/insight";
import { InsightClient } from "./insight-client";

export const instant = false;

export default async function InsightPage() {
  await connection();
  const data = await getInsightData();
  const hasGeminiKey = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  );

  return <InsightClient initialData={data} hasGeminiKey={hasGeminiKey} />;
}
