"use client";

import { useState } from "react";
import {
  Settings,
  Key,
  Database,
  Cpu,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Download,
  Terminal,
  Clock,
  Layers,
  Bookmark,
  BarChart2,
  Hash,
  Globe,
  Plus,
  Trash2,
  Loader2,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { IngestTokenCard } from "./ingest-token-card";
import {
  updateGeneralSettings,
  updateAiSettings,
  testAiConnection,
  toggleMasterItem,
  createMasterItem,
  type MasterTableType,
} from "@/lib/actions/settings";
import type { AppSettingsQuery } from "@/lib/queries/settings";

interface MasterItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
}

interface MasterDataPayload {
  pillars: MasterItem[];
  series: MasterItem[];
  formats: (MasterItem & { hasCheckpoints?: boolean })[];
  hookTypes: MasterItem[];
  platforms: (MasterItem & { domains?: string[]; isSource?: boolean; isTarget?: boolean })[];
}

interface SystemLogItem {
  id: number;
  kind: string;
  level: string;
  message: string;
  meta: any;
  createdAt: string;
}

interface SettingsClientProps {
  initialSettings: AppSettingsQuery;
  masterData: MasterDataPayload;
  systemLogs: SystemLogItem[];
  hasGeminiKey: boolean;
}

export function SettingsClient({
  initialSettings,
  masterData,
  systemLogs,
  hasGeminiKey,
}: SettingsClientProps) {
  // General tab state
  const [weeklyTarget, setWeeklyTarget] = useState(initialSettings.weeklyPostTarget);
  const [insightMinSample, setInsightMinSample] = useState(initialSettings.insightMinSample);
  const [checklist, setChecklist] = useState<string[]>(initialSettings.defaultChecklist);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [savingGeneral, setSavingGeneral] = useState(false);

  // AI tab state
  const [aiEnabled, setAiEnabled] = useState(initialSettings.aiEnabled);
  const [aiProvider, setAiProvider] = useState(initialSettings.aiProvider);
  const [aiTextModel, setAiTextModel] = useState(initialSettings.aiTextModel || "");
  const [aiDailyCap, setAiDailyCap] = useState(initialSettings.aiDailyCap);
  const [aiLanguage, setAiLanguage] = useState<"id" | "en">(
    (initialSettings.aiOutputLanguage as "id" | "en") || "id"
  );
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingAi, setSavingAi] = useState(false);

  // Master data state
  const [master, setMaster] = useState(masterData);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [activeMasterType, setActiveMasterType] = useState<MasterTableType>("pillars");
  const [newItemName, setNewItemName] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Logs state
  const [logFilterKind, setLogFilterKind] = useState("all");
  const [logFilterLevel, setLogFilterLevel] = useState("all");

  // Save General
  async function handleSaveGeneral() {
    setSavingGeneral(true);
    try {
      const res = await updateGeneralSettings({
        weeklyPostTarget: weeklyTarget,
        insightMinSample,
        defaultChecklist: checklist,
      });
      if (res.ok) {
        toast.success("General settings saved successfully.");
      } else {
        toast.error(res.error.message || "Failed to save settings.");
      }
    } catch {
      toast.error("Network error saving general settings.");
    } finally {
      setSavingGeneral(false);
    }
  }

  // Save AI
  async function handleSaveAi() {
    setSavingAi(true);
    try {
      const res = await updateAiSettings({
        aiEnabled,
        aiProvider: aiProvider as any,
        aiTextModel: aiTextModel || undefined,
        aiDailyCap,
        aiOutputLanguage: aiLanguage,
      });
      if (res.ok) {
        toast.success("AI configuration saved successfully.");
      } else {
        toast.error(res.error.message || "Failed to save AI settings.");
      }
    } catch {
      toast.error("Network error saving AI settings.");
    } finally {
      setSavingAi(false);
    }
  }

  // Test AI Connection
  async function handleTestAi() {
    setTestingConnection(true);
    try {
      const res = await testAiConnection();
      if (res.ok) {
        toast.success(`AI Connection Successful! Latency: ${res.data.latencyMs}ms`);
      } else {
        toast.error(res.error.message || "AI Connection test failed.");
      }
    } catch {
      toast.error("Network error testing AI connection.");
    } finally {
      setTestingConnection(false);
    }
  }

  // Master item toggle active
  async function handleToggleMaster(type: MasterTableType, id: string, currentState: boolean) {
    const newState = !currentState;
    // optimistic update
    setMaster((prev) => ({
      ...prev,
      [type]: prev[type].map((it) => (it.id === id ? { ...it, isActive: newState } : it)),
    }));

    const res = await toggleMasterItem(type, id, newState);
    if (!res.ok) {
      toast.error("Failed to update item status.");
      // rollback
      setMaster((prev) => ({
        ...prev,
        [type]: prev[type].map((it) => (it.id === id ? { ...it, isActive: currentState } : it)),
      }));
    } else {
      toast.success("Item status updated.");
    }
  }

  // Add Master Item
  async function handleAddMasterItem() {
    if (!newItemName.trim()) return;
    setAddingItem(true);
    try {
      const res = await createMasterItem(activeMasterType, newItemName.trim());
      if (res.ok) {
        toast.success(`New ${activeMasterType} item added!`);
        setMaster((prev) => ({
          ...prev,
          [activeMasterType]: [
            ...prev[activeMasterType],
            {
              id: res.data.id,
              name: newItemName.trim(),
              slug: newItemName.toLowerCase().replace(/\s+/g, "-"),
              isActive: true,
              sortOrder: prev[activeMasterType].length + 1,
            },
          ],
        }));
        setNewItemName("");
        setAddDialogOpen(false);
      } else {
        toast.error(res.error.message || "Failed to add item.");
      }
    } catch {
      toast.error("Network error adding master item.");
    } finally {
      setAddingItem(false);
    }
  }

  // Filtered logs
  const filteredLogs = systemLogs.filter((log) => {
    if (logFilterKind !== "all" && log.kind !== logFilterKind) return false;
    if (logFilterLevel !== "all" && log.level !== logFilterLevel) return false;
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
          <Settings className="size-6 text-foreground" />
          <span>Settings</span>
        </h1>
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Studio Preferences, Master Data, Ingest API & System Exports
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full space-y-6">
        <div className="border-b border-border/80 pb-2">
          <TabsList className="bg-secondary/60 p-1 rounded-lg border border-border flex flex-wrap">
            <TabsTrigger value="general" className="text-xs font-mono uppercase tracking-wider">
              <Clock className="size-3.5 mr-1.5" />
              General
            </TabsTrigger>
            <TabsTrigger value="master" className="text-xs font-mono uppercase tracking-wider">
              <Database className="size-3.5 mr-1.5" />
              Master Data
            </TabsTrigger>
            <TabsTrigger value="ingest" className="text-xs font-mono uppercase tracking-wider">
              <Key className="size-3.5 mr-1.5" />
              Ingest & Shortcuts
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs font-mono uppercase tracking-wider">
              <Cpu className="size-3.5 mr-1.5" />
              AI Automation
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs font-mono uppercase tracking-wider">
              <Download className="size-3.5 mr-1.5" />
              Data & Logs
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: General */}
        <TabsContent value="general" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Targets & Thresholds */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
              <CardHeader className="p-0 space-y-1">
                <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                  Weekly Targets & Thresholds
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Configured targets displayed in Planner and Home
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4 pt-2 text-xs">
                <div className="space-y-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Weekly Post Target (posts/week)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={weeklyTarget}
                    onChange={(e) => setWeeklyTarget(Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Used to calculate weekly production progress and alerts.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Insight Minimum Sample Threshold (n)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={insightMinSample}
                    onChange={(e) => setInsightMinSample(Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Rankings with fewer items than this are flagged as &ldquo;Small sample&rdquo;.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleSaveGeneral}
                    disabled={savingGeneral}
                    className="h-8 text-xs font-mono"
                  >
                    {savingGeneral ? <Loader2 className="size-3 animate-spin mr-1.5" /> : null}
                    Save General Settings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Default Production Checklist */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
              <CardHeader className="p-0 space-y-1">
                <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                  Default Content Checklist
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Applied automatically to all new production drafts
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-3 pt-2 text-xs">
                <div className="space-y-1.5">
                  {checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded bg-secondary/40 border border-border/80 text-xs font-mono"
                    >
                      <span>
                        {idx + 1}. {item}
                      </span>
                      <button
                        type="button"
                        onClick={() => setChecklist(checklist.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        aria-label="Remove checklist item"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="New checklist step..."
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    className="h-8 text-xs font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newChecklistText.trim()) {
                        e.preventDefault();
                        setChecklist([...checklist, newChecklistText.trim()]);
                        setNewChecklistText("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newChecklistText.trim()) {
                        setChecklist([...checklist, newChecklistText.trim()]);
                        setNewChecklistText("");
                      }
                    }}
                    className="h-8 text-xs font-mono shrink-0"
                  >
                    <Plus className="size-3 mr-1" /> Add
                  </Button>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleSaveGeneral}
                    disabled={savingGeneral}
                    variant="secondary"
                    className="h-8 text-xs font-mono w-full"
                  >
                    Save Checklist Steps
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Timezone & Session Info */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-3 md:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-xs uppercase tracking-wider font-mono text-foreground flex items-center gap-2">
                    <Globe className="size-3.5" />
                    <span>Timezone: Asia/Jakarta (WIB, UTC+7)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    All snapshot countdowns, reminder deadlines, and 08:00 WIB daily alerts operate on Western Indonesia Time.
                  </p>
                </div>

                <form action="/auth/signout" method="post">
                  <Button variant="outline" size="sm" type="submit" className="h-8 text-xs font-mono gap-1.5">
                    <LogOut className="size-3 text-muted-foreground" />
                    <span>Sign Out</span>
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Master Data */}
        <TabsContent value="master" className="space-y-6 focus-visible:outline-none">
          <Tabs defaultValue="pillars" className="w-full space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
              <TabsList className="bg-secondary/60 p-1 rounded-lg border border-border flex flex-wrap">
                <TabsTrigger
                  value="pillars"
                  onClick={() => setActiveMasterType("pillars")}
                  className="text-xs font-mono uppercase tracking-wider"
                >
                  <Layers className="size-3 mr-1.5" />
                  Pillars ({master.pillars.length})
                </TabsTrigger>
                <TabsTrigger
                  value="series"
                  onClick={() => setActiveMasterType("series")}
                  className="text-xs font-mono uppercase tracking-wider"
                >
                  <Bookmark className="size-3 mr-1.5" />
                  Series ({master.series.length})
                </TabsTrigger>
                <TabsTrigger
                  value="formats"
                  onClick={() => setActiveMasterType("formats")}
                  className="text-xs font-mono uppercase tracking-wider"
                >
                  <BarChart2 className="size-3 mr-1.5" />
                  Formats ({master.formats.length})
                </TabsTrigger>
                <TabsTrigger
                  value="hookTypes"
                  onClick={() => setActiveMasterType("hookTypes")}
                  className="text-xs font-mono uppercase tracking-wider"
                >
                  <Hash className="size-3 mr-1.5" />
                  Hook Types ({master.hookTypes.length})
                </TabsTrigger>
                <TabsTrigger
                  value="platforms"
                  onClick={() => setActiveMasterType("platforms")}
                  className="text-xs font-mono uppercase tracking-wider"
                >
                  <Globe className="size-3 mr-1.5" />
                  Platforms ({master.platforms.length})
                </TabsTrigger>
              </TabsList>

              <Button
                size="sm"
                onClick={() => setAddDialogOpen(true)}
                className="h-8 text-xs font-mono gap-1.5"
              >
                <Plus className="size-3" />
                <span>Add Item</span>
              </Button>
            </div>

            <TabsContent value="pillars">
              <MasterTable
                items={master.pillars}
                type="pillars"
                onToggle={(id, active) => handleToggleMaster("pillars", id, active)}
              />
            </TabsContent>
            <TabsContent value="series">
              <MasterTable
                items={master.series}
                type="series"
                onToggle={(id, active) => handleToggleMaster("series", id, active)}
              />
            </TabsContent>
            <TabsContent value="formats">
              <MasterTable
                items={master.formats}
                type="formats"
                onToggle={(id, active) => handleToggleMaster("formats", id, active)}
              />
            </TabsContent>
            <TabsContent value="hookTypes">
              <MasterTable
                items={master.hookTypes}
                type="hookTypes"
                onToggle={(id, active) => handleToggleMaster("hookTypes", id, active)}
              />
            </TabsContent>
            <TabsContent value="platforms">
              <MasterTable
                items={master.platforms}
                type="platforms"
                onToggle={(id, active) => handleToggleMaster("platforms", id, active)}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Tab 3: Ingest & Shortcuts */}
        <TabsContent value="ingest" className="space-y-6 focus-visible:outline-none">
          <IngestTokenCard initialHasToken={initialSettings.hasToken} />

          {/* Bookmarklet & Ingest Guide */}
          <Card className="rounded-xl border bg-card p-5 shadow-none space-y-3">
            <CardHeader className="p-0 space-y-1">
              <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                Browser Bookmarklet (1-Click Reference Ingestion)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Drag this script to your browser bookmarks bar to ingest any active tab URL directly into RMS Inbox
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2 space-y-2">
              <pre className="p-3 rounded-lg bg-secondary/60 border border-border text-[11px] font-mono text-foreground overflow-x-auto select-all">
                {`javascript:(function(){window.open('${typeof window !== "undefined" ? window.location.origin : ""}/api/ingest?url='+encodeURIComponent(location.href),'_blank');})();`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: AI Automation */}
        <TabsContent value="ai" className="space-y-6 focus-visible:outline-none">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 ${
              hasGeminiKey
                ? "bg-primary/5 border-primary/30 text-foreground"
                : "bg-amber-500/10 border-amber-500/30 text-foreground"
            }`}
          >
            {hasGeminiKey ? (
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 text-xs">
              <div className="font-bold flex items-center gap-2 font-display text-sm">
                <span>Google Gemini API (Free Tier)</span>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                    hasGeminiKey ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                  }`}
                >
                  {hasGeminiKey ? "Connected & Active" : "Key Required"}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {hasGeminiKey
                  ? "Gemini Flash Lite is connected with automatic fallback across Google AI Studio models (1,500 req/day free)."
                  : "Add your Google Generative AI API Key to .env.local (GOOGLE_GENERATIVE_AI_API_KEY) to activate Auto-Bedah and AI generation."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Configuration Form */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
              <CardHeader className="p-0 space-y-1">
                <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                  AI Model Configuration
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Provider, model overrides, and daily quotas
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4 pt-2 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-secondary/30">
                  <div className="space-y-0.5">
                    <div className="font-bold font-display text-foreground">Enable AI Features</div>
                    <div className="text-[11px] text-muted-foreground">
                      Turns on Auto-Bedah, Hook generation, and Outlier patterns
                    </div>
                  </div>
                  <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Provider
                  </label>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:outline-none"
                  >
                    <option value="google">Google Gemini (Recommended - Free Tier)</option>
                    <option value="groq">Groq</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Text Model Override (Empty = Default Flash Lite)
                  </label>
                  <Input
                    placeholder="gemini-flash-lite-latest"
                    value={aiTextModel}
                    onChange={(e) => setAiTextModel(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    AI Output Language
                  </label>
                  <select
                    value={aiLanguage}
                    onChange={(e) => setAiLanguage(e.target.value as "id" | "en")}
                    className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:outline-none"
                  >
                    <option value="id">Indonesian (Bahasa Indonesia)</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={handleSaveAi}
                    disabled={savingAi}
                    className="h-8 text-xs font-mono"
                  >
                    {savingAi ? <Loader2 className="size-3 animate-spin mr-1.5" /> : null}
                    Save AI Settings
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTestAi}
                    disabled={testingConnection}
                    className="h-8 text-xs font-mono gap-1.5"
                  >
                    {testingConnection ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    <span>Test Connection</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* How to Setup Free Key */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
              <CardHeader className="p-0 space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-foreground" />
                  <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                    How to Get Your API Key (Free)
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Google AI Studio Free Tier (1,500 requests per day)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-3 pt-2 text-xs">
                <ol className="space-y-1.5 list-decimal list-inside text-muted-foreground font-sans leading-relaxed">
                  <li>
                    Visit{" "}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground font-bold underline inline-flex items-center gap-1"
                    >
                      aistudio.google.com/apikey
                      <ExternalLink className="size-3" />
                    </a>
                  </li>
                  <li>Sign in with your Google account.</li>
                  <li>Click <strong>Create API Key</strong>.</li>
                  <li>Add to your <code>.env.local</code>:</li>
                </ol>

                <pre className="p-3 rounded-lg bg-secondary/60 border border-border text-[11px] font-mono text-foreground overflow-x-auto select-all">
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 5: Data & Logs */}
        <TabsContent value="data" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Database Export Card */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
              <CardHeader className="p-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Download className="size-4 text-foreground" />
                  <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                    Export Database (JSON)
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Per PRD §9.5: Complete offline backup of all 16 database tables
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-3 pt-2 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  Downloads a structured JSON file containing all references, contents, posts, snapshots, audio catalog, source creators, and settings. Excludes private API tokens and embedding vectors.
                </p>
                <div className="pt-2">
                  <a href="/api/export" download>
                    <Button className="h-8 text-xs font-mono gap-1.5">
                      <Download className="size-3" />
                      <span>Download JSON Backup</span>
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Schema Info */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
              <CardHeader className="p-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-foreground" />
                  <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                    Database Schema Version
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Supabase Postgres & Drizzle ORM
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-2 pt-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Schema Version:</span>
                  <span className="font-bold text-foreground">v2.0 (PRD Folio Final)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Tables Count:</span>
                  <span className="font-bold text-foreground">16 tables</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">pgvector Extension:</span>
                  <span className="font-bold text-foreground">Active (768 dims)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Audit Logging:</span>
                  <span className="font-bold text-foreground">Enabled</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Logs Viewer */}
          <Card className="rounded-xl border bg-card shadow-none">
            <CardHeader className="p-5 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold font-display uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="size-4 text-foreground" />
                  <span>System Audit Logs (200 Latest Events)</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Ingest triggers, token rotations, cron checks, and AI completions
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={logFilterKind}
                  onChange={(e) => setLogFilterKind(e.target.value)}
                  className="h-7 rounded border border-border bg-background px-2 text-[11px] font-mono text-foreground focus:outline-none"
                >
                  <option value="all">All Kinds</option>
                  <option value="ingest">Ingest</option>
                  <option value="ai">AI</option>
                  <option value="export">Export</option>
                  <option value="cron">Cron</option>
                  <option value="auth">Auth</option>
                </select>

                <select
                  value={logFilterLevel}
                  onChange={(e) => setLogFilterLevel(e.target.value)}
                  className="h-7 rounded border border-border bg-background px-2 text-[11px] font-mono text-foreground focus:outline-none"
                >
                  <option value="all">All Levels</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-muted-foreground">
                  No system logs matching the current filter.
                </div>
              ) : (
                <div className="divide-y divide-border/60 max-h-[380px] overflow-y-auto font-mono text-[11px]">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 hover:bg-secondary/30 transition-colors flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                              log.level === "error"
                                ? "bg-destructive text-destructive-foreground"
                                : log.level === "warn"
                                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                : "bg-secondary text-foreground"
                            }`}
                          >
                            {log.kind}
                          </span>
                          <span className="font-bold text-foreground">{log.message}</span>
                        </div>
                        {log.meta && Object.keys(log.meta).length > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            {JSON.stringify(log.meta)}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Master Item Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display uppercase tracking-wider">
              Add New {activeMasterType.slice(0, -1)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-mono text-muted-foreground uppercase">Item Name</label>
            <Input
              placeholder={`Enter new ${activeMasterType.slice(0, -1)} name...`}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="text-xs font-mono"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddMasterItem();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(false)}
              className="text-xs font-mono"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddMasterItem}
              disabled={addingItem || !newItemName.trim()}
              className="text-xs font-mono"
            >
              {addingItem ? <Loader2 className="size-3 animate-spin mr-1.5" /> : null}
              Create Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MasterTable({
  items,
  type,
  onToggle,
}: {
  items: MasterItem[];
  type: MasterTableType;
  onToggle: (id: string, active: boolean) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-xs font-mono text-muted-foreground">
        No master items configured.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="bg-secondary/40 border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2.5 px-3">#</th>
            <th className="py-2.5 px-3">Name</th>
            <th className="py-2.5 px-3">Slug</th>
            <th className="py-2.5 px-3 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {items.map((item, idx) => (
            <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
              <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                {idx + 1}
              </td>
              <td className="py-2.5 px-3 font-bold text-foreground">{item.name}</td>
              <td className="py-2.5 px-3 font-mono text-muted-foreground">{item.slug}</td>
              <td className="py-2.5 px-3 text-right">
                <button
                  type="button"
                  onClick={() => onToggle(item.id, item.isActive)}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
                    item.isActive
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {item.isActive ? "Active" : "Inactive"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
