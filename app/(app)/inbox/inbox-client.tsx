"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  CheckCheck,
  ClipboardPaste,
  Link as LinkIcon,
  Loader2,
  RotateCcw,
  Search,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/app/empty-state";
import { ReferencesGridClient } from "@/components/app/references-grid-client";
import { SelectField } from "@/components/app/select-field";
import { createReferenceFromUrl } from "@/lib/actions/references";
import { toast } from "sonner";
import type { ReferenceListItem, MasterData } from "@/lib/queries/references";

interface InboxClientProps {
  items: ReferenceListItem[];
  masterData: MasterData;
  aiKeyReady: boolean;
  aiEnabled: boolean;
}

type ReadinessTab = "all" | "needs_details" | "ready";
type SortOrder = "newest" | "oldest" | "needs_details";

function isNeedsDetails(item: ReferenceListItem): boolean {
  return item.pillars.length === 0 || !item.summary || !item.hookText;
}

export function InboxClient({
  items,
  masterData,
  aiKeyReady,
  aiEnabled,
}: InboxClientProps) {
  const router = useRouter();
  const [quickUrl, setQuickUrl] = useState("");
  const [isIngesting, startIngest] = useTransition();
  const quickInputRef = React.useRef<HTMLInputElement | null>(null);

  const [searchText, setSearchText] = useState("");
  const [readinessTab, setReadinessTab] = useState<ReadinessTab>("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const handleQuickIngest = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickUrl.trim();
    if (!clean) {
      toast.error("Please enter or paste a link first");
      return;
    }

    startIngest(async () => {
      const res = await createReferenceFromUrl({ input: clean });
      if (res.ok) {
        if (res.data.status === "duplicate") {
          toast.info("Reference already exists in your library", {
            action: {
              label: "Open",
              onClick: () => router.push(`/references/${res.data.id}`),
            },
          });
        } else if (res.data.draftContentId) {
          toast.success(
            `Saved & drafted "${res.data.draftContentTitle || "Content"}" in Studio!`,
            {
              action: {
                label: "Open Studio",
                onClick: () => router.push(`/contents/${res.data.draftContentId}`),
              },
            }
          );
        } else if (res.data.enriched) {
          toast.success("Added to Inbox & AI-enriched!");
        } else {
          toast.success("Added to Inbox!");
        }
        setQuickUrl("");
        router.refresh();
      } else {
        toast.error(res.error.message || "Could not ingest URL");
      }
    });
  };

  const handlePaste = async () => {
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

  const platformOptions = React.useMemo(() => {
    const counts = new Map<string, { slug: string; name: string; count: number }>();
    for (const item of items) {
      const existing = counts.get(item.platform.slug);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(item.platform.slug, {
          slug: item.platform.slug,
          name: item.platform.name,
          count: 1,
        });
      }
    }
    return Array.from(counts.values());
  }, [items]);

  const needsDetailsCount = React.useMemo(
    () => items.filter((i) => isNeedsDetails(i)).length,
    [items]
  );
  const readyCount = items.length - needsDetailsCount;

  const filteredItems = React.useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const list = items.filter((item) => {
      if (readinessTab === "needs_details" && !isNeedsDetails(item)) return false;
      if (readinessTab === "ready" && isNeedsDetails(item)) return false;
      if (platformFilter !== "all" && item.platform.slug !== platformFilter) return false;
      if (q) {
        const hay = [
          item.url,
          item.summary || "",
          item.hookText || "",
          item.notes || "",
          item.sourceAccount?.handle || "",
          item.platform.name,
          item.format?.name || "",
          ...(item.tags || []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortOrder === "oldest") {
      return [...list].sort(
        (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
      );
    }
    if (sortOrder === "needs_details") {
      return [...list].sort((a, b) => {
        const aMissing = isNeedsDetails(a) ? 0 : 1;
        const bMissing = isNeedsDetails(b) ? 0 : 1;
        if (aMissing !== bMissing) return aMissing - bMissing;
        return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
      });
    }
    return list;
  }, [items, platformFilter, readinessTab, searchText, sortOrder]);

  const hasFilters = Boolean(
    searchText.trim() || readinessTab !== "all" || platformFilter !== "all"
  );

  const resetFilters = () => {
    setSearchText("");
    setReadinessTab("all");
    setPlatformFilter("all");
  };

  return (
    <div className="space-y-5">
      {/* Inline Quick Capture Bar */}
      <form
        onSubmit={handleQuickIngest}
        className="flex flex-col sm:flex-row sm:items-center gap-1.5 bg-card border border-input rounded-lg p-1.5 transition-colors focus-within:border-foreground hover:border-foreground/40"
      >
        <div className="flex items-center flex-1 min-w-0">
          <div className="pl-2.5 pr-1.5 text-muted-foreground shrink-0">
            <LinkIcon className="size-4" />
          </div>
          <label htmlFor="inbox-quick-ingest" className="sr-only">
            Quick save URL to Inbox
          </label>
          <Input
            ref={quickInputRef}
            id="inbox-quick-ingest"
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            placeholder="Quick drop a TikTok, IG, YouTube, X, or Threads link straight to Inbox..."
            className="border-0 bg-transparent h-9 text-xs font-mono focus-visible:ring-0 focus-visible:ring-offset-0 px-1 min-w-0"
            disabled={isIngesting}
          />
          {quickUrl && (
            <button
              type="button"
              aria-label="Clear quick link input"
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
            onClick={handlePaste}
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
            <span>{isIngesting ? "Adding..." : "Add to Inbox"}</span>
          </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={<CheckCheck className="size-5" />}
          title="Inbox is Clear"
          description="No new references waiting for triage. Paste a link above, batch-import a file, or connect your browser bookmarklet and iOS Shortcut."
          primaryAction={{
            label: "Browse References",
            href: "/references",
          }}
          secondaryAction={{
            label: "Setup Shortcut / Bookmarklet",
            href: "/settings?tab=ingest",
            icon: <Settings className="size-3.5" />,
          }}
        />
      ) : (
        <>
          {/* Triage Filter & Sort Bar */}
          <div className="space-y-3 border-b border-border/70 pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  aria-label="Filter inbox references"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Filter inbox by hook, @creator, tag, url..."
                  className="pl-8 pr-8 h-9 text-xs font-mono rounded-md"
                />
                {searchText && (
                  <button
                    type="button"
                    aria-label="Clear filter search"
                    onClick={() => setSearchText("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Platform & Sort Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {platformOptions.length > 1 && (
                  <SelectField
                    ariaLabel="Filter inbox by platform"
                    value={platformFilter}
                    onValueChange={setPlatformFilter}
                    className={`w-auto min-w-[148px] max-w-[200px] ${
                      platformFilter !== "all" ? "border-foreground font-semibold" : ""
                    }`}
                    options={[
                      { value: "all", label: `All Platforms (${items.length})` },
                      ...platformOptions.map((p) => ({
                        value: p.slug,
                        label: `${p.name} (${p.count})`,
                      })),
                    ]}
                  />
                )}

                <SelectField
                  ariaLabel="Sort inbox items"
                  value={sortOrder}
                  icon={<ArrowUpDown className="size-3" />}
                  onValueChange={(val) => setSortOrder(val as SortOrder)}
                  className="w-auto min-w-[172px] max-w-[220px]"
                  options={[
                    { value: "newest", label: "Newest first" },
                    { value: "oldest", label: "Oldest first (FIFO)" },
                    { value: "needs_details", label: "Needs details first" },
                  ]}
                />

                {hasFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-9 px-2.5 text-xs font-mono rounded-md text-muted-foreground hover:text-foreground gap-1"
                  >
                    <RotateCcw className="size-3" />
                    <span>Reset</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Readiness Tabs + Matching Count */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: "all" as const, label: `All (${items.length})` },
                  { id: "needs_details" as const, label: `Needs Details (${needsDetailsCount})` },
                  { id: "ready" as const, label: `Ready (${readyCount})` },
                ].map((tab) => {
                  const active = readinessTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setReadinessTab(tab.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                        active
                          ? "bg-foreground text-background font-bold"
                          : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground tabular-nums">
                {!aiKeyReady || !aiEnabled ? (
                  <Link
                    href="/settings?tab=ai"
                    className="text-warning hover:underline underline-offset-4"
                  >
                    {!aiKeyReady ? "Add Gemini key for AI Enrich →" : "AI Enrich paused →"}
                  </Link>
                ) : null}
                <span>
                  Showing {filteredItems.length} of {items.length}
                </span>
              </div>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              icon={<Search className="size-5" />}
              title="No matching inbox items"
              description="No references in your Inbox queue match this search or readiness filter."
              primaryAction={{
                label: "Reset Inbox Filters",
                onClick: resetFilters,
              }}
              secondaryAction={{
                label: "Start Focus Triage",
                href: "/inbox/triage",
              }}
            />
          ) : (
            <ReferencesGridClient items={filteredItems} masterData={masterData} />
          )}
        </>
      )}
    </div>
  );
}
