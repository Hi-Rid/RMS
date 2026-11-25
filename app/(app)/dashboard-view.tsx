"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  ExternalLink,
  FilePlus,
  FileText,
  FileVideo,
  Inbox,
  Layers,
  LineChart,
  Link as LinkIcon,
  Loader2,
  Play,
  Plus,
  Send,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/app/status-badge";
import { BrandLogo } from "@/components/app/brand-logo";
import { createReferenceFromUrl } from "@/lib/actions/references";
import { toast } from "sonner";
import type { HomeData } from "@/lib/queries/home";

interface DashboardViewProps {
  data: HomeData;
  ownerEmail?: string;
}

export function DashboardView({ data, ownerEmail }: DashboardViewProps) {
  const router = useRouter();
  const [quickUrl, setQuickUrl] = useState("");
  const [isIngesting, startIngest] = useTransition();

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
          toast.info("Reference already saved in your database");
        } else if (res.data.draftContentId) {
          toast.success(
            `Saved & AI drafted "${res.data.draftContentTitle || "New Content"}" in Studio!`
          );
        } else if (res.data.enriched) {
          toast.success("Saved & AI-enriched! Summary, hook & pillars ready.");
        } else {
          toast.success("Link saved to Inbox! Ready to triage.");
        }
        setQuickUrl("");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const weeklyPct = Math.min(
    100,
    Math.round((data.weeklyTarget.posted / Math.max(1, data.weeklyTarget.target)) * 100)
  );

  return (
    <div className="relative min-h-full w-full py-8 px-4 sm:px-8 lg:px-10 space-y-8 max-w-7xl mx-auto">
      {/* Background blueprint grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage: `radial-gradient(var(--border) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* 1. Header & Instant Quick Ingest */}
      <div className="relative space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-5">
          <div className="flex items-center gap-3">
            <BrandLogo className="size-9" />
            <div>
              <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-foreground">
                Hi, {displayName}
              </h1>
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                RMS Creator Command Center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/contents/new">
              <Button size="sm" className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5">
                <Plus className="size-3.5" />
                <span>New Content</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Paste Bar */}
        <form
          onSubmit={handleQuickIngest}
          className="relative flex items-center bg-card border border-border/80 rounded-lg p-1.5 shadow-none transition-all focus-within:border-foreground/50 hover:border-foreground/30"
        >
          <div className="pl-3 pr-2 text-muted-foreground">
            <LinkIcon className="size-4" />
          </div>
          <Input
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            placeholder="Paste any Reels, TikTok, or YouTube link to instantly ingest to Inbox..."
            className="border-0 bg-transparent h-9 text-xs font-mono focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
            disabled={isIngesting}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isIngesting || !quickUrl.trim()}
            className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5 shrink-0 px-3.5"
          >
            {isIngesting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Zap className="size-3.5 fill-current" />
            )}
            <span>Ingest</span>
          </Button>
        </form>
      </div>

      {/* 2. Visual 4-Stage Pipeline Roadmap */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="size-3.5" />
            <span>Content Pipeline Status</span>
          </h2>
          <span className="text-[11px] font-mono text-muted-foreground">
            Weekly Goal: {data.weeklyTarget.posted}/{data.weeklyTarget.target} posted ({weeklyPct}%)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stage 1: INBOX */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3 flex flex-col justify-between hover:border-foreground/30 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/60">
                  Step 01
                </span>
                <Inbox className="size-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-black font-display tracking-tight text-foreground">
                  {data.counts.inbox}
                </div>
                <div className="text-xs font-mono font-medium text-foreground">
                  Inbox Triage
                </div>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  Raw saved links waiting for review &amp; breakdown
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Link href={data.counts.inbox > 0 ? "/inbox/triage" : "/inbox"}>
                <Button
                  size="sm"
                  className="w-full text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
                >
                  <Play className="size-3 fill-current" />
                  <span>{data.counts.inbox > 0 ? "Start Triage" : "Open Inbox"}</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Stage 2: CURATED REFERENCES */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3 flex flex-col justify-between hover:border-foreground/30 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  Step 02
                </span>
                <Bookmark className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="text-2xl font-black font-display tracking-tight text-foreground">
                  {data.counts.statuses.selected}
                </div>
                <div className="text-xs font-mono font-medium text-foreground">
                  Selected Inspiration
                </div>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  Validated ideas ready to be adapted into content
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/contents/new">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs font-mono h-8 font-bold border-border hover:bg-secondary text-foreground gap-1.5"
                >
                  <Plus className="size-3" />
                  <span>Draft Content</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Stage 3: PRODUCTION STUDIO */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3 flex flex-col justify-between hover:border-foreground/30 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                  Step 03
                </span>
                <FileVideo className="size-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-black font-display tracking-tight text-foreground">
                  {data.counts.statuses.production}
                </div>
                <div className="text-xs font-mono font-medium text-foreground">
                  In Production
                </div>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  Scripts being written, filmed, and edited
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/contents">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs font-mono h-8 font-bold border-border hover:bg-secondary text-foreground gap-1.5"
                >
                  <Layers className="size-3" />
                  <span>Open Studio</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Stage 4: EVALUATION & CHECKPOINTS */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3 flex flex-col justify-between hover:border-foreground/30 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30">
                  Step 04
                </span>
                <CheckSquare className="size-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-black font-display tracking-tight text-foreground">
                  {data.counts.evaluate}
                </div>
                <div className="text-xs font-mono font-medium text-foreground">
                  Checkpoints Due
                </div>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  24h, 7d, 30d views & retention reviews
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/evaluate">
                <Button
                  size="sm"
                  className={`w-full text-xs font-mono h-8 font-bold gap-1.5 ${
                    data.counts.evaluate > 0
                      ? "bg-foreground text-background font-black"
                      : "bg-secondary text-muted-foreground border border-border"
                  }`}
                >
                  <BarChart3 className="size-3" />
                  <span>{data.counts.evaluate > 0 ? "Review Now" : "View Tracker"}</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Lower Grid: Active Studio Radar & Recent Ingested References */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Active Working Scripts */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <FileText className="size-3.5" />
                <span>Active Production Studio</span>
              </h3>
              <Link href="/contents" className="text-[11px] font-mono text-muted-foreground hover:text-foreground">
                View all →
              </Link>
            </div>

            {data.activeContents.length === 0 ? (
              <div className="p-8 text-center rounded border border-dashed border-border bg-secondary/30 space-y-2">
                <FileVideo className="size-6 mx-auto text-muted-foreground" />
                <p className="text-xs font-mono text-muted-foreground">
                  No active scripts in progress. Pick a curated reference or create a new original content piece.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.activeContents.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contents/${c.id}`}
                    className="block p-3 rounded border border-border bg-secondary/30 hover:border-foreground/40 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-foreground group-hover:underline line-clamp-1">
                        {c.title}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.checklistTotal > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
                            {c.checklistDone}/{c.checklistTotal}
                          </span>
                        )}
                        {c.formatName && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-foreground text-background uppercase tracking-wider">
                            {c.formatName}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link href="/contents/new" className="pt-2">
            <Button variant="outline" size="sm" className="w-full text-xs font-mono h-8 gap-1.5">
              <Plus className="size-3" />
              <span>Create New Content Piece</span>
            </Button>
          </Link>
        </div>

        {/* Right: Recent Ingested References */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                <span>Recently Ingested Inspiration</span>
              </h3>
              <Link href="/references" className="text-[11px] font-mono text-muted-foreground hover:text-foreground">
                Browse Library →
              </Link>
            </div>

            {data.recentRefs.length === 0 ? (
              <div className="p-8 text-center rounded border border-dashed border-border bg-secondary/30 space-y-2">
                <Bookmark className="size-6 mx-auto text-muted-foreground" />
                <p className="text-xs font-mono text-muted-foreground">
                  No references ingested yet. Paste your first video link above to get started!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentRefs.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded border border-border bg-secondary/20 hover:border-foreground/30 transition-colors"
                  >
                    <Link
                      href={`/references/${r.id}`}
                      className="text-xs font-mono text-foreground hover:underline line-clamp-1 flex-1"
                    >
                      {r.summary || r.url}
                    </Link>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge status={r.status} size="sm" />
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href="/inbox" className="pt-2">
            <Button variant="outline" size="sm" className="w-full text-xs font-mono h-8 gap-1.5">
              <Inbox className="size-3" />
              <span>Open Ingest Inbox</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function BarChart3(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}
