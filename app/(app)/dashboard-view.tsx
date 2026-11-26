"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ClipboardPaste,
  Clock,
  ExternalLink,
  FileText,
  FileVideo,
  Inbox,
  Layers,
  Link as LinkIcon,
  Loader2,
  Music,
  Play,
  Plus,
  Quote,
  Sparkles,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/app/status-badge";
import { AddLinksDialog } from "@/components/app/add-links-dialog";
import { createReferenceFromUrl } from "@/lib/actions/references";
import { toast } from "sonner";
import type { HomeData } from "@/lib/queries/home";

interface DashboardViewProps {
  data: HomeData;
  ownerEmail?: string;
}

const SETUP_DISMISS_STORAGE_KEY = "rms.dismissSetupCard";

const INGEST_MODE_LABELS: Record<HomeData["readiness"]["aiIngestMode"], string> = {
  inbox: "Inbox Review",
  selected: "Auto-Select",
  auto_draft: "Full Auto Draft",
};

const UTC_DATE_CHIP_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const WIB_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatPlannedChip(ymd: string, wibTodayYmd: string): {
  label: string;
  isToday: boolean;
  isOverdue: boolean;
} {
  if (ymd === wibTodayYmd) {
    return { label: "TODAY", isToday: true, isOverdue: false };
  }
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return { label: ymd, isToday: false, isOverdue: false };
  }
  return {
    label: UTC_DATE_CHIP_FORMATTER.format(d).toUpperCase(),
    isToday: false,
    isOverdue: ymd < wibTodayYmd,
  };
}

function formatCheckpointBadge(cp: string): string {
  if (cp === "h24") return "24H";
  if (cp === "d7") return "7D";
  if (cp === "d30") return "30D";
  return cp.toUpperCase();
}

function formatRelativeOrWib(iso: string, clientNow: number | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (clientNow !== null) {
    const diffMin = Math.max(0, Math.floor((clientNow - date.getTime()) / 60_000));
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
  }
  return WIB_TIME_FORMATTER.format(date);
}

export function DashboardView({ data, ownerEmail }: DashboardViewProps) {
  const router = useRouter();
  const [quickUrl, setQuickUrl] = useState("");
  const [isIngesting, startIngest] = useTransition();
  const [clientNow, setClientNow] = useState<number | null>(null);
  const [setupDismissed, setSetupDismissed] = useState(true);

  const quickInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setClientNow(Date.now());
    try {
      setSetupDismissed(window.localStorage.getItem(SETUP_DISMISS_STORAGE_KEY) === "1");
    } catch {
      setSetupDismissed(false);
    }
  }, []);

  const displayName = React.useMemo(() => {
    if (!ownerEmail) return "Creator";
    const localPart = ownerEmail.split("@")[0];
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }, [ownerEmail]);

  const handleQuickIngest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) {
      toast.error("Please enter or paste a valid link");
      return;
    }

    startIngest(async () => {
      const res = await createReferenceFromUrl({ input: quickUrl.trim() });
      if (res.ok) {
        if (res.data.status === "duplicate") {
          toast.info("Reference already saved in your library", {
            action: {
              label: "Open",
              onClick: () => router.push(`/references/${res.data.id}`),
            },
          });
        } else if (res.data.draftContentId) {
          toast.success(
            `Saved & AI drafted "${res.data.draftContentTitle || "New Content"}" in Studio!`,
            {
              action: {
                label: "Open Studio",
                onClick: () => router.push(`/contents/${res.data.draftContentId}`),
              },
            }
          );
        } else if (res.data.enriched) {
          toast.success("Saved & AI-enriched! Summary, hook & pillars ready.", {
            action: {
              label: "Inspect",
              onClick: () => router.push(`/references/${res.data.id}`),
            },
          });
        } else {
          toast.success("Link saved to Inbox! Ready to triage.", {
            action: {
              label: "Open Inbox",
              onClick: () => router.push("/inbox"),
            },
          });
        }
        setQuickUrl("");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = (await navigator.clipboard.readText())?.trim();
      if (!text) {
        toast.info("Clipboard is empty — paste your link directly.");
        quickInputRef.current?.focus();
        return;
      }
      setQuickUrl(text);
      quickInputRef.current?.focus();
    } catch {
      toast.info("Press Ctrl+V / Cmd+V in the box to paste.");
      quickInputRef.current?.focus();
    }
  };

  const handleDismissSetup = () => {
    setSetupDismissed(true);
    try {
      window.localStorage.setItem(SETUP_DISMISS_STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures
    }
  };

  const targetCount = Math.max(0, data.weeklyTarget.target);
  const postedCount = Math.max(0, data.weeklyTarget.posted);
  const weeklyPct =
    targetCount === 0
      ? postedCount > 0
        ? 100
        : 0
      : Math.min(100, Math.round((postedCount / targetCount) * 100));
  const remainingWeekly = Math.max(0, targetCount - postedCount);

  const aiReadyAndOn = data.readiness.aiKeyReady && data.readiness.aiEnabled;
  const setupIncomplete =
    !data.readiness.aiKeyReady ||
    !data.readiness.hasIngestToken ||
    data.counts.references === 0;
  const showSetupBanner = !setupDismissed && setupIncomplete;

  const focusSummary = (() => {
    const parts: string[] = [];
    if (data.counts.evaluate > 0) {
      parts.push(
        `${data.counts.evaluate} checkpoint${data.counts.evaluate > 1 ? "s" : ""} due`
      );
    }
    if (data.counts.inbox > 0) {
      parts.push(`${data.counts.inbox} in Inbox`);
    }
    if (data.plannedThisWeek.length > 0) {
      parts.push(`${data.plannedThisWeek.length} planned this week`);
    }
    if (parts.length > 0) return parts.join(" · ");
    if (data.counts.statuses.production > 0) {
      return `${data.counts.statuses.production} active draft${data.counts.statuses.production > 1 ? "s" : ""} in Production Studio.`;
    }
    return "Paste any inspiring link below or pick a reference to start today's shoot.";
  })();

  const topPillars = data.counts.pillars.slice(0, 8);

  return (
    <div className="relative isolate min-h-full w-full py-6 sm:py-8 px-4 sm:px-8 lg:px-10 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Background blueprint grid cleanly layered behind all sections */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.24]"
        style={{
          backgroundImage: `radial-gradient(var(--border) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* 1. Command Header & Instant Capture */}
      <div className="relative z-10 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/80 pb-5">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="size-2 rounded-[2px] bg-brand shrink-0" />
              <span className="label-mono text-muted-foreground">
                COMMAND CENTER · {data.wibTodayLabel}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-foreground">
              Hi, {displayName}
            </h1>
            <p className="text-xs font-mono text-muted-foreground">
              {focusSummary}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <AddLinksDialog>
              <Button variant="outline" size="sm" className="text-xs font-mono h-8 rounded-md gap-1.5">
                <Upload className="size-3.5" />
                <span>Batch / File</span>
              </Button>
            </AddLinksDialog>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-xs font-mono h-8 rounded-md gap-1.5"
            >
              <Link href="/planner">
                <Calendar className="size-3.5" />
                <span>Planner</span>
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="text-xs font-mono h-8 rounded-md bg-brand text-brand-foreground hover:bg-brand/90 font-bold gap-1.5"
            >
              <Link href="/contents/new">
                <Plus className="size-3.5" />
                <span>New Content</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Ingest Bar */}
        <div className="space-y-2">
          <form
            onSubmit={handleQuickIngest}
            className="flex flex-col sm:flex-row sm:items-center gap-1.5 bg-card border border-input rounded-lg p-1.5 transition-colors focus-within:border-foreground hover:border-foreground/40"
          >
            <div className="flex items-center flex-1 min-w-0">
              <div className="pl-2.5 pr-1.5 text-muted-foreground shrink-0">
                <LinkIcon className="size-4" />
              </div>
              <label htmlFor="dashboard-quick-ingest" className="sr-only">
                Paste social link or note to save reference
              </label>
              <Input
                ref={quickInputRef}
                id="dashboard-quick-ingest"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                placeholder="Paste any Reel, TikTok, Shorts, X, or Threads link..."
                className="border-0 bg-transparent h-9 text-xs font-mono focus-visible:ring-0 focus-visible:ring-offset-0 px-1 min-w-0"
                disabled={isIngesting}
              />
              {quickUrl && (
                <button
                  type="button"
                  aria-label="Clear URL input"
                  onClick={() => {
                    setQuickUrl("");
                    quickInputRef.current?.focus();
                  }}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-md shrink-0"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-1.5 shrink-0 pl-1 sm:pl-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isIngesting}
                onClick={handlePasteFromClipboard}
                className="h-8 px-2.5 text-xs font-mono rounded-md gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ClipboardPaste className="size-3.5" />
                <span>Paste</span>
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isIngesting || !quickUrl.trim()}
                className="text-xs font-mono h-8 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5 px-3.5"
              >
                {isIngesting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Zap className="size-3.5 fill-current" />
                )}
                <span>{isIngesting ? "Saving..." : "Ingest"}</span>
              </Button>
            </div>
          </form>

          {/* Subtle Mode & AI Readiness Status Line */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-[11px] font-mono text-muted-foreground">
            <div className="flex items-center gap-2">
              <span
                className={`size-1.5 rounded-[1px] shrink-0 ${
                  aiReadyAndOn
                    ? data.readiness.aiAutoEnrich
                      ? "bg-success"
                      : "bg-foreground"
                    : "bg-warning"
                }`}
              />
              {aiReadyAndOn ? (
                <span>
                  {data.readiness.aiAutoEnrich
                    ? `AI Auto-Enrich Active · Mode: ${INGEST_MODE_LABELS[data.readiness.aiIngestMode]}`
                    : `AI Ready (Auto-Enrich off) · Mode: ${INGEST_MODE_LABELS[data.readiness.aiIngestMode]}`}
                </span>
              ) : !data.readiness.aiKeyReady ? (
                <span>
                  Manual Save Mode — no Gemini API key configured yet.
                </span>
              ) : (
                <span>AI Automation paused in settings.</span>
              )}
            </div>

            <Link
              href="/settings?tab=ai"
              className="hover:text-foreground underline underline-offset-4 transition-colors"
            >
              {aiReadyAndOn ? "AI Settings →" : "Configure AI →"}
            </Link>
          </div>
        </div>
      </div>

      {/* 1.5 Optional Workspace Setup Checklist */}
      {showSetupBanner && (
        <section className="relative z-10 rounded-lg border border-warning/40 bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="label-mono text-warning">WORKSPACE READINESS CHECKLIST</div>
              <p className="text-xs font-mono text-muted-foreground">
                Finish these steps for 1-tap mobile capture and automated reference breakdowns.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismissSetup}
              aria-label="Dismiss setup checklist"
              className="p-1 text-muted-foreground hover:text-foreground rounded-md"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
            <Link
              href="/settings?tab=ai"
              className={`flex items-center justify-between gap-2 p-2.5 rounded-md border transition-colors ${
                data.readiness.aiKeyReady
                  ? "bg-success/5 border-success/30 text-foreground"
                  : "bg-secondary/40 border-border hover:border-foreground/40"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <CheckCircle2
                  className={`size-3.5 shrink-0 ${
                    data.readiness.aiKeyReady ? "text-success" : "text-muted-foreground"
                  }`}
                />
                <span className="truncate">1. Add Gemini Key</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider shrink-0 font-bold text-muted-foreground">
                {data.readiness.aiKeyReady ? "Done" : "Setup"}
              </span>
            </Link>

            <Link
              href="/settings?tab=ingest"
              className={`flex items-center justify-between gap-2 p-2.5 rounded-md border transition-colors ${
                data.readiness.hasIngestToken
                  ? "bg-success/5 border-success/30 text-foreground"
                  : "bg-secondary/40 border-border hover:border-foreground/40"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <CheckCircle2
                  className={`size-3.5 shrink-0 ${
                    data.readiness.hasIngestToken ? "text-success" : "text-muted-foreground"
                  }`}
                />
                <span className="truncate">2. Generate Ingest Token</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider shrink-0 font-bold text-muted-foreground">
                {data.readiness.hasIngestToken ? "Done" : "Create"}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => quickInputRef.current?.focus()}
              className={`flex items-center justify-between gap-2 p-2.5 rounded-md border text-left transition-colors ${
                data.counts.references > 0
                  ? "bg-success/5 border-success/30 text-foreground"
                  : "bg-secondary/40 border-border hover:border-foreground/40"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <CheckCircle2
                  className={`size-3.5 shrink-0 ${
                    data.counts.references > 0 ? "text-success" : "text-muted-foreground"
                  }`}
                />
                <span className="truncate">3. Save First Reference</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider shrink-0 font-bold text-muted-foreground">
                {data.counts.references > 0 ? "Done" : "Paste"}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* 2. Weekly Target Progress + 4-Stage Pipeline */}
      <section className="relative z-10 space-y-4">
        {/* Weekly Goal Spotlight Strip */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="label-mono text-muted-foreground">
                WEEKLY PUBLISHING GOAL ({data.wibWeekLabel})
              </span>
              <span
                className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${
                  weeklyPct >= 100
                    ? "bg-success/10 text-success border-success/30"
                    : "bg-secondary text-foreground border-border"
                }`}
              >
                {postedCount} / {targetCount} POSTED ({weeklyPct}%)
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                {weeklyPct >= 100
                  ? "Weekly publishing goal reached"
                  : `${remainingWeekly} more post${remainingWeekly > 1 ? "s" : ""} to hit goal`}
              </span>
              <Link
                href="/planner"
                className="text-[11px] font-semibold text-foreground hover:text-brand underline-offset-4 hover:underline"
              >
                Open Planner →
              </Link>
            </div>
          </div>

          <div
            role="progressbar"
            aria-valuenow={weeklyPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Weekly publishing goal progress"
            className="h-2 w-full rounded-sm bg-secondary overflow-hidden"
          >
            <div
              className={`h-full transition-all duration-300 ${
                weeklyPct >= 100 ? "bg-success" : "bg-brand"
              }`}
              style={{ width: `${Math.max(postedCount > 0 ? 4 : 0, weeklyPct)}%` }}
            />
          </div>
        </div>

        {/* 4 Pipeline Stage Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stage 1: INBOX */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3 flex flex-col justify-between hover:border-foreground/30 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className={`label-mono px-2 py-0.5 rounded-md border ${
                    data.counts.inbox > 0
                      ? "bg-foreground text-background border-foreground"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  Step 01
                </span>
                <Inbox className="size-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-black font-display tracking-tight text-foreground tabular-nums">
                  {data.counts.inbox}
                </div>
                <div className="text-xs font-mono font-semibold text-foreground">
                  Inbox Triage
                </div>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  Raw saved links waiting for review &amp; breakdown
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                asChild
                size="sm"
                variant={data.counts.inbox > 0 ? "default" : "outline"}
                className={
                  data.counts.inbox > 0
                    ? "w-full text-xs font-mono h-8 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5"
                    : "w-full text-xs font-mono h-8 rounded-md font-semibold gap-1.5"
                }
              >
                <Link href={data.counts.inbox > 0 ? "/inbox/triage" : "/inbox"}>
                  <Play className="size-3 fill-current" />
                  <span>{data.counts.inbox > 0 ? "Start Triage" : "Open Inbox"}</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Stage 2: CURATED REFERENCES */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3 flex flex-col justify-between hover:border-foreground/30 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-mono px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border">
                  Step 02
                </span>
                <Bookmark className="size-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-black font-display tracking-tight text-foreground tabular-nums">
                  {data.counts.statuses.selected}
                </div>
                <div className="text-xs font-mono font-semibold text-foreground">
                  Selected Inspiration
                </div>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  Validated ideas ready to adapt into studio pieces
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="w-full text-xs font-mono h-8 rounded-md font-semibold gap-1.5"
              >
                <Link
                  href={
                    data.counts.statuses.selected > 0
                      ? "/references?status=selected"
                      : "/references"
                  }
                >
                  <Bookmark className="size-3" />
                  <span>
                    {data.counts.statuses.selected > 0 ? "Browse Selected" : "Library"}
                  </span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Stage 3: PRODUCTION STUDIO */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3 flex flex-col justify-between hover:border-foreground/30 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-mono px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border">
                  Step 03
                </span>
                <FileVideo className="size-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-black font-display tracking-tight text-foreground tabular-nums">
                  {data.counts.statuses.production}
                </div>
                <div className="text-xs font-mono font-semibold text-foreground">
                  In Production
                </div>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  {data.plannedThisWeek.length > 0
                    ? `${data.plannedThisWeek.length} scheduled for this week`
                    : "Scripts being written, filmed, and edited"}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="w-full text-xs font-mono h-8 rounded-md font-semibold gap-1.5"
              >
                <Link href="/contents?status=production">
                  <Layers className="size-3" />
                  <span>Open Studio</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Stage 4: EVALUATION & CHECKPOINTS */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3 flex flex-col justify-between hover:border-foreground/30 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className={`label-mono px-2 py-0.5 rounded-md border ${
                    data.counts.evaluate > 0
                      ? "bg-brand/10 text-brand border-brand/25"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  Step 04
                </span>
                <CheckSquare
                  className={`size-4 ${
                    data.counts.evaluate > 0 ? "text-brand" : "text-muted-foreground"
                  }`}
                />
              </div>
              <div>
                <div className="text-2xl font-black font-display tracking-tight text-foreground tabular-nums">
                  {data.counts.evaluate}
                </div>
                <div className="text-xs font-mono font-semibold text-foreground">
                  Checkpoints Due
                </div>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  {data.counts.evaluate === 0 && data.upcomingCheckpointsCount > 0
                    ? `${data.upcomingCheckpointsCount} upcoming checkpoint${data.upcomingCheckpointsCount > 1 ? "s" : ""} tracked`
                    : "24h, 7d, 30d views & retention reviews"}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                asChild
                size="sm"
                variant={data.counts.evaluate > 0 ? "default" : "outline"}
                className={
                  data.counts.evaluate > 0
                    ? "w-full text-xs font-mono h-8 rounded-md bg-brand text-brand-foreground hover:bg-brand/90 font-bold gap-1.5"
                    : "w-full text-xs font-mono h-8 rounded-md font-semibold gap-1.5"
                }
              >
                <Link href="/evaluate">
                  <BarChart3 className="size-3" />
                  <span>{data.counts.evaluate > 0 ? "Review Due Now" : "View Tracker"}</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Lower Operational Workspace Grid */}
      <section className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Radar (Checkpoints + Weekly Plan) & Active Production Studio */}
        <div className="lg:col-span-6 space-y-6">
          {/* A) Priority Radar: Due Checkpoints + Planned This Week */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="label-mono text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-brand" />
                <span>Action Radar &amp; This Week</span>
              </h3>
              <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                <Link href="/evaluate" className="hover:text-foreground">
                  Evaluate
                </Link>
                <span>·</span>
                <Link href="/planner" className="hover:text-foreground">
                  Planner →
                </Link>
              </div>
            </div>

            {/* Due Checkpoints Subsection */}
            {data.dueCheckpoints.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-brand font-bold">
                  <span>Due For Metrics ({data.counts.evaluate})</span>
                  <Link href="/evaluate" className="hover:underline underline-offset-4">
                    Log metrics →
                  </Link>
                </div>
                <div className="space-y-1.5">
                  {data.dueCheckpoints.map((cp) => (
                    <Link
                      key={cp.id}
                      href="/evaluate"
                      className="flex items-center justify-between gap-2.5 p-2.5 rounded-md border border-brand/30 bg-brand/[0.03] hover:border-brand/60 transition-colors group"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-brand text-brand-foreground font-mono text-[10px] font-bold shrink-0">
                          {formatCheckpointBadge(cp.checkpoint)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-mono font-bold text-foreground truncate group-hover:underline">
                            {cp.contentTitle}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {cp.platformName} · Ready to record
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="size-3.5 text-brand shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Planned This Week Subsection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                <span>Scheduled This Week ({data.plannedThisWeek.length})</span>
                <span>{data.wibWeekLabel}</span>
              </div>

              {data.plannedThisWeek.length === 0 ? (
                <div className="p-4 rounded-md border border-dashed border-border bg-secondary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-mono font-semibold text-foreground">
                      Nothing scheduled on this week&apos;s calendar
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Assign target dates in Planner to stay on pace ({postedCount}/{targetCount} posted).
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs font-mono shrink-0">
                    <Link href="/planner">Schedule Shoots</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.plannedThisWeek.map((item) => {
                    const chip = formatPlannedChip(item.plannedFor, data.wibTodayYmd);
                    return (
                      <Link
                        key={item.id}
                        href={`/contents/${item.id}`}
                        className="flex items-center justify-between gap-2.5 p-2.5 rounded-md border border-border bg-secondary/20 hover:border-foreground/40 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 border ${
                              chip.isToday
                                ? "bg-brand text-brand-foreground border-brand"
                                : chip.isOverdue && item.status === "production"
                                ? "bg-warning/15 text-warning border-warning/30"
                                : "bg-card text-foreground border-border"
                            }`}
                          >
                            {chip.label}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-mono font-semibold text-foreground truncate group-hover:underline">
                              {item.title}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                              {item.formatName && <span>{item.formatName}</span>}
                              {item.formatName && item.checklistTotal > 0 && <span>·</span>}
                              {item.checklistTotal > 0 && (
                                <span className="tabular-nums">
                                  Checklist {item.checklistDone}/{item.checklistTotal}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <StatusBadge status={item.status} size="sm" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* B) Active Working Scripts */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="label-mono text-foreground flex items-center gap-1.5">
                <FileText className="size-3.5" />
                <span>Active Production Studio</span>
              </h3>
              <Link href="/contents" className="text-[11px] font-mono text-muted-foreground hover:text-foreground">
                View all ({data.counts.contents}) →
              </Link>
            </div>

            {data.activeContents.length === 0 ? (
              <div className="p-6 text-center rounded-md border border-dashed border-border bg-secondary/30 space-y-2.5">
                <FileVideo className="size-6 mx-auto text-muted-foreground" />
                <p className="text-xs font-mono text-muted-foreground">
                  No active drafts in production. Pick a curated inspiration or start a fresh piece.
                </p>
                {data.counts.statuses.selected > 0 && (
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs font-mono rounded-md">
                    <Link href="/references?status=selected">Browse Selected Inspiration</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.activeContents.map((c) => {
                  const pct =
                    c.checklistTotal > 0
                      ? Math.round((c.checklistDone / c.checklistTotal) * 100)
                      : 0;
                  const chip = c.plannedFor
                    ? formatPlannedChip(c.plannedFor, data.wibTodayYmd)
                    : null;

                  return (
                    <Link
                      key={c.id}
                      href={`/contents/${c.id}`}
                      className="block p-3 rounded-md border border-border bg-secondary/20 hover:border-foreground/40 transition-colors group space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-foreground group-hover:underline line-clamp-1 min-w-0">
                          {c.title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {chip && (
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                chip.isToday
                                  ? "bg-brand/10 text-brand border-brand/30 font-bold"
                                  : "bg-card text-muted-foreground border-border"
                              }`}
                            >
                              {chip.label}
                            </span>
                          )}
                          {c.formatName && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-foreground text-background uppercase tracking-wider">
                              {c.formatName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-muted-foreground">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {c.checklistTotal > 0 ? (
                            <>
                              <div className="h-1.5 flex-1 max-w-[140px] rounded-xs bg-secondary overflow-hidden">
                                <div
                                  className={`h-full ${
                                    pct === 100 ? "bg-success" : "bg-brand"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="tabular-nums shrink-0">
                                {c.checklistDone}/{c.checklistTotal} steps
                              </span>
                            </>
                          ) : (
                            <span>No checklist steps</span>
                          )}
                        </div>

                        {c.refsCount > 0 && (
                          <span className="shrink-0">
                            {c.refsCount} ref{c.refsCount > 1 ? "s" : ""} linked
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            <Button asChild variant="outline" size="sm" className="w-full text-xs font-mono h-8 rounded-md gap-1.5">
              <Link href="/contents/new">
                <Plus className="size-3" />
                <span>Create New Content Piece</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN: Recently Ingested References & Library/Pillar Pulse */}
        <div className="lg:col-span-6 space-y-6">
          {/* A) Recent Ingested Inspiration */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="label-mono text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-brand" />
                <span>Recently Ingested Inspiration</span>
              </h3>
              <Link href="/references" className="text-[11px] font-mono text-muted-foreground hover:text-foreground">
                Library ({data.counts.references}) →
              </Link>
            </div>

            {data.recentRefs.length === 0 ? (
              <div className="p-6 text-center rounded-md border border-dashed border-border bg-secondary/30 space-y-2.5">
                <Bookmark className="size-6 mx-auto text-muted-foreground" />
                <p className="text-xs font-mono text-muted-foreground">
                  No references saved yet. Paste your first link in the bar above or batch-import URLs.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.recentRefs.map((r) => {
                  const headline = r.hookText || r.summary || r.url;
                  const metaLine = [
                    r.platformName,
                    r.formatName,
                    r.sourceHandle ? `@${r.sourceHandle}` : null,
                    formatRelativeOrWib(r.savedAt, clientNow),
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <div
                      key={r.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-md border border-border bg-secondary/20 hover:border-foreground/30 transition-colors"
                    >
                      <Link
                        href={`/references/${r.id}`}
                        className="space-y-1 flex-1 min-w-0 group"
                      >
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
                          {metaLine}
                        </div>
                        <div className="text-xs font-mono font-semibold text-foreground group-hover:underline line-clamp-1">
                          {headline}
                        </div>
                      </Link>

                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        <StatusBadge status={r.status} size="sm" />
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open original post"
                          aria-label="Open original post in new tab"
                          className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary transition-colors"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button asChild variant="outline" size="sm" className="text-xs font-mono h-8 rounded-md gap-1.5">
                <Link href="/inbox">
                  <Inbox className="size-3" />
                  <span>Inbox ({data.counts.inbox})</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="text-xs font-mono h-8 rounded-md gap-1.5">
                <Link href="/references?status=selected">
                  <Bookmark className="size-3" />
                  <span>Selected ({data.counts.statuses.selected})</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* B) Workspace Libraries & Top Pillars Pulse */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="label-mono text-foreground flex items-center gap-1.5">
                <BarChart3 className="size-3.5" />
                <span>Library Index &amp; Pillars</span>
              </h3>
              <Link href="/insight" className="text-[11px] font-mono text-muted-foreground hover:text-foreground">
                Outlier Insight →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <Link
                href="/audio"
                className="rounded-md border border-border bg-secondary/20 p-3 hover:border-foreground/40 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-mono uppercase tracking-wider">Audio</span>
                  <Music className="size-3.5" />
                </div>
                <div className="text-lg font-black font-display tabular-nums text-foreground">
                  {data.counts.audio}
                </div>
              </Link>

              <Link
                href="/sources"
                className="rounded-md border border-border bg-secondary/20 p-3 hover:border-foreground/40 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-mono uppercase tracking-wider">Creators</span>
                  <Users className="size-3.5" />
                </div>
                <div className="text-lg font-black font-display tabular-nums text-foreground">
                  {data.counts.sources}
                </div>
              </Link>

              <Link
                href="/captions"
                className="rounded-md border border-border bg-secondary/20 p-3 hover:border-foreground/40 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-mono uppercase tracking-wider">Snippets</span>
                  <Quote className="size-3.5" />
                </div>
                <div className="text-lg font-black font-display tabular-nums text-foreground">
                  {data.counts.captions}
                </div>
              </Link>
            </div>

            {topPillars.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  Jump to Pillar
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {topPillars.map((p) => (
                    <Link
                      key={p.id}
                      href={`/references?pillar=${encodeURIComponent(p.slug)}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-secondary/40 hover:border-foreground/40 text-xs font-mono text-foreground transition-colors"
                    >
                      <span>{p.name}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {p.count}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
