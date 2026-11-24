import { connection } from "next/server";
import { getAppSettings, getMasterDataForSettings, getSystemLogs } from "@/lib/queries/settings";
import { SettingsClient } from "./settings-client";

export const instant = false;

export default async function SettingsPage() {
  await connection();
  const [settings, masterData, logs] = await Promise.all([
    getAppSettings(),
    getMasterDataForSettings(),
    getSystemLogs(200),
  ]);

  const hasGeminiKey = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  );

  return (
    <SettingsClient
      initialSettings={settings}
      masterData={masterData as any}
      systemLogs={logs}
      hasGeminiKey={hasGeminiKey}
    />
  );
}
