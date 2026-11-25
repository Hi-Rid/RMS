"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Key,
  Database,
  Cpu,
  CheckCircle2,
  AlertCircle,
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
  Pencil,
  ArrowUp,
  ArrowDown,
  Upload,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { IngestTokenCard } from "./ingest-token-card";
import {
  updateGeneralSettings,
  updateAiSettings,
  updatePersonalAiKey,
  importWorkspaceBackup,
  testAiConnection,
  toggleMasterItem,
  createMasterItem,
  updateMasterItem,
  deleteMasterItem,
  reorderMasterItem,
  type MasterTableType,
} from "@/lib/actions/settings";
import { signOut } from "@/lib/actions/auth";
import type { AppSettingsQuery } from "@/lib/queries/settings";

interface MasterItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  usageCount?: number;
  hasCheckpoints?: boolean;
  domains?: string[];
  isSource?: boolean;
  isTarget?: boolean;
}

interface MasterDataPayload {
  pillars: MasterItem[];
  series: MasterItem[];
  formats: MasterItem[];
  hookTypes: MasterItem[];
  platforms: MasterItem[];
}

interface SystemLogItem {
  id: number;
  kind: string;
  level: string;
  message: string;
  meta: unknown;
  createdAt: string;
}

interface SettingsClientProps {
  initialSettings: AppSettingsQuery;
  masterData: MasterDataPayload;
  systemLogs: SystemLogItem[];
  hasGeminiKey: boolean;
  appUrl: string;
  initialTab?: string;
}

const SINGULAR_LABEL: Record<MasterTableType, string> = {
  pillars: "Pillar",
  series: "Series",
  formats: "Format",
  hookTypes: "Hook Type",
  platforms: "Platform",
};

export function SettingsClient({
  initialSettings,
  masterData,
  systemLogs,
  hasGeminiKey,
  appUrl,
  initialTab = "general",
}: SettingsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isPending, startTransition] = useTransition();

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
  const [aiAutoEnrich, setAiAutoEnrich] = useState(initialSettings.aiAutoEnrich);
  const [aiIngestMode, setAiIngestMode] = useState<"inbox" | "selected" | "auto_draft">(
    (initialSettings.aiIngestMode as "inbox" | "selected" | "auto_draft") || "inbox"
  );
  const [creatorNiche, setCreatorNiche] = useState(initialSettings.creatorNiche || "");
  const [creatorAudience, setCreatorAudience] = useState(initialSettings.creatorAudience || "");
  const [creatorVoice, setCreatorVoice] = useState(initialSettings.creatorVoice || "");
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [personalKeyInput, setPersonalKeyInput] = useState("");
  const [hasPersonalAiKey, setHasPersonalAiKey] = useState(
    Boolean(initialSettings.hasPersonalAiKey)
  );
  const [savingPersonalKey, setSavingPersonalKey] = useState(false);

  // Data restore state
  const [importingBackup, setImportingBackup] = useState(false);
  const [importSummaryText, setImportSummaryText] = useState<string | null>(null);

  // Master data state
  const [master, setMaster] = useState(masterData);
  const [activeMasterType, setActiveMasterType] = useState<MasterTableType>("pillars");

  // Add Master Item modal
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newHasCheckpoints, setNewHasCheckpoints] = useState(true);
  const [newDomainsText, setNewDomainsText] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Edit Master Item modal
  const [editingItem, setEditingItem] = useState<{
    type: MasterTableType;
    item: MasterItem;
  } | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editHasCheckpoints, setEditHasCheckpoints] = useState(true);
  const [editDomainsText, setEditDomainsText] = useState("");
  const [editIsSource, setEditIsSource] = useState(true);
  const [editIsTarget, setEditIsTarget] = useState(true);
  const [savingEditItem, setSavingEditItem] = useState(false);

  // Delete Master Item alert dialog
  const [deletingItem, setDeletingItem] = useState<{
    type: MasterTableType;
    item: MasterItem;
  } | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Logs state
  const [logFilterKind, setLogFilterKind] = useState("all");
  const [logFilterLevel, setLogFilterLevel] = useState("all");

  function handleTabChange(val: string) {
    setActiveTab(val);
    router.replace(`/settings?tab=${val}`, { scroll: false });
  }

  // Save General
  async function handleSaveGeneral() {
    if (checklist.length === 0) {
      toast.error("Default checklist must contain at least 1 step.");
      return;
    }
    setSavingGeneral(true);
    try {
      const res = await updateGeneralSettings({
        weeklyPostTarget: weeklyTarget,
        insightMinSample,
        defaultChecklist: checklist,
      });
      if (res.ok) {
        toast.success("General settings saved successfully.");
        router.refresh();
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
        aiProvider: aiProvider as "google" | "groq" | "openrouter",
        aiTextModel: aiTextModel || undefined,
        aiDailyCap,
        aiOutputLanguage: aiLanguage,
        aiAutoEnrich,
        aiIngestMode,
        creatorNiche: creatorNiche.trim() || null,
        creatorAudience: creatorAudience.trim() || null,
        creatorVoice: creatorVoice.trim() || null,
      });
      if (res.ok) {
        toast.success("AI configuration saved successfully.");
        router.refresh();
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
        toast.success(`${res.data.message} (${res.data.latencyMs}ms)`);
      } else {
        toast.error(res.error.message || "AI Connection test failed.");
      }
    } catch {
      toast.error("Network error testing AI connection.");
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSavePersonalKey(clear = false) {
    if (!clear && personalKeyInput.trim().length < 12) {
      toast.error("Please enter a valid AI API key (at least 12 characters).");
      return;
    }

    setSavingPersonalKey(true);
    try {
      const res = await updatePersonalAiKey({
        apiKey: clear ? null : personalKeyInput.trim(),
      });
      if (res.ok) {
        setHasPersonalAiKey(res.data.hasPersonalAiKey);
        setPersonalKeyInput("");
        toast.success(
          clear
            ? "Personal AI key removed. Workspace default engine active."
            : "Personal AI key encrypted and saved."
        );
        router.refresh();
      } else {
        toast.error(res.error.message || "Failed to update personal AI key.");
      }
    } catch {
      toast.error("Network error saving personal AI key.");
    } finally {
      setSavingPersonalKey(false);
    }
  }

  async function handleBackupFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportingBackup(true);
    setImportSummaryText(null);
    try {
      const jsonText = await file.text();
      const res = await importWorkspaceBackup({ jsonText });
      if (res.ok) {
        const s = res.data;
        const msg = `Imported ${s.importedMaster} taxonomy item(s), ${s.importedRefs} reference(s), ${s.importedContents} studio content(s), and ${s.importedSnippets} snippet(s).${s.skippedDuplicates > 0 ? ` (${s.skippedDuplicates} existing URL duplicates skipped.)` : ""}`;
        setImportSummaryText(msg);
        toast.success("Backup restored successfully.");
        router.refresh();
      } else {
        toast.error(res.error.message || "Failed to import backup JSON.");
      }
    } catch {
      toast.error("Failed to read or parse backup JSON file.");
    } finally {
      setImportingBackup(false);
    }
  }

  // Master item toggle active
  async function handleToggleMaster(type: MasterTableType, id: string, currentState: boolean) {
    const newState = !currentState;
    setMaster((prev) => ({
      ...prev,
      [type]: prev[type].map((it) => (it.id === id ? { ...it, isActive: newState } : it)),
    }));

    const res = await toggleMasterItem(type, id, newState);
    if (!res.ok) {
      toast.error(res.error.message || "Failed to update item status.");
      setMaster((prev) => ({
        ...prev,
        [type]: prev[type].map((it) => (it.id === id ? { ...it, isActive: currentState } : it)),
      }));
    } else {
      toast.success(newState ? "Item activated." : "Item deactivated.");
      router.refresh();
    }
  }

  // Add Master Item
  async function handleAddMasterItem() {
    if (!newItemName.trim()) return;
    setAddingItem(true);
    const parsedDomains = newDomainsText
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    try {
      const res = await createMasterItem(activeMasterType, newItemName.trim(), {
        hasCheckpoints: activeMasterType === "formats" ? newHasCheckpoints : undefined,
        domains: activeMasterType === "platforms" && parsedDomains.length > 0 ? parsedDomains : undefined,
      });
      if (res.ok) {
        toast.success(`${SINGULAR_LABEL[activeMasterType]} added!`);
        setMaster((prev) => ({
          ...prev,
          [activeMasterType]: [
            ...prev[activeMasterType],
            {
              id: res.data.id,
              name: newItemName.trim(),
              slug: res.data.slug,
              isActive: true,
              sortOrder: res.data.sortOrder,
              usageCount: 0,
              hasCheckpoints: activeMasterType === "formats" ? newHasCheckpoints : undefined,
              domains:
                activeMasterType === "platforms"
                  ? parsedDomains.length > 0
                    ? parsedDomains
                    : [`${res.data.slug}.com`]
                  : undefined,
              isSource: activeMasterType === "platforms" ? true : undefined,
              isTarget: activeMasterType === "platforms" ? true : undefined,
            },
          ],
        }));
        setNewItemName("");
        setNewDomainsText("");
        setNewHasCheckpoints(true);
        setAddDialogOpen(false);
        router.refresh();
      } else {
        toast.error(res.error.message || "Failed to add item.");
      }
    } catch {
      toast.error("Network error adding master item.");
    } finally {
      setAddingItem(false);
    }
  }

  // Open Edit Modal
  function openEditDialog(type: MasterTableType, item: MasterItem) {
    setEditingItem({ type, item });
    setEditItemName(item.name);
    setEditHasCheckpoints(item.hasCheckpoints ?? true);
    setEditDomainsText((item.domains || []).filter(Boolean).join(", "));
    setEditIsSource(item.isSource ?? true);
    setEditIsTarget(item.isTarget ?? true);
  }

  // Save Edit Master Item
  async function handleSaveEditMasterItem() {
    if (!editingItem || !editItemName.trim()) return;
    setSavingEditItem(true);

    const { type, item } = editingItem;
    const parsedDomains = editDomainsText
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    try {
      const res = await updateMasterItem(type, item.id, {
        name: editItemName.trim(),
        ...(type === "formats" ? { hasCheckpoints: editHasCheckpoints } : {}),
        ...(type === "platforms"
          ? { domains: parsedDomains, isSource: editIsSource, isTarget: editIsTarget }
          : {}),
      });

      if (res.ok) {
        toast.success(`${SINGULAR_LABEL[type]} updated.`);
        setMaster((prev) => ({
          ...prev,
          [type]: prev[type].map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  name: editItemName.trim(),
                  ...(type === "formats" ? { hasCheckpoints: editHasCheckpoints } : {}),
                  ...(type === "platforms"
                    ? { domains: parsedDomains, isSource: editIsSource, isTarget: editIsTarget }
                    : {}),
                }
              : it
          ),
        }));
        setEditingItem(null);
        router.refresh();
      } else {
        toast.error(res.error.message || "Failed to update item.");
      }
    } catch {
      toast.error("Network error updating item.");
    } finally {
      setSavingEditItem(false);
    }
  }

  // Delete Master Item
  async function handleConfirmDeleteMasterItem() {
    if (!deletingItem) return;
    const { type, item } = deletingItem;
    setIsDeletingItem(true);
    try {
      const res = await deleteMasterItem(type, item.id);
      if (res.ok) {
        toast.success(`${SINGULAR_LABEL[type]} deleted.`);
        setMaster((prev) => ({
          ...prev,
          [type]: prev[type].filter((it) => it.id !== item.id),
        }));
        setDeletingItem(null);
        router.refresh();
      } else {
        toast.error(res.error.message || "Failed to delete item.");
      }
    } catch {
      toast.error("Network error deleting item.");
    } finally {
      setIsDeletingItem(false);
    }
  }

  // Reorder Master Item
  async function handleReorderMaster(
    type: MasterTableType,
    id: string,
    direction: "up" | "down"
  ) {
    const currentList = [...master[type]];
    const idx = currentList.findIndex((it) => it.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= currentList.length) return;

    const [moved] = currentList.splice(idx, 1);
    currentList.splice(swapIdx, 0, moved);

    // Optimistic update
    setMaster((prev) => ({
      ...prev,
      [type]: currentList.map((it, i) => ({ ...it, sortOrder: i + 1 })),
    }));

    const res = await reorderMasterItem(type, id, direction);
    if (!res.ok) {
      toast.error(res.error.message || "Failed to reorder item.");
      setMaster((prev) => ({ ...prev, [type]: master[type] }));
    } else {
      router.refresh();
    }
  }

  // Filtered logs
  const filteredLogs = systemLogs.filter((log) => {
    if (logFilterKind !== "all" && log.kind !== logFilterKind) return false;
    if (logFilterLevel !== "all" && log.level !== logFilterLevel) return false;
    return true;
  });

  const bookmarkletHref = `javascript:(function(){window.open('${appUrl}/inbox?add='+encodeURIComponent(location.href),'_blank');})();`;

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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
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
                  Configured targets displayed in Planner, Insight, and Home
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4 pt-2 text-xs">
                <div className="space-y-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Weekly Post Target (posts/week)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
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

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => signOut())}
                  className="h-8 text-xs font-mono gap-1.5"
                >
                  <LogOut className="size-3 text-muted-foreground" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Master Data */}
        <TabsContent value="master" className="space-y-6 focus-visible:outline-none">
          <Tabs
            value={activeMasterType}
            onValueChange={(val) => setActiveMasterType(val as MasterTableType)}
            className="w-full space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
              <TabsList className="bg-secondary/60 p-1 rounded-lg border border-border flex flex-wrap">
                <TabsTrigger value="pillars" className="text-xs font-mono uppercase tracking-wider">
                  <Layers className="size-3 mr-1.5" />
                  Pillars ({master.pillars.length})
                </TabsTrigger>
                <TabsTrigger value="series" className="text-xs font-mono uppercase tracking-wider">
                  <Bookmark className="size-3 mr-1.5" />
                  Series ({master.series.length})
                </TabsTrigger>
                <TabsTrigger value="formats" className="text-xs font-mono uppercase tracking-wider">
                  <BarChart2 className="size-3 mr-1.5" />
                  Formats ({master.formats.length})
                </TabsTrigger>
                <TabsTrigger value="hookTypes" className="text-xs font-mono uppercase tracking-wider">
                  <Hash className="size-3 mr-1.5" />
                  Hook Types ({master.hookTypes.length})
                </TabsTrigger>
                <TabsTrigger value="platforms" className="text-xs font-mono uppercase tracking-wider">
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
                <span>Add {SINGULAR_LABEL[activeMasterType]}</span>
              </Button>
            </div>

            {(["pillars", "series", "formats", "hookTypes", "platforms"] as const).map((typeKey) => (
              <TabsContent key={typeKey} value={typeKey}>
                <MasterTable
                  items={master[typeKey]}
                  type={typeKey}
                  onToggle={(id, active) => handleToggleMaster(typeKey, id, active)}
                  onEdit={(item) => openEditDialog(typeKey, item)}
                  onDelete={(item) => setDeletingItem({ type: typeKey, item })}
                  onReorder={(id, dir) => handleReorderMaster(typeKey, id, dir)}
                />
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* Tab 3: Ingest & Shortcuts */}
        <TabsContent value="ingest" className="space-y-6 focus-visible:outline-none">
          <IngestTokenCard initialHasToken={initialSettings.hasToken} appUrl={appUrl} />

          {/* Bookmarklet & Ingest Guide */}
          <Card className="rounded-xl border bg-card p-5 shadow-none space-y-3">
            <CardHeader className="p-0 space-y-1">
              <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                Browser Bookmarklet (1-Click Reference Ingestion)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Create a browser bookmark with this URL to send any active tab straight into your authenticated RMS Inbox
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2 space-y-2">
              <pre className="p-3 rounded-lg bg-secondary/60 border border-border text-[11px] font-mono text-foreground overflow-x-auto select-all">
                {bookmarkletHref}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: AI Automation */}
        <TabsContent value="ai" className="space-y-6 focus-visible:outline-none">
          {/* Status Banner */}
          {(() => {
            const effectiveAiKeyReady = hasGeminiKey || hasPersonalAiKey;
            return (
              <div
                className={`p-4 rounded-xl border flex items-start justify-between gap-3.5 flex-wrap ${
                  effectiveAiKeyReady && aiEnabled
                    ? "bg-primary/5 border-primary/30 text-foreground"
                    : "bg-amber-500/10 border-amber-500/30 text-foreground"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {effectiveAiKeyReady && aiEnabled ? (
                    <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 text-xs">
                    <div className="font-bold flex items-center gap-2 font-display text-sm">
                      <span>RMS AI Engine</span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                          effectiveAiKeyReady && aiEnabled
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-600 text-white"
                        }`}
                      >
                        {!effectiveAiKeyReady
                          ? "Key Required"
                          : aiEnabled
                          ? "Connected & Active"
                          : "Disabled"}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed max-w-2xl">
                      {effectiveAiKeyReady
                        ? "Automated reference breakdown, metadata enrichment, script drafting, and outlier synthesis run cleanly through the built-in RMS AI Engine."
                        : "Add your personal AI API key below to activate Auto-Breakdown and the Autonomous AI Agent."}
                    </p>
                  </div>
                </div>

                <div className="text-xs font-mono px-3 py-1.5 rounded-md border border-border bg-card">
                  Today: <strong>{initialSettings.aiUsedToday}</strong> /{" "}
                  {aiDailyCap === 0 ? "∞" : aiDailyCap}
                </div>
              </div>
            );
          })()}

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
                      Turns on Auto-Breakdown, Hook generation, and Outlier pattern analysis
                    </div>
                  </div>
                  <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      AI Engine Profile
                    </label>
                    <div className="h-9 rounded-md border border-border bg-secondary/40 px-2.5 flex items-center text-xs font-mono text-foreground">
                      Managed RMS AI Engine (Auto)
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Daily Request Cap
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={5000}
                      value={aiDailyCap}
                      onChange={(e) => setAiDailyCap(Number(e.target.value))}
                      className="font-mono text-xs"
                    />
                  </div>
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

                {/* Autonomous Content Agent */}
                <div className="pt-4 border-t border-border/70 space-y-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                      Autonomous Content Agent
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Turn shared TikTok, Instagram, and YouTube links into structured references or ready-to-shoot content drafts automatically.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-secondary/20 p-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-mono font-semibold text-foreground">
                        Auto-Enrich on Ingest
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Fetch social metadata &amp; auto-fill summary, hook, pillars, tags, and visual notes when a link arrives.
                      </p>
                    </div>
                    <Switch
                      checked={aiAutoEnrich}
                      onCheckedChange={setAiAutoEnrich}
                      aria-label="Toggle auto-enrich on ingest"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Post-Ingest Agent Mode
                    </label>
                    <select
                      value={aiIngestMode}
                      onChange={(e) =>
                        setAiIngestMode(e.target.value as "inbox" | "selected" | "auto_draft")
                      }
                      className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:outline-none"
                    >
                      <option value="inbox">Inbox Review — Enrich &amp; queue in Inbox for triage</option>
                      <option value="selected">Auto-Select — Enrich &amp; promote straight to Selected</option>
                      <option value="auto_draft">Full Auto Draft — Enrich &amp; auto-draft Content + Script in Studio</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      In <strong>Full Auto Draft</strong>, each shared link generates a tailored Content item with shooting script &amp; checklist in Studio.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                        Creator Persona Profile
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Used by your AI Content Agent across auto-ingest, Breakdowns, Hooks, Script Drafting, and Captions.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          Creator Niche / Topics
                        </label>
                        <Input
                          value={creatorNiche}
                          onChange={(e) => setCreatorNiche(e.target.value)}
                          placeholder="e.g. Tech storytelling, solo builder, productivity"
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          Target Audience
                        </label>
                        <Input
                          value={creatorAudience}
                          onChange={(e) => setCreatorAudience(e.target.value)}
                          placeholder="e.g. Young Indonesian founders & creatives"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        Brand Voice &amp; Delivery Style
                      </label>
                      <Input
                        value={creatorVoice}
                        onChange={(e) => setCreatorVoice(e.target.value)}
                        placeholder="e.g. Conversational, sharp storytelling, punchy 3-sec hooks, practical takeaways"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
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

            {/* Personal AI API Key (BYOK) */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
              <CardHeader className="p-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Key className="size-4 text-foreground" />
                    <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                      Personal AI API Key (BYOK)
                    </CardTitle>
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                      hasPersonalAiKey
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    {hasPersonalAiKey ? "Custom Key Active" : "Workspace Default"}
                  </span>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Optional encrypted BYOK key isolated to your workspace quota.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-3 pt-2 text-xs">
                <div className="p-3 rounded-lg bg-secondary/40 border border-border/80 flex items-start gap-2.5">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Your key is encrypted at rest with AES-256-GCM before storage and never exported in JSON backups or exposed back to client code.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {hasPersonalAiKey ? "Replace Saved Key" : "Paste Personal AI Key"}
                  </label>
                  <Input
                    type="password"
                    value={personalKeyInput}
                    onChange={(e) => setPersonalKeyInput(e.target.value)}
                    placeholder={
                      hasPersonalAiKey
                        ? "•••••••••••••••• (leave blank to keep current)"
                        : "Paste your AI API key here..."
                    }
                    className="h-9 font-mono text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingPersonalKey || personalKeyInput.trim().length < 12}
                    onClick={() => handleSavePersonalKey(false)}
                    className="h-8 text-xs font-mono gap-1.5"
                  >
                    {savingPersonalKey ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Key className="size-3" />
                    )}
                    <span>Save Key</span>
                  </Button>
                  {hasPersonalAiKey && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savingPersonalKey}
                      onClick={() => handleSavePersonalKey(true)}
                      className="h-8 text-xs font-mono text-destructive hover:text-destructive gap-1.5"
                    >
                      <Trash2 className="size-3" />
                      <span>Remove Key</span>
                    </Button>
                  )}
                </div>
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
                  Per PRD §9.5: Complete offline backup of all database tables
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

            {/* Restore / Import Backup Card */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
              <CardHeader className="p-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Upload className="size-4 text-foreground" />
                  <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                    Restore Backup (JSON)
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Idempotent import of taxonomy, references, studio drafts, and snippets
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-3 pt-2 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  Upload a previously exported RMS v2 JSON backup. Duplicate URLs are safely skipped while missing taxonomies, references, drafts, and snippet templates are restored atomically.
                </p>
                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="application/json,.json"
                      disabled={importingBackup}
                      onChange={handleBackupFileChange}
                      className="sr-only"
                    />
                    <span
                      className={`inline-flex items-center justify-center h-8 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-xs font-mono gap-1.5 cursor-pointer transition-colors ${
                        importingBackup ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      {importingBackup ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Upload className="size-3" />
                      )}
                      <span>{importingBackup ? "Restoring..." : "Upload JSON Backup"}</span>
                    </span>
                  </label>
                </div>
                {importSummaryText && (
                  <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md p-2.5 leading-relaxed">
                    {importSummaryText}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Schema Info */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4 md:col-span-2">
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
                  <span className="font-bold text-foreground">16 tables exported</span>
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
                  <option value="import">Import / Export</option>
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
                        {log.meta && typeof log.meta === "object" && Object.keys(log.meta as object).length > 0 ? (
                          <div className="text-[10px] text-muted-foreground">
                            {JSON.stringify(log.meta)}
                          </div>
                        ) : null}
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
              Add New {SINGULAR_LABEL[activeMasterType]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase">Item Name</label>
              <Input
                placeholder={`Enter new ${SINGULAR_LABEL[activeMasterType].toLowerCase()} name...`}
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

            {activeMasterType === "formats" && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                <div className="space-y-0.5 text-xs">
                  <div className="font-bold font-display">Track Performance Checkpoints</div>
                  <div className="text-[11px] text-muted-foreground">
                    Create 24h, 7d, 30d snapshots when published (disable for Story)
                  </div>
                </div>
                <Switch checked={newHasCheckpoints} onCheckedChange={setNewHasCheckpoints} />
              </div>
            )}

            {activeMasterType === "platforms" && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground uppercase">
                  Domains (comma separated)
                </label>
                <Input
                  placeholder="instagram.com, instagr.am"
                  value={newDomainsText}
                  onChange={(e) => setNewDomainsText(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            )}
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

      {/* Edit Master Item Dialog */}
      <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display uppercase tracking-wider">
              Edit {editingItem ? SINGULAR_LABEL[editingItem.type] : "Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase">Name</label>
              <Input
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
                className="text-xs font-mono"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveEditMasterItem();
                  }
                }}
              />
            </div>

            {editingItem?.type === "formats" && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
                <div className="space-y-0.5 text-xs">
                  <div className="font-bold font-display">Has Evaluation Checkpoints</div>
                  <div className="text-[11px] text-muted-foreground">
                    Generate 24h, 7d, 30d evaluation snapshots on publish
                  </div>
                </div>
                <Switch checked={editHasCheckpoints} onCheckedChange={setEditHasCheckpoints} />
              </div>
            )}

            {editingItem?.type === "platforms" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground uppercase">
                    Domains (comma separated)
                  </label>
                  <Input
                    value={editDomainsText}
                    onChange={(e) => setEditDomainsText(e.target.value)}
                    placeholder="instagram.com, instagr.am"
                    className="text-xs font-mono"
                  />
                </div>
                <div className="flex items-center justify-between p-2.5 rounded border border-border bg-secondary/20 text-xs">
                  <span>Source Platform (for references)</span>
                  <Switch checked={editIsSource} onCheckedChange={setEditIsSource} />
                </div>
                <div className="flex items-center justify-between p-2.5 rounded border border-border bg-secondary/20 text-xs">
                  <span>Target Platform (for publishing)</span>
                  <Switch checked={editIsTarget} onCheckedChange={setEditIsTarget} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingItem(null)}
              className="text-xs font-mono"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEditMasterItem}
              disabled={savingEditItem || !editItemName.trim()}
              className="text-xs font-mono"
            >
              {savingEditItem ? <Loader2 className="size-3 animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Master Item Confirmation AlertDialog */}
      <AlertDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => !open && setDeletingItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletingItem ? SINGULAR_LABEL[deletingItem.type] : "Item"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-mono">
              Are you sure you want to permanently delete &ldquo;{deletingItem?.item.name}&rdquo;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-mono">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDeleteMasterItem}
              disabled={isDeletingItem}
              className="text-xs font-mono"
            >
              {isDeletingItem ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MasterTable({
  items,
  type,
  onToggle,
  onEdit,
  onDelete,
  onReorder,
}: {
  items: MasterItem[];
  type: MasterTableType;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (item: MasterItem) => void;
  onDelete: (item: MasterItem) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
}) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-xs font-mono text-muted-foreground">
        No master items configured.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-secondary/40 border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2.5 px-3 w-16">Order</th>
            <th className="py-2.5 px-3">Name</th>
            <th className="py-2.5 px-3">Details</th>
            <th className="py-2.5 px-3 text-center">In Use</th>
            <th className="py-2.5 px-3 text-center">Status</th>
            <th className="py-2.5 px-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {items.map((item, idx) => {
            const usage = item.usageCount || 0;
            const isUsed = usage > 0;
            return (
              <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onReorder(item.id, "up")}
                      aria-label={`Move ${item.name} up`}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:pointer-events-none text-muted-foreground hover:text-foreground"
                    >
                      <ArrowUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === items.length - 1}
                      onClick={() => onReorder(item.id, "down")}
                      aria-label={`Move ${item.name} down`}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:pointer-events-none text-muted-foreground hover:text-foreground"
                    >
                      <ArrowDown className="size-3" />
                    </button>
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-bold text-foreground">{item.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{item.slug}</div>
                </td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                  {type === "formats" && (
                    <span>
                      {item.hasCheckpoints !== false ? "Checkpoints: 24h/7d/30d" : "No checkpoints"}
                    </span>
                  )}
                  {type === "platforms" && (
                    <span className="truncate block max-w-[220px]">
                      {(item.domains || []).filter(Boolean).join(", ") || "—"}
                    </span>
                  )}
                  {type !== "formats" && type !== "platforms" && <span>—</span>}
                </td>
                <td className="py-2.5 px-3 text-center font-mono">
                  <span className="text-[11px] text-muted-foreground">{usage}</span>
                </td>
                <td className="py-2.5 px-3 text-center">
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
                <td className="py-2.5 px-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      aria-label={`Edit ${item.name}`}
                      title={`Edit ${item.name}`}
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isUsed}
                      onClick={() => onDelete(item)}
                      aria-label={`Delete ${item.name}`}
                      title={
                        isUsed
                          ? `In use by ${usage} item(s) — deactivate instead`
                          : `Delete ${item.name}`
                      }
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
