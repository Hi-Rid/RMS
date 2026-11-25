import { connection } from "next/server";
import { getAppSettings, getMasterDataForSettings, getSystemLogs } from "@/lib/queries/settings";
import { env } from "@/lib/env";
import { SettingsClient } from "./settings-client";

export const instant = false;

interface SettingsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

const VALID_TABS = new Set(["general", "master", "ingest", "ai", "data"]);

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  await connection();
  const params = await searchParams;
  const initialTab = params.tab && VALID_TABS.has(params.tab) ? params.tab : "general";

  const [settings, masterData, logs] = await Promise.all([
    getAppSettings(),
    getMasterDataForSettings(),
    getSystemLogs(200),
  ]);

  const hasGeminiKey = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  );

  const appUrl = env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "http://localhost:3000";

  return (
    <SettingsClient
      initialSettings={settings}
      masterData={masterData as any}
      systemLogs={logs}
      hasGeminiKey={hasGeminiKey}
      appUrl={appUrl}
      initialTab={initialTab}
    />
  );
}
