"use client";

import * as React from "react";
import { useState, useTransition, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReferenceCard } from "@/components/app/reference-card";
import { CaptureSheet } from "@/components/app/capture-sheet";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckSquare,
  Check,
  SkipForward,
  Archive,
  RotateCcw,
  X,
  LayoutGrid,
  List as ListIcon,
  ExternalLink,
  PenLine,
  ArrowRight,
  FolderKanban,
  AlertCircle,
} from "lucide-react";
import {
  bulkUpdateReferences,
  setReferenceStatus,
  skipReference,
  unskipReference,
  restoreReference,
} from "@/lib/actions/references";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ReferenceListItem, MasterData } from "@/lib/queries/references";

interface ReferencesGridClientProps {
  items: ReferenceListItem[];
  masterData: MasterData;
  isArchivedView?: boolean;
}

const VIEW_STORAGE_KEY = "rms.refsViewMode";
const VIEW_EVENT = "rms:refs-viewmode";

function subscribeViewMode(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(VIEW_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(VIEW_EVENT, callback);
  };
}

function getViewModeSnapshot(): "grid" | "list" {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function getServerViewModeSnapshot(): "grid" | "list" {
  return "grid";
}

const UTC_SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function getDomainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

function needsDetails(ref: ReferenceListItem): boolean {
  return (
    !ref.hookText?.trim() ||
    !ref.summary?.trim() ||
    ref.pillars.length === 0
  );
}

export function ReferencesGridClient({
  items,
  masterData,
  isArchivedView = false,
}: ReferencesGridClientProps) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const viewMode = useSyncExternalStore(
    subscribeViewMode,
    getViewModeSnapshot,
    getServerViewModeSnapshot
  );
  const [captureRef, setCaptureRef] = useState<ReferenceListItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  // Escape exits bulk select mode cleanly (when CaptureSheet is closed)
  useEffect(() => {
    if (!selectMode || captureRef) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedIds([]);
        setSelectMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectMode, captureRef]);

  const handleViewChange = (next: "grid" | "list") => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
      window.dispatchEvent(new Event(VIEW_EVENT));
    } catch {
      // Ignore storage access errors
    }
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(items.map((i) => i.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const exitSelectMode = () => {
    setSelectedIds([]);
    setSelectMode(false);
  };

  const runBulkAction = (action: "select" | "skip" | "archive" | "restore") => {
    if (selectedIds.length === 0) return;

    startTransition(async () => {
      const res = await bulkUpdateReferences({
        ids: selectedIds,
        action,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      const { updatedCount, skippedDueToLink } = res.data;
      const actionLabels = {
        select: "Moved to Selected",
        skip: "Skipped",
        archive: "Archived",
        restore: "Restored to library",
      };

      toast.success(`${actionLabels[action]}: ${updatedCount} item(s)`);
      if (skippedDueToLink > 0) {
        toast.info(`${skippedDueToLink} item(s) unchanged due to active content links.`);
      }

      setSelectedIds([]);
      setSelectMode(false);
      router.refresh();
    });
  };

  const handleRowAction = (
    id: string,
    fn: () => Promise<void>
  ) => {
    setBusyRowId(id);
    startTransition(async () => {
      try {
        await fn();
      } finally {
        setBusyRowId(null);
      }
    });
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Toolbar: Results summary, View Switcher, Bulk Select Mode */}
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
              aria-pressed={viewMode === "grid"}
              className={cn(
                "h-7 px-2.5 rounded-sm text-xs font-mono inline-flex items-center gap-1.5 transition-colors",
                viewMode === "grid"
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
              aria-pressed={viewMode === "list"}
              className={cn(
                "h-7 px-2.5 rounded-sm text-xs font-mono inline-flex items-center gap-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListIcon className="size-3.5" />
              <span>List</span>
            </button>
          </div>

          <Button
            type="button"
            variant={selectMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (selectMode) {
                exitSelectMode();
              } else {
                setSelectMode(true);
              }
            }}
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
          Showing {items.length} {items.length === 1 ? "item" : "items"} on page
        </span>
      </div>

      {/* View Content: Editorial Grid vs Compact List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {items.map((item) => (
            <ReferenceCard
              key={item.id}
              reference={item}
              masterData={masterData}
              selectable={selectMode}
              selected={selectedIds.includes(item.id)}
              onToggleSelect={toggleItem}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="hidden lg:grid lg:grid-cols-[28px_minmax(0,2.2fr)_minmax(0,1fr)_96px_236px] items-center gap-3 px-4 py-2.5 border-b border-border/80 bg-secondary/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
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
            <div>Hook / Reference & Attribution</div>
            <div>Pillars & Meta</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>

          <div className="divide-y divide-border/70">
            {items.map((ref, idx) => {
              const isSelected = selectedIds.includes(ref.id);
              const titleText =
                ref.hookText?.trim() || ref.summary?.trim() || "Untitled reference";
              const missingMeta = needsDetails(ref);
              const isRowBusy = isPending && busyRowId === ref.id;
              const dateLabel = UTC_SHORT_DATE.format(new Date(ref.savedAt));

              return (
                <div
                  key={ref.id}
                  className={cn(
                    "grid grid-cols-1 lg:grid-cols-[28px_minmax(0,2.2fr)_minmax(0,1fr)_96px_236px] items-start lg:items-center gap-3 px-4 py-3 transition-colors",
                    isSelected
                      ? "bg-brand/5"
                      : "hover:bg-secondary/30"
                  )}
                >
                  {/* Column 1: Index or Checkbox */}
                  <div className="hidden lg:flex w-6 items-center justify-center">
                    {selectMode ? (
                      <Checkbox
                        aria-label={`Select reference ${titleText}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleItem(ref.id)}
                      />
                    ) : (
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Column 2: Hook / Title + Platform + Attribution */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectMode && (
                        <div className="lg:hidden shrink-0">
                          <Checkbox
                            aria-label={`Select reference ${titleText}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(ref.id)}
                          />
                        </div>
                      )}
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary border border-border/80 text-foreground shrink-0">
                        {ref.platform.name}
                      </span>
                      {ref.format && (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-background border border-border/70 text-muted-foreground shrink-0">
                          {ref.format.name}
                        </span>
                      )}
                      <Link
                        href={`/references/${ref.id}`}
                        className="text-sm font-semibold text-foreground hover:text-brand transition-colors truncate"
                        title={titleText}
                      >
                        {titleText}
                      </Link>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-muted-foreground">
                      <span className="tabular-nums">{dateLabel}</span>
                      {ref.hookType && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-foreground/80">{ref.hookType.name}</span>
                        </>
                      )}
                      {ref.sourceAccount && (
                        <>
                          <span aria-hidden="true">·</span>
                          <Link
                            href={`/sources/${ref.sourceAccount.id}`}
                            className="hover:text-foreground hover:underline"
                          >
                            @{ref.sourceAccount.handle}
                          </Link>
                        </>
                      )}
                      {ref.audio && (
                        <>
                          <span aria-hidden="true">·</span>
                          <Link
                            href={`/audio/${ref.audio.id}`}
                            className="hover:text-foreground hover:underline truncate max-w-[180px]"
                            title={ref.audio.title}
                          >
                            {ref.audio.title}
                          </Link>
                        </>
                      )}
                      {!ref.sourceAccount && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[160px]">
                            {getDomainLabel(ref.url)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Column 3: Pillars + Missing indicator */}
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {ref.pillars.length > 0 ? (
                      <>
                        {ref.pillars.slice(0, 2).map((p) => (
                          <Link
                            key={p.id}
                            href={`/references?pillar=${encodeURIComponent(p.slug)}`}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/80 border border-border/80 text-foreground hover:border-foreground/40 transition-colors"
                          >
                            {p.name}
                          </Link>
                        ))}
                        {ref.pillars.length > 2 && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            +{ref.pillars.length - 2}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] font-mono text-muted-foreground/70">
                        No pillar
                      </span>
                    )}
                    {missingMeta && (
                      <span
                        title="Missing hook, summary, or pillar"
                        className="inline-flex items-center gap-0.5 text-[10px] font-mono text-warning"
                      >
                        <AlertCircle className="size-3" />
                        <span className="lg:hidden">Needs details</span>
                      </span>
                    )}
                  </div>

                  {/* Column 4: Status */}
                  <div className="flex items-center">
                    <StatusBadge status={ref.status} size="sm" />
                  </div>

                  {/* Column 5: Quick Inline Actions (all links are siblings!) */}
                  <div className="flex items-center justify-start lg:justify-end gap-1.5 flex-wrap">
                    {isArchivedView ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isRowBusy}
                        onClick={() =>
                          handleRowAction(ref.id, async () => {
                            const res = await restoreReference({ id: ref.id });
                            if (!res.ok) {
                              toast.error(res.error.message);
                              return;
                            }
                            toast.success("Restored from archive");
                            router.refresh();
                          })
                        }
                        className="h-7 px-2.5 text-[11px] font-mono rounded-md gap-1"
                      >
                        <RotateCcw className="size-3" />
                        <span>Restore</span>
                      </Button>
                    ) : ref.status === "inbox" ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isRowBusy}
                          onClick={() => setCaptureRef(ref)}
                          className="h-7 px-2 text-[11px] font-mono rounded-md gap-1"
                        >
                          <PenLine className="size-3" />
                          <span>Capture</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isRowBusy}
                          onClick={() =>
                            handleRowAction(ref.id, async () => {
                              const res = await setReferenceStatus({
                                id: ref.id,
                                status: "selected",
                              });
                              if (!res.ok) {
                                toast.error(res.error.message);
                                return;
                              }
                              toast.success("Moved to Selected", {
                                action: {
                                  label: "Undo",
                                  onClick: async () => {
                                    await setReferenceStatus({
                                      id: ref.id,
                                      status: "inbox",
                                    });
                                    router.refresh();
                                  },
                                },
                              });
                              router.refresh();
                            })
                          }
                          className="h-7 px-2 text-[11px] font-mono font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-md gap-1"
                        >
                          <Check className="size-3" />
                          <span>Select</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isRowBusy}
                          onClick={() =>
                            handleRowAction(ref.id, async () => {
                              const res = await skipReference({ id: ref.id });
                              if (!res.ok) {
                                toast.error(res.error.message);
                                return;
                              }
                              toast.info("Skipped reference", {
                                action: {
                                  label: "Undo",
                                  onClick: async () => {
                                    await unskipReference({
                                      id: ref.id,
                                      to: "inbox",
                                    });
                                    router.refresh();
                                  },
                                },
                              });
                              router.refresh();
                            })
                          }
                          aria-label="Skip reference"
                          className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                        >
                          <SkipForward className="size-3.5" />
                        </Button>
                      </>
                    ) : ref.status === "selected" ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isRowBusy}
                          onClick={() => setCaptureRef(ref)}
                          aria-label="Capture details"
                          className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                        >
                          <PenLine className="size-3.5" />
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          className="h-7 px-2.5 text-[11px] font-mono font-semibold bg-brand text-primary-foreground hover:bg-brand/90 rounded-md gap-1"
                        >
                          <Link href={`/contents/new?refId=${ref.id}`}>
                            <span>Create Draft</span>
                            <ArrowRight className="size-3" />
                          </Link>
                        </Button>
                      </>
                    ) : ref.status === "skipped" ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isRowBusy}
                          onClick={() =>
                            handleRowAction(ref.id, async () => {
                              const res = await unskipReference({
                                id: ref.id,
                                to: "inbox",
                              });
                              if (!res.ok) {
                                toast.error(res.error.message);
                                return;
                              }
                              toast.success("Moved back to Inbox");
                              router.refresh();
                            })
                          }
                          className="h-7 px-2.5 text-[11px] font-mono rounded-md gap-1"
                        >
                          <RotateCcw className="size-3" />
                          <span>Restore</span>
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isRowBusy}
                          onClick={() => setCaptureRef(ref)}
                          aria-label="Edit details"
                          className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                        >
                          <PenLine className="size-3.5" />
                        </Button>
                        {ref.contentId && (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-[11px] font-mono rounded-md gap-1"
                          >
                            <Link href={`/contents/${ref.contentId}`}>
                              <FolderKanban className="size-3" />
                              <span>Studio</span>
                            </Link>
                          </Button>
                        )}
                      </>
                    )}

                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                    >
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open original post"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Single shared CaptureSheet for List View rows */}
      <CaptureSheet
        reference={captureRef}
        isOpen={Boolean(captureRef)}
        onOpenChange={(open) => {
          if (!open) setCaptureRef(null);
        }}
        masterData={masterData}
        onSuccess={() => router.refresh()}
      />

      {/* Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-2xl bg-card border-2 border-foreground rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-6 px-2 rounded bg-foreground text-background text-xs font-mono font-bold flex items-center justify-center tabular-nums">
              {selectedIds.length}
            </span>
            <span className="text-xs font-mono font-semibold text-foreground">
              selected
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isArchivedView ? (
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={() => runBulkAction("restore")}
                className="h-8 text-xs font-mono font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-md gap-1.5"
              >
                <RotateCcw className="size-3.5" />
                <span>Restore</span>
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => runBulkAction("select")}
                  className="h-8 text-xs font-mono font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-md gap-1.5"
                >
                  <Check className="size-3.5" />
                  <span>Select</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => runBulkAction("skip")}
                  className="h-8 text-xs font-mono rounded-md gap-1.5"
                >
                  <SkipForward className="size-3.5" />
                  <span>Skip</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => runBulkAction("archive")}
                  className="h-8 text-xs font-mono rounded-md text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                >
                  <Archive className="size-3.5" />
                  <span>Archive</span>
                </Button>
              </>
            )}

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
