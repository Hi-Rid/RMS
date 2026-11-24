import { getAppSettings } from "@/lib/queries/settings";
import { IngestTokenCard } from "@/app/(app)/settings/ingest-token-card";
import { Settings, Key, Database, Cpu } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const instant = false;

export default async function SettingsPage() {
  const settings = await getAppSettings();
  const hasToken = settings.hasToken;

  return (
    <div className="w-full max-w-4xl py-8 px-4 sm:px-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
          <Settings className="size-6 text-foreground" />
          <span>Settings</span>
        </h1>
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Ingest API, Shortcuts, Master Data & System Preferences
        </p>
      </div>

      <Tabs defaultValue="ingest" className="w-full space-y-6">
        <TabsList>
          <TabsTrigger value="ingest">
            <Key className="size-3.5 mr-1.5" />
            <span>Ingest & Shortcuts</span>
          </TabsTrigger>
          <TabsTrigger value="master">
            <Database className="size-3.5 mr-1.5" />
            <span>Master Data</span>
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Cpu className="size-3.5 mr-1.5" />
            <span>AI Configuration</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ingest" className="space-y-6 focus-visible:outline-none">
          <IngestTokenCard initialHasToken={hasToken} />
        </TabsContent>

        <TabsContent value="master" className="space-y-4 focus-visible:outline-none">
          <div className="p-8 text-center rounded-xl border bg-card text-muted-foreground space-y-2">
            <Database className="size-8 mx-auto text-muted-foreground/60" />
            <div className="text-sm font-semibold text-foreground">Master Data Management</div>
            <p className="text-xs max-w-md mx-auto">
              Configure pillars, hook types, formats, and series. Arrives in Phase 2 / Settings prompt.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4 focus-visible:outline-none">
          <div className="p-8 text-center rounded-xl border bg-card text-muted-foreground space-y-2">
            <Cpu className="size-8 mx-auto text-muted-foreground/60" />
            <div className="text-sm font-semibold text-foreground">AI Provider Integration</div>
            <p className="text-xs max-w-md mx-auto">
              Configure Gemini API, Groq, OpenRouter, and daily quotas. Arrives in Phase 3 / AI prompt.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
