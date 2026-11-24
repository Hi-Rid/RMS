"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  ExternalLink,
  Inbox,
  Layers,
  LineChart,
  Music,
  Plus,
  Quote,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CommandPalette } from "@/components/app/command-palette";
import { AddLinksDialog } from "@/components/app/add-links-dialog";
import type { HomeData } from "@/lib/queries/home";

interface DashboardViewProps {
  data: HomeData;
  ownerEmail?: string;
}

export function DashboardView({ data, ownerEmail }: DashboardViewProps) {
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [addLinksOpen, setAddLinksOpen] = React.useState(false);

  // Compute completed steps
  const hasRefs = data.counts.references > 0;
  const hasContents = data.counts.contents > 0;
  const hasPosts = data.weeklyTarget.posted > 0;
  const completedSteps = (hasRefs ? 1 : 0) + (hasContents ? 1 : 0) + (hasPosts ? 1 : 0);

  // User display name from email (e.g. "elise" from "elise@domain.com")
  const displayName = React.useMemo(() => {
    if (!ownerEmail) return "Creator";
    const localPart = ownerEmail.split("@")[0];
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }, [ownerEmail]);

  return (
    <div className="relative min-h-full w-full py-10 px-4 sm:px-8 flex flex-col items-center">
      {/* Subtle fine dot/grid pattern background matching editorial style */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: `radial-gradient(var(--border) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative w-full max-w-2xl flex flex-col items-center space-y-8">
        {/* 1. Centered Hero Greeting Header (matching uploaded screenshot) */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="size-12 rounded-control bg-primary text-primary-foreground flex items-center justify-center font-display font-black text-xl shadow-none">
            F
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground font-display">
            Hi, {displayName}
          </h1>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            What will you create today?
          </p>
        </div>

        {/* 2. Centered Search / Command Bar (matching uploaded screenshot) */}
        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="w-full h-[46px] rounded-control bg-background border border-border px-4 flex items-center justify-between text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-all shadow-none group"
          >
            <div className="flex items-center gap-3">
              <Search className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-xs sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Search references, contents, or what to post next...
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border">
                /
              </kbd>
              <kbd className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border hidden sm:inline-block">
                ⌘K
              </kbd>
            </div>
          </button>

          {/* Quick Action Pills row directly below the search bar */}
          <div className="flex items-center justify-center flex-wrap gap-2 pt-1">
            <PillButton
              href="/inbox"
              icon={<Inbox className="size-3.5" />}
              label="Inbox"
              count={data.counts.inbox}
            />
            <PillButton
              href="/references"
              icon={<Bookmark className="size-3.5" />}
              label="References"
              count={data.counts.references}
            />
            <PillButton
              href="/contents"
              icon={<Layers className="size-3.5" />}
              label="Contents"
              count={data.counts.contents}
            />
            <PillButton
              href="/evaluate"
              icon={<CheckSquare className="size-3.5" />}
              label="Evaluate"
              count={data.counts.evaluate}
              highlight={data.counts.evaluate > 0}
            />
            <PillButton
              href="/planner"
              icon={<Calendar className="size-3.5" />}
              label="Planning"
            />
            <PillButton
              href="/captions"
              icon={<Quote className="size-3.5" />}
              label="Captions"
            />
            <PillButton
              href="/insight"
              icon={<LineChart className="size-3.5" />}
              label="Analytics"
            />
          </div>
        </div>

        {/* 3. Main Focus Card: "Get your first post out" (matching uploaded screenshot) */}
        <Card className="w-full rounded-lg border bg-card p-6 shadow-none">
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b border-border/70 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                    FIRST POST
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground font-display">
                  Get your first post out
                </h2>
                <p className="text-xs font-mono text-muted-foreground">
                  {completedSteps} of 3 done
                </p>
              </div>
              <div className="size-7 rounded-full bg-secondary flex items-center justify-center font-mono text-xs font-bold text-foreground">
                {completedSteps}/3
              </div>
            </div>

            <div className="space-y-5">
              {/* Step 1: Save reference */}
              <div className="flex items-start gap-4">
                <div
                  className={`size-7 shrink-0 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                    hasRefs
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground border border-border"
                  }`}
                >
                  {hasRefs ? <CheckCircle2 className="size-4" /> : "1"}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Save a reference
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Capture high-performing reels or posts from Instagram, TikTok, or YouTube to adapt.
                    </p>
                  </div>
                  {!hasRefs && (
                    <Button
                      size="sm"
                      onClick={() => setAddLinksOpen(true)}
                      className="h-8 rounded-control bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider px-3"
                    >
                      <Plus className="size-3.5 mr-1" />
                      <span>Add reference</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 2: Adapt into original content */}
              <div className="flex items-start gap-4">
                <div
                  className={`size-7 shrink-0 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                    hasContents
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground border border-border"
                  }`}
                >
                  {hasContents ? <CheckCircle2 className="size-4" /> : "2"}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Write your first content draft
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Break down hooks, audio, and visual styles to craft your own adaptation.
                    </p>
                  </div>
                  {hasRefs && !hasContents && (
                    <Link href="/contents/new">
                      <Button
                        size="sm"
                        className="h-8 rounded-control bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider px-3"
                      >
                        <Plus className="size-3.5 mr-1" />
                        <span>Create content</span>
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {/* Step 3: Schedule or publish */}
              <div className="flex items-start gap-4">
                <div
                  className={`size-7 shrink-0 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                    hasPosts
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground border border-border"
                  }`}
                >
                  {hasPosts ? <CheckCircle2 className="size-4" /> : "3"}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Schedule, publish & evaluate
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Log your live post to schedule automatic checkpoints at 24h, 7d, and 30d.
                    </p>
                  </div>
                  {hasContents && !hasPosts && (
                    <Link href="/contents">
                      <Button
                        size="sm"
                        className="h-8 rounded-control bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider px-3"
                      >
                        <span>Open contents</span>
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 4. Bottom Two-Column Grid (matching uploaded screenshot) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column: Recent References */}
          <Card className="rounded-lg border bg-card p-4 shadow-none flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="size-4 text-foreground" />
                  <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                    Recent References
                  </h3>
                </div>
                <Link
                  href="/references"
                  className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                >
                  <span>View all</span>
                  <ArrowUpRight className="size-3" />
                </Link>
              </div>

              {data.recentRefs.length > 0 ? (
                <div className="space-y-2">
                  {data.recentRefs.slice(0, 3).map((ref) => (
                    <Link
                      key={ref.id}
                      href={`/references/${ref.id}`}
                      className="block p-2 rounded-md bg-secondary/50 hover:bg-secondary border border-border/50 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground truncate max-w-[200px]">
                          {ref.summary || "Untitled Reference"}
                        </span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-background text-muted-foreground">
                          {ref.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    No references saved yet. Tap &apos;+ Add reference&apos; to paste your first link.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border/50 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddLinksOpen(true)}
                className="w-full h-8 rounded-control text-xs font-mono uppercase tracking-wider"
              >
                <Plus className="size-3 mr-1" />
                <span>Add reference</span>
              </Button>
            </div>
          </Card>

          {/* Right Column: Next Up & Checkpoints */}
          <Card className="rounded-lg border bg-card p-4 shadow-none flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-foreground" />
                  <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                    Next up
                  </h3>
                </div>
                <Link
                  href="/evaluate"
                  className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                >
                  <span>Evaluate</span>
                  <ArrowUpRight className="size-3" />
                </Link>
              </div>

              {data.counts.evaluate > 0 ? (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-destructive">
                      {data.counts.evaluate} checkpoint{data.counts.evaluate > 1 ? "s" : ""} due
                    </span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground font-bold">
                      DUE NOW
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Record your 24h, 7d, or 30d views and retention metrics to assess performance.
                  </p>
                </div>
              ) : (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    No scheduled posts due yet. Create and publish a post to track performance checkpoints.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border/50 mt-3">
              <Link href="/contents/new" className="w-full block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 rounded-control text-xs font-mono uppercase tracking-wider"
                >
                  <Plus className="size-3 mr-1" />
                  <span>Create content</span>
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onOpenAddLinks={() => setAddLinksOpen(true)}
      />

      {/* Global Add Links Dialog */}
      <AddLinksDialog
        open={addLinksOpen}
        onOpenChange={setAddLinksOpen}
      />
    </div>
  );
}

function PillButton({
  href,
  icon,
  label,
  count,
  highlight,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-medium border border-border bg-background hover:bg-secondary text-foreground/80 hover:text-foreground transition-all shadow-none ${
        highlight ? "border-destructive/40 text-destructive" : ""
      }`}
    >
      {icon}
      <span>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
            highlight
              ? "bg-destructive text-destructive-foreground font-bold"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
