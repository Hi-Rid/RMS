import { Settings } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings & Master Data"
      description="Configure pillars, series, hook types, platforms, ingest tokens, and AI integration."
      phase="Prompt P9"
      icon={<Settings className="size-6" />}
    />
  );
}
