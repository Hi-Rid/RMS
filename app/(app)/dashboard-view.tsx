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
  Compass,
  CornerDownLeft,
  FileText,
  Globe,
  Inbox,
  Layers,
  LineChart,
  Lock,
  MessageSquare,
  Music,
  Plus,
  Quote,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  X,
  Zap,
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
  const [focusCardDismissed, setFocusCardDismissed] = React.useState(false);
  const [queryInput, setQueryInput] = React.useState("");

  // Compute completed steps
  const hasRefs = data.counts.references > 0;
  const hasContents = data.counts.contents > 0;
  const hasPosts = data.weeklyTarget.posted > 0;
  const completedSteps = (hasRefs ? 1 : 0) + (hasContents ? 1 : 0) + (hasPosts ? 1 : 0);

  // User display name from email (e.g. "Elise" from "elise@domain.com")
  const displayName = React.useMemo(() => {
    if (!ownerEmail) return "Elise";
    const localPart = ownerEmail.split("@")[0];
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }, [ownerEmail]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCommandOpen(true);
  };

  return (
    <div className="relative min-h-full w-full py-10 px-4 sm:px-8 flex flex-col items-center">
      {/* Subtle fine dot/grid pattern background matching editorial style */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(var(--border) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative w-full max-w-2xl flex flex-col items-center space-y-8">
        {/* 1. Centered Hero Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="size-11 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display font-black text-xl shadow-none">
            F
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground font-display">
            Hi, {displayName}
          </h1>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            What will you create today?
          </p>
        </div>

        {/* 2. Central Prompt / Command Box (Eksis Layout Twin) */}
        <div className="w-full space-y-3">
          <div
            onClick={() => setCommandOpen(true)}
            className="w-full rounded-xl bg-card border border-border p-3.5 sm:p-4 cursor-pointer hover:border-foreground/30 transition-all shadow-none group"
          >
            {/* Top Text / Prompt Line */}
            <div className="flex items-start justify-between min-h-[44px]">
              <span className="text-xs sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors select-none font-sans">
                Ask about your channels, posts, or what to post next
              </span>
            </div>

            {/* Bottom Controls Bar inside the box */}
            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground border border-border/60">
                  <Globe className="size-3 text-muted-foreground" />
                  <span>Search the web</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider bg-secondary/60 text-muted-foreground border border-border/40">
                  <Zap className="size-3" />
                  <span>Off</span>
                  <Lock className="size-2.5" />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border hidden sm:inline-block">
                  ⌘K
                </kbd>
                <div className="size-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                  <Send className="size-3.5 -rotate-45" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Category Buttons row (Matching Eksis layout) */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <div className="flex items-center justify-center flex-wrap gap-2">
              <CategoryPill
                href="/insight"
                icon={<LineChart className="size-3.5" />}
                label="Analytics"
              />
              <CategoryPill
                href="/planner"
                icon={<Calendar className="size-3.5" />}
                label="Planning"
              />
              <CategoryPill
                href="/captions"
                icon={<Quote className="size-3.5" />}
                label="Captions"
              />
              <CategoryPill
                href="/references"
                icon={<Bookmark className="size-3.5" />}
                label="References"
                count={data.counts.references}
              />
              <CategoryPill
                href="/inbox"
                icon={<TrendingUp className="size-3.5" />}
                label="Trends"
                count={data.counts.inbox}
              />
            </div>
            <div className="flex items-center justify-center">
              <CategoryPill
                href="/evaluate"
                icon={<Zap className="size-3.5 text-foreground" />}
                label="Automations"
                count={data.counts.evaluate}
                highlight={data.counts.evaluate > 0}
              />
            </div>
          </div>
        </div>

        {/* 3. Main Focus Card: "Get your first post out" (Matching Eksis layout) */}
        {!focusCardDismissed && (
          <Card className="w-full rounded-xl border bg-card p-6 shadow-none">
            <div className="space-y-6">
              {/* Card Header with Dismiss Button */}
              <div className="flex items-start justify-between border-b border-border/70 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="size-3.5" />
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                      First post
                    </span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground font-display">
                    Get your first post out
                  </h2>
                  <p className="text-xs font-mono text-muted-foreground">
                    {completedSteps} of 3 done
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFocusCardDismissed(true)}
                  className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center transition-colors"
                  aria-label="Dismiss guide"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Step Checklist */}
              <div className="space-y-5">
                {/* Step 1: Connect / Add Reference */}
                <div className="flex items-start gap-4">
                  <div
                    className={`size-6 shrink-0 rounded-md flex items-center justify-center font-mono text-xs font-bold ${
                      hasRefs
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {hasRefs ? <CheckCircle2 className="size-3.5" /> : "1"}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Connect a channel
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Pick the account Folio collects from or capture your first reference link.
                      </p>
                    </div>
                    {!hasRefs && (
                      <Button
                        size="sm"
                        onClick={() => setAddLinksOpen(true)}
                        className="h-8 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider px-3"
                      >
                        <Plus className="size-3.5 mr-1" />
                        <span>Connect a channel</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Step 2: Write your first post */}
                <div className="flex items-start gap-4">
                  <div
                    className={`size-6 shrink-0 rounded-md flex items-center justify-center font-mono text-xs font-bold ${
                      hasContents
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground border border-border"
                    }`}
                  >
                    {hasContents ? <CheckCircle2 className="size-3.5" /> : "2"}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Write your first post
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Draft your script, hook breakdown, and visual style notes.
                      </p>
                    </div>
                    {hasRefs && !hasContents && (
                      <Link href="/contents/new">
                        <Button
                          size="sm"
                          className="h-8 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider px-3"
                        >
                          <Plus className="size-3.5 mr-1" />
                          <span>Write first post</span>
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Step 3: Schedule or publish it */}
                <div className="flex items-start gap-4">
                  <div
                    className={`size-6 shrink-0 rounded-md flex items-center justify-center font-mono text-xs font-bold ${
                      hasPosts
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground border border-border"
                    }`}
                  >
                    {hasPosts ? <CheckCircle2 className="size-3.5" /> : "3"}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Schedule or publish it
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Schedule your content and log performance checkpoints at 24h, 7d, and 30d.
                      </p>
                    </div>
                    {hasContents && !hasPosts && (
                      <Link href="/contents">
                        <Button
                          size="sm"
                          className="h-8 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider px-3"
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
        )}

        {/* 4. Bottom Two-Column Section (Matching Eksis layout) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column: Ask Folio AI */}
          <Card className="rounded-xl border bg-card p-5 shadow-none flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-foreground" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                  Ask Folio AI
                </h3>
              </div>

              <div className="space-y-2.5">
                {/* Action 1: Find timely topics */}
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="w-full text-left p-3 rounded-lg bg-secondary/40 hover:bg-secondary border border-border/50 transition-colors flex items-start gap-3 group"
                >
                  <div className="size-6 shrink-0 rounded-md bg-foreground/10 text-foreground flex items-center justify-center mt-0.5">
                    <TrendingUp className="size-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      Find timely topics
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      What is in News this week
                    </div>
                  </div>
                  <ArrowRight className="size-3 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all mt-1" />
                </button>

                {/* Action 2: Plan next week */}
                <Link
                  href="/planner"
                  className="block p-3 rounded-lg bg-secondary/40 hover:bg-secondary border border-border/50 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="size-6 shrink-0 rounded-md bg-foreground/10 text-foreground flex items-center justify-center mt-0.5">
                      <Calendar className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        Plan next week
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        A dated plan you can turn into drafts
                      </div>
                    </div>
                    <ArrowRight className="size-3 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all mt-1" />
                  </div>
                </Link>
              </div>
            </div>
          </Card>

          {/* Right Column: Next up */}
          <Card className="rounded-xl border bg-card p-5 shadow-none flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-foreground" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                  Next up
                </h3>
              </div>

              {data.counts.evaluate > 0 ? (
                <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-destructive">
                      {data.counts.evaluate} checkpoint{data.counts.evaluate > 1 ? "s" : ""} due
                    </span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-destructive text-destructive-foreground font-bold">
                      DUE NOW
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Record your 24h, 7d, or 30d views and retention metrics to assess performance.
                  </p>
                  <Link href="/evaluate" className="block pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 rounded-md text-xs font-mono uppercase tracking-wider"
                    >
                      <span>Review checkpoints</span>
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="py-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    No scheduled posts yet. Create the first one and it shows up here.
                  </p>
                  <Link href="/contents/new" className="block">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-md text-xs font-mono uppercase tracking-wider px-3"
                    >
                      <Plus className="size-3.5 mr-1" />
                      <span>Create post</span>
                    </Button>
                  </Link>
                </div>
              )}
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

function CategoryPill({
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-secondary text-foreground/80 hover:text-foreground transition-all shadow-none ${
        highlight ? "border-destructive/40 text-destructive" : ""
      }`}
    >
      {icon}
      <span>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
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
