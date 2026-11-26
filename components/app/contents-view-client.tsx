"use client";

import * as React from "react";
import { useState, useEffect, useTransition, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckSquare,
  LayoutGrid,
  List as ListIcon,
  Columns3,
  Link as LinkIcon,
  Send,
  Calendar,
  ExternalLink,
  Archive,
  RotateCcw,
  Star,
  X,
  ArrowRight,
  Music,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import {
  archiveContent,
  restoreContent,
  bulkUpdateContents,
} from "@/lib/actions/contents";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ContentListItem } from "@/lib/queries/contents";

interface ContentsViewClientProps {
  items: ContentListItem[];
  todayIso: string;
  isArchivedView?: boolean;
  activeStatusFilter?: string;
}

const VIEW_STORAGE_KEY = "rms.contentsViewMode";
const VIEW_EVENT = "rms:contents-viewmode";

function subscribeViewMode(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(VIEW_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(VIEW_EVENT, callback);
  };
}

function getViewModeSnapshot(): "grid" | "list" | "board" {
  try {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === "list" || saved === "board" ? saved : "grid";
  } catch {
    return "grid";
  }
}

function getServerViewModeSnapshot(): "grid" | "list" | "board" {
  return "grid";
}

const BOARD_STAGES = [
  { status: "production", label: "Production", hint: "Scripting & shooting" },
  { status: "posted", label: "Posted", hint: "Published & awaiting rating" },
  { status: "evaluating", label: "Evaluating", hint: "Tracking checkpoints" },
] as const;

function formatShortIsoDate(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const d = new Date(
    Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  );
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function getScheduleMeta(
  plannedFor: string | null,
  status: string,
  todayIso: string
): { label: string; tone: "overdue" | "today" | "upcoming" | "normal" } | null {
  if (!plannedFor) return null;
  if (status === "production") {
    if (plannedFor < todayIso) {
      return {
        label: `Overdue · ${formatShortIsoDate(plannedFor)}`,
        tone: "overdue",
      };
    }
    if (plannedFor === todayIso) {
      return { label: "Today", tone: "today" };
    }
    return { label: formatShortIsoDate(plannedFor), tone: "upcoming" };
  }
  return { label: formatShortIsoDate(plannedFor), tone: "normal" };
}

export function ContentsViewClient({
  items,
  todayIso,
  isArchivedView = false,
  activeStatusFilter = "all",
}: ContentsViewClientProps) {
  const router = useRouter();
  const viewMode = useSyncExternalStore(
    subscribeViewMode,
    getViewModeSnapshot,
    getServerViewModeSnapshot
  );
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedIds([]);
        setSelectMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectMode]);

  const handleViewChange = (next: "grid" | "list" | "board") => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
      window.dispatchEvent(new Event(VIEW_EVENT));
    } catch {
      // Ignore storage errors
    }
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedIds(items.map((i) => i.id));
  const clearSelection = () => setSelectedIds([]);
  const exitSelectMode = () => {
    setSelectedIds([]);
    setSelectMode(false);
  };

  const handleSingleArchiveToggle = (content: ContentListItem) => {
    setBusyRowId(content.id);
    startTransition(async () => {
      try {
        if (isArchivedView) {
          const res = await restoreContent({ id: content.id });
          if (!res.ok) {
            toast.error(res.error.message);
            return;
          }
          toast.success(`Restored "${content.title}"`, {
            action: {
              label: "Undo",
              onClick: async () => {
                await archiveContent({ id: content.id });
                router.refresh();
              },
            },
          });
        } else {
          const res = await archiveContent({ id: content.id });
          if (!res.ok) {
            toast.error(res.error.message);
            return;
          }
          toast.info(`Archived "${content.title}"`, {
            action: {
              label: "Undo",
              onClick: async () => {
                await restoreContent({ id: content.id });
                router.refresh();
              },
            },
          });
        }
        router.refresh();
      } finally {
        setBusyRowId(null);
      }
    });
  };

  const runBulkAction = (action: "archive" | "restore") => {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const res = await bulkUpdateContents({ ids: selectedIds, action });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        `${action === "archive" ? "Archived" : "Restored"} ${res.data.updatedCount} content item(s)`
      );
      setSelectedIds([]);
      setSelectMode(false);
      router.refresh();
    });
  };

  const visibleBoardStages = React.useMemo(() => {
    if (isArchivedView) return [];
    if (activeStatusFilter !== "all") {
      return BOARD_STAGES.filter((s) => s.status === activeStatusFilter);
    }
    return BOARD_STAGES;
  }, [activeStatusFilter, isArchivedView]);

  const effectiveViewMode = isArchivedView && viewMode === "board" ? "grid" : viewMode;

  return (
    <div className="space-y-4 pb-16">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            role="group"
            aria-label="View mode"
            className="inline-flex items-center rounded-md border border-border bg-card p-0.5"
          >
            <button
              type="button"
              onClick={() => handleViewChange("grid")}
              aria-pressed={effectiveViewMode === "grid"}
              className={cn(
                "h-7 px-2.5 rounded-sm text-xs font-mono inline-flex items-center gap-1.5 transition-colors",
                effectiveViewMode === "grid"
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-3.5" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("list")}
              aria-pressed={effectiveViewMode === "list"}
              className={cn(
                "h-7 px-2.5 rounded-sm text-xs font-mono inline-flex items-center gap-1.5 transition-colors",
                effectiveViewMode === "list"
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListIcon className="size-3.5" />
              <span>List</span>
            </button>
            {!isArchivedView && (
              <button
                type="button"
                onClick={() => handleViewChange("board")}
                aria-pressed={effectiveViewMode === "board"}
                className={cn(
                  "h-7 px-2.5 rounded-sm text-xs font-mono inline-flex items-center gap-1.5 transition-colors",
                  effectiveViewMode === "board"
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Columns3 className="size-3.5" />
                <span>Board</span>
              </button>
            )}
          </div>

          <Button
            type="button"
            variant={selectMode ? "default" : "outline"}
            size="sm"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            className={cn(
              "h-8 text-xs font-mono rounded-md gap-1.5",
              selectMode
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-card text-foreground border-border"
            )}
          >
            <CheckSquare className="size-3.5" />
            <span>{selectMode ? "Exit Select" : "Select Multiple"}</span>
          </Button>

          {selectMode && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="h-7 px-2 text-xs rounded-md"
              >
                Select All ({items.length})
              </Button>
              {selectedIds.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="h-7 px-2 text-xs rounded-md text-muted-foreground"
                >
                  Clear ({selectedIds.length})
                </Button>
              )}
              <span className="hidden md:inline text-[11px] text-muted-foreground">
                Esc to cancel
              </span>
            </div>
          )}
        </div>

        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          Showing {items.length} {items.length === 1 ? "content" : "contents"} on page
        </span>
      </div>

      {/* View 1: Editorial Studio Cards Grid */}
      {effectiveViewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((content) => {
            const isSelected = selectedIds.includes(content.id);
            const hasChecklist = content.checklistStats.total > 0;
            const checklistPct = hasChecklist
              ? Math.round(
                  (content.checklistStats.done / content.checklistStats.total) * 100
                )
              : 0;
            const checklistDone =
              hasChecklist &&
              content.checklistStats.done === content.checklistStats.total;
            const scheduleMeta = getScheduleMeta(
              content.plannedFor,
              content.status,
              todayIso
            );
            const isBusy = isPending && busyRowId === content.id;

            return (
              <article
                key={content.id}
                className={cn(
                  "group relative bg-card border rounded-lg p-5 flex flex-col justify-between gap-3.5 transition-colors",
                  isSelected
                    ? "border-brand bg-brand/5"
                    : "border-border hover:border-foreground/40"
                )}
              >
                {/* Top Row: Select Checkbox + Badges */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {selectMode && (
                        <div className="mr-1 flex items-center">
                          <Checkbox
                            aria-label={`Select ${content.title}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(content.id)}
                          />
                        </div>
                      )}
                      {content.format && (
                        <span className="text-[11px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border font-bold">
                          {content.format.name}
                        </span>
                      )}
                      {content.series && (
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/60 truncate max-w-[140px]">
                          {content.series.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {content.finalRating !== null && (
                        <span
                          title={`Final rating: ${content.finalRating}/5`}
                          className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30 tabular-nums"
                        >
                          <Star className="size-2.5 fill-current" />
                          <span>{content.finalRating}</span>
                        </span>
                      )}
                      <StatusBadge status={content.status} size="sm" />
                    </div>
                  </div>

                  {/* Title & Hook */}
                  <div className="space-y-1.5">
                    <Link
                      href={`/contents/${content.id}`}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm"
                    >
                      <h3 className="text-base font-black font-display tracking-tight text-foreground group-hover:text-brand transition-colors line-clamp-2">
                        {content.title}
                      </h3>
                    </Link>
                    {content.hookText && (
                      <p className="text-xs font-mono text-muted-foreground line-clamp-2">
                        &ldquo;{content.hookText}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Hook Type & Audio Metadata (sibling links!) */}
                  {(content.hookType || content.audio) && (
                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-muted-foreground">
                      {content.hookType && (
                        <span className="inline-flex items-center gap-1 text-foreground/80">
                          <Sparkles className="size-3 text-muted-foreground" />
                          <span>{content.hookType.name}</span>
                        </span>
                      )}
                      {content.audio && (
                        <Link
                          href={`/audio/${content.audio.id}`}
                          className="inline-flex items-center gap-1 hover:text-foreground hover:underline truncate max-w-[190px]"
                          title={content.audio.title}
                        >
                          <Music className="size-3 shrink-0" />
                          <span className="truncate">{content.audio.title}</span>
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Pillars (clickable filter pills) */}
                  {content.pillars.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {content.pillars.map((pillar) => (
                        <Link
                          key={pillar.id}
                          href={`/contents?pillar=${encodeURIComponent(pillar.slug)}`}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-secondary/80 text-foreground border border-border/80 font-medium hover:border-foreground/40 transition-colors"
                        >
                          {pillar.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Production Checklist Progress + Footer */}
                <div className="space-y-3 pt-2">
                  {hasChecklist && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
                        <span
                          className={cn(
                            "flex items-center gap-1",
                            checklistDone
                              ? "text-success font-bold"
                              : "text-muted-foreground"
                          )}
                        >
                          {checklistDone ? (
                            <CheckCircle2 className="size-3" />
                          ) : (
                            <CheckSquare className="size-3" />
                          )}
                          <span>
                            {content.checklistStats.done}/{content.checklistStats.total} steps
                          </span>
                        </span>
                        {checklistDone && content.status === "production" ? (
                          <span className="text-success font-semibold uppercase tracking-wider">
                            Ready to post
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{checklistPct}%</span>
                        )}
                      </div>
                      <div className="h-1.5 w-full rounded-sm bg-secondary overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            checklistDone ? "bg-success" : "bg-foreground/80"
                          )}
                          style={{ width: `${checklistPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-border/70 flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-2.5 flex-wrap tabular-nums">
                      {scheduleMeta && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            scheduleMeta.tone === "overdue" && "text-warning font-semibold",
                            scheduleMeta.tone === "today" && "text-brand font-semibold",
                            scheduleMeta.tone === "upcoming" && "text-foreground font-medium"
                          )}
                        >
                          <Calendar className="size-3" />
                          <span>{scheduleMeta.label}</span>
                        </span>
                      )}

                      {content.refsCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <LinkIcon className="size-3" />
                          <span>
                            {content.refsCount} ref{content.refsCount > 1 ? "s" : ""}
                          </span>
                        </span>
                      )}

                      {content.postsCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                          <Send className="size-3" />
                          <span>
                            {content.postsCount} post{content.postsCount > 1 ? "s" : ""}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {content.workUrl && (
                        <a
                          href={content.workUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open work asset link"
                          title="Open work asset"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSingleArchiveToggle(content)}
                        aria-label={isArchivedView ? "Restore content" : "Archive content"}
                        title={isArchivedView ? "Restore from archive" : "Archive content"}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors disabled:opacity-50"
                      >
                        {isArchivedView ? (
                          <RotateCcw className="size-3.5" />
                        ) : (
                          <Archive className="size-3.5" />
                        )}
                      </button>
                      <Link
                        href={`/contents/${content.id}`}
                        className="h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-mono font-semibold text-foreground hover:bg-secondary transition-colors"
                      >
                        <span>Studio</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* View 2: Dense Editorial List Table */}
      {effectiveViewMode === "list" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="hidden lg:grid lg:grid-cols-[28px_minmax(0,2.1fr)_minmax(0,1fr)_130px_140px_104px_160px] items-center gap-3 px-4 py-2.5 border-b border-border/80 bg-secondary/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <div className="w-6 flex items-center justify-center">
              {selectMode ? (
                <Checkbox
                  aria-label="Select all on page"
                  checked={items.length > 0 && selectedIds.length === items.length}
                  onCheckedChange={(checked) => {
                    if (checked) selectAll();
                    else clearSelection();
                  }}
                />
              ) : (
                <span>#</span>
              )}
            </div>
            <div>Title &amp; Hook</div>
            <div>Pillars</div>
            <div>Checklist</div>
            <div>Schedule &amp; Links</div>
            <div>Stage</div>
            <div className="text-right">Actions</div>
          </div>

          <div className="divide-y divide-border/70">
            {items.map((content, idx) => {
              const isSelected = selectedIds.includes(content.id);
              const hasChecklist = content.checklistStats.total > 0;
              const checklistPct = hasChecklist
                ? Math.round(
                    (content.checklistStats.done / content.checklistStats.total) * 100
                  )
                : 0;
              const checklistDone =
                hasChecklist &&
                content.checklistStats.done === content.checklistStats.total;
              const scheduleMeta = getScheduleMeta(
                content.plannedFor,
                content.status,
                todayIso
              );
              const isBusy = isPending && busyRowId === content.id;

              return (
                <div
                  key={content.id}
                  className={cn(
                    "grid grid-cols-1 lg:grid-cols-[28px_minmax(0,2.1fr)_minmax(0,1fr)_130px_140px_104px_160px] items-start lg:items-center gap-3 px-4 py-3 transition-colors",
                    isSelected ? "bg-brand/5" : "hover:bg-secondary/30"
                  )}
                >
                  <div className="hidden lg:flex w-6 items-center justify-center">
                    {selectMode ? (
                      <Checkbox
                        aria-label={`Select ${content.title}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleItem(content.id)}
                      />
                    ) : (
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Title & Attribution */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectMode && (
                        <div className="lg:hidden shrink-0">
                          <Checkbox
                            aria-label={`Select ${content.title}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(content.id)}
                          />
                        </div>
                      )}
                      {content.format && (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary border border-border/80 text-foreground shrink-0 font-bold">
                          {content.format.name}
                        </span>
                      )}
                      {content.series && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 border border-border/60 text-muted-foreground shrink-0">
                          {content.series.name}
                        </span>
                      )}
                      <Link
                        href={`/contents/${content.id}`}
                        className="text-sm font-bold font-display text-foreground hover:text-brand transition-colors truncate"
                      >
                        {content.title}
                      </Link>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-muted-foreground">
                      {content.hookText && (
                        <span className="truncate max-w-[320px]">
                          &ldquo;{content.hookText}&rdquo;
                        </span>
                      )}
                      {content.hookType && (
                        <span className="text-foreground/80">· {content.hookType.name}</span>
                      )}
                      {content.audio && (
                        <Link
                          href={`/audio/${content.audio.id}`}
                          className="hover:text-foreground hover:underline truncate max-w-[160px]"
                        >
                          · {content.audio.title}
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Pillars */}
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {content.pillars.length > 0 ? (
                      <>
                        {content.pillars.slice(0, 2).map((p) => (
                          <Link
                            key={p.id}
                            href={`/contents?pillar=${encodeURIComponent(p.slug)}`}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/80 border border-border/80 text-foreground hover:border-foreground/40 transition-colors"
                          >
                            {p.name}
                          </Link>
                        ))}
                        {content.pillars.length > 2 && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            +{content.pillars.length - 2}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] font-mono text-muted-foreground/70">
                        No pillar
                      </span>
                    )}
                  </div>

                  {/* Checklist Progress */}
                  <div className="space-y-1">
                    {hasChecklist ? (
                      <>
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                          <span className={checklistDone ? "text-success font-bold" : "text-foreground"}>
                            {content.checklistStats.done}/{content.checklistStats.total}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {checklistPct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-sm bg-secondary overflow-hidden">
                          <div
                            className={cn(
                              "h-full",
                              checklistDone ? "bg-success" : "bg-foreground/80"
                            )}
                            style={{ width: `${checklistPct}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <span className="text-[11px] font-mono text-muted-foreground/70">
                        —
                      </span>
                    )}
                  </div>

                  {/* Schedule & Refs/Posts */}
                  <div className="space-y-0.5 text-[11px] font-mono tabular-nums text-muted-foreground">
                    {scheduleMeta ? (
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          scheduleMeta.tone === "overdue" && "text-warning font-semibold",
                          scheduleMeta.tone === "today" && "text-brand font-semibold",
                          scheduleMeta.tone === "upcoming" && "text-foreground font-medium"
                        )}
                      >
                        <Calendar className="size-3 shrink-0" />
                        <span className="truncate">{scheduleMeta.label}</span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground/60">Unscheduled</div>
                    )}
                    <div className="flex items-center gap-2 text-[10px]">
                      <span>{content.refsCount} refs</span>
                      <span>·</span>
                      <span>{content.postsCount} posts</span>
                      {content.finalRating !== null && (
                        <>
                          <span>·</span>
                          <span className="text-warning font-bold">
                            ★ {content.finalRating}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stage */}
                  <div>
                    <StatusBadge status={content.status} size="sm" />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-start lg:justify-end gap-1">
                    {content.workUrl && (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <a
                          href={content.workUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open work asset link"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleSingleArchiveToggle(content)}
                      aria-label={isArchivedView ? "Restore content" : "Archive content"}
                      className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                    >
                      {isArchivedView ? (
                        <RotateCcw className="size-3.5" />
                      ) : (
                        <Archive className="size-3.5" />
                      )}
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-[11px] font-mono rounded-md gap-1"
                    >
                      <Link href={`/contents/${content.id}`}>
                        <span>Studio</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View 3: Pipeline Kanban Board */}
      {effectiveViewMode === "board" && (
        <div
          className={cn(
            "grid gap-4",
            visibleBoardStages.length === 1
              ? "grid-cols-1"
              : "grid-cols-1 lg:grid-cols-3"
          )}
        >
          {visibleBoardStages.map((stage) => {
            const stageItems = items.filter((item) => item.status === stage.status);
            return (
              <section
                key={stage.status}
                className="bg-secondary/35 border border-border rounded-lg p-3.5 space-y-3 flex flex-col"
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/70">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={stage.status} size="sm" />
                      <span className="text-xs font-mono font-bold tabular-nums text-foreground">
                        {stageItems.length}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground mt-1">
                      {stage.hint}
                    </p>
                  </div>
                </div>

                {stageItems.length === 0 ? (
                  <div className="py-8 text-center text-xs font-mono text-muted-foreground border border-dashed border-border/70 rounded-md bg-card/50">
                    No {stage.label.toLowerCase()} items on this page
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {stageItems.map((content) => {
                      const isSelected = selectedIds.includes(content.id);
                      const scheduleMeta = getScheduleMeta(
                        content.plannedFor,
                        content.status,
                        todayIso
                      );
                      const hasChecklist = content.checklistStats.total > 0;
                      const checklistDone =
                        hasChecklist &&
                        content.checklistStats.done === content.checklistStats.total;
                      return (
                        <div
                          key={content.id}
                          className={cn(
                            "bg-card border rounded-md p-3.5 space-y-2.5 transition-colors",
                            isSelected
                              ? "border-brand bg-brand/5"
                              : "border-border hover:border-foreground/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              {selectMode && (
                                <Checkbox
                                  aria-label={`Select ${content.title}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleItem(content.id)}
                                />
                              )}
                              {content.format && (
                                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary border border-border/80 font-bold">
                                  {content.format.name}
                                </span>
                              )}
                              {content.series && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground truncate max-w-[120px]">
                                  {content.series.name}
                                </span>
                              )}
                            </div>
                            {content.finalRating !== null && (
                              <span className="text-[10px] font-mono font-bold text-warning inline-flex items-center gap-0.5 shrink-0">
                                <Star className="size-2.5 fill-current" />
                                <span>{content.finalRating}</span>
                              </span>
                            )}
                          </div>

                          <Link
                            href={`/contents/${content.id}`}
                            className="block text-sm font-black font-display text-foreground hover:text-brand line-clamp-2 transition-colors"
                          >
                            {content.title}
                          </Link>

                          {content.hookText && (
                            <p className="text-[11px] font-mono text-muted-foreground line-clamp-2">
                              &ldquo;{content.hookText}&rdquo;
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 text-[11px] font-mono text-muted-foreground tabular-nums">
                            <div className="flex items-center gap-2">
                              {hasChecklist && (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1",
                                    checklistDone && "text-success font-bold"
                                  )}
                                >
                                  <CheckSquare className="size-3" />
                                  <span>
                                    {content.checklistStats.done}/{content.checklistStats.total}
                                  </span>
                                </span>
                              )}
                              {scheduleMeta && (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1",
                                    scheduleMeta.tone === "overdue" && "text-warning font-semibold",
                                    scheduleMeta.tone === "today" && "text-brand font-semibold"
                                  )}
                                >
                                  <Calendar className="size-3" />
                                  <span>{scheduleMeta.label}</span>
                                </span>
                              )}
                            </div>
                            <Link
                              href={`/contents/${content.id}`}
                              className="text-foreground hover:text-brand font-semibold inline-flex items-center gap-0.5"
                            >
                              <span>Open</span>
                              <ArrowRight className="size-3" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-xl bg-card border-2 border-foreground rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-6 px-2 rounded bg-foreground text-background text-xs font-mono font-bold flex items-center justify-center tabular-nums">
              {selectedIds.length}
            </span>
            <span className="text-xs font-mono font-semibold text-foreground">
              selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => runBulkAction(isArchivedView ? "restore" : "archive")}
              className={cn(
                "h-8 text-xs font-mono font-semibold rounded-md gap-1.5",
                isArchivedView
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {isArchivedView ? (
                <>
                  <RotateCcw className="size-3.5" />
                  <span>Restore</span>
                </>
              ) : (
                <>
                  <Archive className="size-3.5" />
                  <span>Archive</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={exitSelectMode}
              aria-label="Clear selection"
              className="h-8 w-8 p-0 rounded-md"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
