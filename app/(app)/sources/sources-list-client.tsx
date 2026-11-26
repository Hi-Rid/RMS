"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Users,
  Search,
  ArrowUpDown,
  X,
  RotateCcw,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  Bookmark,
  Star,
  Sparkles,
  Filter,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/app/empty-state";
import { SelectField } from "@/components/app/select-field";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSource, updateSource, deleteSource } from "@/lib/actions/sources";
import { buildCreatorProfileUrl } from "@/lib/domain/normalize";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SourceListItem, SourceSortOption } from "@/lib/queries/sources";

export type SourceScopeFilter = "all" | "curated" | "inbox" | "rated";

interface SourcesListClientProps {
  initialItems: SourceListItem[];
  platforms: { id: string; name: string; slug: string }[];
  initialQuery?: string;
  initialSort?: SourceSortOption;
  initialPlatform?: string;
  initialScope?: SourceScopeFilter;
}

const SORT_OPTIONS: { value: SourceSortOption; label: string }[] = [
  { value: "refs", label: "Most References" },
  { value: "hit_rate", label: "Highest Hit Rate" },
  { value: "score", label: "Avg Rating" },
  { value: "recent", label: "Recently Saved" },
  { value: "handle", label: "Handle (A–Z)" },
];

export function SourcesListClient({
  initialItems,
  platforms,
  initialQuery = "",
  initialSort = "refs",
  initialPlatform = "all",
  initialScope = "all",
}: SourcesListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const items = initialItems;
  const [searchText, setSearchText] = useState(initialQuery);
  const [sortBy, setSortBy] = useState<SourceSortOption>(initialSort);
  const [platformFilter, setPlatformFilter] = useState<string>(initialPlatform);
  const [scope, setScope] = useState<SourceScopeFilter>(initialScope);

  const [prevQuery, setPrevQuery] = useState(initialQuery);
  if (prevQuery !== initialQuery) {
    setPrevQuery(initialQuery);
    setSearchText(initialQuery);
  }

  const [prevSort, setPrevSort] = useState(initialSort);
  if (prevSort !== initialSort) {
    setPrevSort(initialSort);
    setSortBy(initialSort);
  }

  const [prevPlatform, setPrevPlatform] = useState(initialPlatform);
  if (prevPlatform !== initialPlatform) {
    setPrevPlatform(initialPlatform);
    setPlatformFilter(initialPlatform);
  }

  const [prevScope, setPrevScope] = useState(initialScope);
  if (prevScope !== initialScope) {
    setPrevScope(initialScope);
    setScope(initialScope);
  }

  const syncUrlParams = React.useCallback(
    (
      q: string,
      nextPlatform: string,
      nextScope: SourceScopeFilter,
      nextSort: SourceSortOption
    ) => {
      const qp = new URLSearchParams();
      if (q.trim()) qp.set("q", q.trim());
      if (nextPlatform !== "all") qp.set("platform", nextPlatform);
      if (nextScope !== "all") qp.set("filter", nextScope);
      if (nextSort !== "refs") qp.set("sort", nextSort);
      const qs = qp.toString();
      const targetUrl = qs ? `${pathname}?${qs}` : pathname;
      if (
        typeof window !== "undefined" &&
        targetUrl !== `${window.location.pathname}${window.location.search}`
      ) {
        window.history.replaceState(null, "", targetUrl);
      }
    },
    [pathname]
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      syncUrlParams(searchText, platformFilter, scope, sortBy);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText, platformFilter, scope, sortBy, syncUrlParams]);

  // Modal & Delete State
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<SourceListItem | null>(null);
  const [formPlatformId, setFormPlatformId] = useState(platforms[0]?.id || "");
  const [formHandle, setFormHandle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SourceListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const openCreateModal = () => {
    setEditingItem(null);
    setFormPlatformId(platforms[0]?.id || "");
    setFormHandle("");
    setFormNotes("");
    setModalMode("create");
  };

  const openEditModal = (item: SourceListItem) => {
    setEditingItem(item);
    setFormPlatformId(item.platform.id);
    setFormHandle(item.handle);
    setFormNotes(item.notes || "");
    setModalMode("edit");
  };

  const handleModalOpenChange = (open: boolean) => {
    if (!open && isPending) return;
    if (!open) {
      setModalMode(null);
      setEditingItem(null);
    }
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHandle.trim()) {
      toast.error("Creator handle is required");
      return;
    }

    if (modalMode === "edit" && editingItem) {
      startTransition(async () => {
        const res = await updateSource({
          id: editingItem.id,
          handle: formHandle.trim(),
          notes: formNotes,
        });
        if (res.ok) {
          toast.success("Creator account updated");
          setModalMode(null);
          setEditingItem(null);
          router.refresh();
        } else {
          toast.error(res.error.message);
        }
      });
      return;
    }

    if (!formPlatformId) {
      toast.error("Select a platform first");
      return;
    }

    startTransition(async () => {
      const res = await createSource({
        platformId: formPlatformId,
        handle: formHandle.trim(),
        notes: formNotes.trim() || undefined,
      });

      if (res.ok) {
        if (res.data.duplicate) {
          toast.info("Creator already exists — opening existing profile.", {
            action: {
              label: "Open",
              onClick: () => router.push(`/sources/${res.data.id}`),
            },
          });
        } else {
          toast.success("Creator added to directory");
        }
        setModalMode(null);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteSource(deleteTarget.id);
      if (res.ok) {
        toast.success(`Deleted @${deleteTarget.handle}`);
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(res.error.message);
        setDeleteTarget(null);
      }
    });
  };

  const platformsInUse = React.useMemo(
    () =>
      Array.from(
        new Map(items.map((i) => [i.platform.slug, i.platform.name])).entries()
      ),
    [items]
  );

  // Catalog KPIs & Tab counts
  const counts = React.useMemo(() => {
    let totalRefs = 0;
    let totalSelectedOrProd = 0;
    let curated = 0;
    let inbox = 0;
    let rated = 0;

    for (const item of items) {
      totalRefs += item.refsCount;
      totalSelectedOrProd += item.selectedCount + item.productionCount;
      if (item.selectedCount + item.productionCount > 0) curated += 1;
      if (item.inboxCount > 0) inbox += 1;
      if (item.avgScore !== null) rated += 1;
    }

    const overallConversionPct =
      totalRefs > 0 ? Math.round((totalSelectedOrProd / totalRefs) * 100) : 0;

    return {
      total: items.length,
      totalRefs,
      totalSelectedOrProd,
      overallConversionPct,
      curated,
      inbox,
      rated,
    };
  }, [items]);

  const filteredItems = React.useMemo(() => {
    const cleanTerm = searchText.trim().replace(/^@+/, "").toLowerCase();
    return items
      .filter((item) => {
        if (platformFilter !== "all" && item.platform.slug !== platformFilter) {
          return false;
        }
        if (
          scope === "curated" &&
          item.selectedCount + item.productionCount === 0
        ) {
          return false;
        }
        if (scope === "inbox" && item.inboxCount === 0) return false;
        if (scope === "rated" && item.avgScore === null) return false;
        if (!cleanTerm) return true;
        return (
          item.handle.toLowerCase().includes(cleanTerm) ||
          item.platform.name.toLowerCase().includes(cleanTerm) ||
          (item.notes && item.notes.toLowerCase().includes(cleanTerm))
        );
      })
      .sort((a, b) => {
        if (sortBy === "handle") return a.handle.localeCompare(b.handle);
        if (sortBy === "score")
          return (
            (b.avgScore ?? -1) - (a.avgScore ?? -1) || b.refsCount - a.refsCount
          );
        if (sortBy === "hit_rate")
          return (
            b.conversionPct - a.conversionPct || b.refsCount - a.refsCount
          );
        if (sortBy === "recent") {
          if (a.lastSavedAt && b.lastSavedAt)
            return b.lastSavedAt.localeCompare(a.lastSavedAt);
          if (a.lastSavedAt) return -1;
          if (b.lastSavedAt) return 1;
          return b.createdAt.localeCompare(a.createdAt);
        }
        return b.refsCount - a.refsCount || a.handle.localeCompare(b.handle);
      });
  }, [items, platformFilter, scope, searchText, sortBy]);

  const hasFilters = Boolean(
    searchText.trim() ||
      platformFilter !== "all" ||
      scope !== "all" ||
      sortBy !== "refs"
  );

  const resetFilters = () => {
    setSearchText("");
    setPlatformFilter("all");
    setScope("all");
    setSortBy("refs");
    syncUrlParams("", "all", "all", "refs");
  };

  return (
    <div className="space-y-5">
      {/* Compact Catalog Summary Cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setScope("all")}
            className={cn(
              "text-left bg-card border rounded-lg p-3.5 transition-colors",
              scope === "all"
                ? "border-foreground/50"
                : "border-border hover:border-foreground/30"
            )}
          >
            <div className="label-mono text-muted-foreground">Tracked Creators</div>
            <div className="text-xl font-black font-display text-foreground mt-1 tabular-nums">
              {counts.total}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setScope(scope === "curated" ? "all" : "curated")}
            className={cn(
              "text-left bg-card border rounded-lg p-3.5 transition-colors",
              scope === "curated"
                ? "border-brand bg-brand/5"
                : "border-border hover:border-foreground/30"
            )}
          >
            <div className="label-mono text-muted-foreground flex items-center justify-between">
              <span>Keeper Hit Rate</span>
              <TrendingUp className="size-3 text-brand" />
            </div>
            <div className="text-xl font-black font-display text-foreground mt-1 tabular-nums">
              {counts.overallConversionPct}%
              <span className="text-xs font-mono font-normal text-muted-foreground ml-1.5">
                ({counts.totalSelectedOrProd}/{counts.totalRefs})
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setScope(scope === "inbox" ? "all" : "inbox")}
            className={cn(
              "text-left bg-card border rounded-lg p-3.5 transition-colors",
              scope === "inbox"
                ? "border-foreground/50 bg-secondary/40"
                : "border-border hover:border-foreground/30"
            )}
          >
            <div className="label-mono text-muted-foreground flex items-center justify-between">
              <span>Needs Triage</span>
              {counts.inbox > 0 && <Sparkles className="size-3 text-warning" />}
            </div>
            <div className="text-xl font-black font-display text-foreground mt-1 tabular-nums">
              {counts.inbox}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setScope(scope === "rated" ? "all" : "rated")}
            className={cn(
              "text-left bg-card border rounded-lg p-3.5 transition-colors",
              scope === "rated"
                ? "border-warning/60 bg-warning/5"
                : "border-border hover:border-foreground/30"
            )}
          >
            <div className="label-mono text-muted-foreground flex items-center justify-between">
              <span>Rated Sources</span>
              <Star className="size-3 text-warning" />
            </div>
            <div className="text-xl font-black font-display text-foreground mt-1 tabular-nums">
              {counts.rated}
            </div>
          </button>
        </div>
      )}

      {/* Search, Platform, Sort & Add Creator Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search @handle, platform, or creator angle notes..."
            aria-label="Search source creators"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchText) {
                e.preventDefault();
                setSearchText("");
              }
            }}
            className="pl-9 pr-8 h-9 text-xs font-mono bg-card border-border rounded-md focus-visible:border-foreground"
          />
          {searchText && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchText("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {platformsInUse.length > 1 && (
            <SelectField
              ariaLabel="Filter by platform"
              value={platformFilter}
              onValueChange={setPlatformFilter}
              className={cn(
                "w-auto min-w-[136px] max-w-[180px] bg-card font-mono text-xs rounded-md",
                platformFilter !== "all" && "border-foreground font-semibold"
              )}
              options={[
                { value: "all", label: "All Platforms" },
                ...platformsInUse.map(([slug, name]) => ({
                  value: slug,
                  label: name,
                })),
              ]}
            />
          )}

          <SelectField
            ariaLabel="Sort source creators"
            value={sortBy}
            icon={<ArrowUpDown className="size-3" />}
            onValueChange={(val) => setSortBy(val as SourceSortOption)}
            className="w-auto min-w-[165px] max-w-[205px] bg-card font-mono text-xs rounded-md"
            options={SORT_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
          />

          <Button
            type="button"
            size="sm"
            onClick={openCreateModal}
            className="h-9 px-3 text-xs font-mono font-semibold bg-brand text-primary-foreground hover:bg-brand/90 rounded-md gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Add Creator</span>
          </Button>
        </div>
      </div>

      {/* Scope Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border/80 pb-2">
        {(
          [
            { value: "all", label: "All Creators", count: counts.total },
            { value: "curated", label: "High Signal", count: counts.curated },
            { value: "inbox", label: "Inbox Pending", count: counts.inbox },
            { value: "rated", label: "Evaluated", count: counts.rated },
          ] as const
        ).map((tab) => {
          const isActive = scope === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setScope(tab.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-mono transition-colors shrink-0 inline-flex items-center gap-1.5",
                isActive
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "text-[10px] tabular-nums px-1 py-0.5 rounded",
                  isActive
                    ? "bg-background/15 text-background"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Removable Active Filter Chips */}
      {hasFilters && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
            <Filter className="size-3" />
            Active:
          </span>
          {searchText.trim() && (
            <button
              type="button"
              onClick={() => setSearchText("")}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/80 border border-border text-[11px] font-mono text-foreground hover:border-foreground/40 transition-colors"
            >
              <span className="text-muted-foreground">Search:</span>
              <span className="font-medium max-w-[160px] truncate">
                &ldquo;{searchText.trim()}&rdquo;
              </span>
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
          {platformFilter !== "all" && (
            <button
              type="button"
              onClick={() => setPlatformFilter("all")}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/80 border border-border text-[11px] font-mono text-foreground hover:border-foreground/40 transition-colors"
            >
              <span className="text-muted-foreground">Platform:</span>
              <span className="font-medium">
                {platformsInUse.find(([slug]) => slug === platformFilter)?.[1] ||
                  platformFilter}
              </span>
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
          {scope !== "all" && (
            <button
              type="button"
              onClick={() => setScope("all")}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/80 border border-border text-[11px] font-mono text-foreground hover:border-foreground/40 transition-colors"
            >
              <span className="text-muted-foreground">Scope:</span>
              <span className="font-medium capitalize">{scope}</span>
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
          {sortBy !== "refs" && (
            <button
              type="button"
              onClick={() => setSortBy("refs")}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/80 border border-border text-[11px] font-mono text-foreground hover:border-foreground/40 transition-colors"
            >
              <span className="text-muted-foreground">Sort:</span>
              <span className="font-medium">
                {SORT_OPTIONS.find((s) => s.value === sortBy)?.label}
              </span>
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-6 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground gap-1 rounded-md"
          >
            <RotateCcw className="size-3" />
            <span>Reset all</span>
          </Button>
        </div>
      )}

      {/* Sources List */}
      {filteredItems.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No matching creators"
            description="No creator accounts matched your current search, platform, or scope filter."
            primaryAction={{
              label: "Clear Filters",
              onClick: resetFilters,
              icon: <RotateCcw className="size-3.5" />,
            }}
          />
        ) : (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No creator accounts yet"
            description="Creator handles are tracked automatically when ingesting links, or add an inspiration account directly."
            primaryAction={{
              label: "Add Creator",
              onClick: openCreateModal,
              icon: <Plus className="size-3.5" />,
            }}
            secondaryAction={{
              label: "Browse References",
              href: "/references",
            }}
          />
        )
      ) : (
        <>
          {/* Mobile Cards (< md) */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => {
              const profileUrl = buildCreatorProfileUrl(
                item.platform.slug,
                item.handle
              );
              return (
                <article
                  key={item.id}
                  className="bg-card border border-border rounded-lg p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/sources/${item.id}`}
                        className="font-bold text-foreground hover:text-brand text-sm font-mono truncate block transition-colors"
                      >
                        @{item.handle}
                      </Link>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground font-mono line-clamp-1 mt-0.5">
                          {item.notes}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border bg-secondary text-foreground border-border shrink-0">
                      {item.platform.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground tabular-nums">
                    <span>
                      {item.refsCount} refs · {item.conversionPct}% hit ·{" "}
                      {item.productionCount} prod
                    </span>
                    <span className="font-bold text-warning">
                      {item.avgScore !== null ? `★ ${item.avgScore.toFixed(1)}` : "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                    <Link
                      href={`/references?q=${encodeURIComponent(`@${item.handle}`)}`}
                      className="text-[11px] font-mono text-foreground hover:text-brand inline-flex items-center gap-1"
                    >
                      <Bookmark className="size-3" />
                      <span>Open Refs</span>
                    </Link>

                    <div className="flex items-center gap-1">
                      {profileUrl && (
                        <a
                          href={profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open @${item.handle} profile`}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(item)}
                        aria-label={`Edit @${item.handle}`}
                        className="h-7 w-7 p-0 rounded-md"
                      >
                        <Pencil className="size-3" />
                      </Button>
                      {item.canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(item)}
                          aria-label={`Delete @${item.handle}`}
                          className="h-7 w-7 p-0 rounded-md text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden md:block rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-secondary/50 border-b border-border/80 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">Creator &amp; Notes</th>
                    <th className="py-2.5 px-4 font-bold">Platform</th>
                    <th className="py-2.5 px-4 font-bold text-center">Refs</th>
                    <th className="py-2.5 px-4 font-bold">Hit Rate</th>
                    <th className="py-2.5 px-4 font-bold text-center">Produced</th>
                    <th className="py-2.5 px-4 font-bold text-center">Avg Rating</th>
                    <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredItems.map((item) => {
                    const profileUrl = buildCreatorProfileUrl(
                      item.platform.slug,
                      item.handle
                    );
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-secondary/30 transition-colors group"
                      >
                        <td className="py-3 px-4 max-w-[300px]">
                          <Link
                            href={`/sources/${item.id}`}
                            className="font-bold text-foreground hover:text-brand text-sm font-mono transition-colors block truncate"
                          >
                            @{item.handle}
                          </Link>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {item.notes}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border bg-secondary text-foreground border-border">
                            {item.platform.name}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center tabular-nums">
                          <span className="font-bold text-foreground">
                            {item.refsCount}
                          </span>
                          {item.inboxCount > 0 && (
                            <span className="block text-[10px] text-warning font-semibold">
                              {item.inboxCount} inbox
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 min-w-[130px]">
                          {item.refsCount > 0 ? (
                            <div className="space-y-1 max-w-[130px]">
                              <div className="flex items-center justify-between text-[11px] tabular-nums">
                                <span className="font-bold text-foreground">
                                  {item.conversionPct}%
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {item.selectedCount} sel · {item.productionCount} prod
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-sm bg-secondary overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full",
                                    item.conversionPct >= 50
                                      ? "bg-success"
                                      : "bg-foreground/80"
                                  )}
                                  style={{ width: `${item.conversionPct}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center tabular-nums">
                          {item.productionCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-secondary text-foreground font-bold text-[10px] border border-border">
                              {item.productionCount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">0</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center font-bold tabular-nums whitespace-nowrap">
                          {item.avgScore !== null ? (
                            <span className="inline-flex items-center gap-0.5 text-warning">
                              <Star className="size-3 fill-current" />
                              <span>{item.avgScore.toFixed(1)}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 font-normal">
                              —
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-[11px] font-mono rounded-md gap-1"
                            >
                              <Link
                                href={`/references?q=${encodeURIComponent(`@${item.handle}`)}`}
                              >
                                <Bookmark className="size-3" />
                                <span>Refs</span>
                              </Link>
                            </Button>

                            {profileUrl && (
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                              >
                                <a
                                  href={profileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Open @${item.handle} profile on ${item.platform.name}`}
                                  title="Open creator profile"
                                >
                                  <ExternalLink className="size-3.5" />
                                </a>
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(item)}
                              aria-label={`Edit @${item.handle}`}
                              title="Edit creator handle or notes"
                              className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="size-3.5" />
                            </Button>

                            {item.canDelete && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(item)}
                                aria-label={`Delete @${item.handle}`}
                                title="Delete unused creator"
                                className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}

                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] font-mono rounded-md"
                            >
                              <Link href={`/sources/${item.id}`}>Details</Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Shared Create / Edit Creator Modal */}
      <Dialog open={modalMode !== null} onOpenChange={handleModalOpenChange}>
        <DialogContent className="sm:max-w-md rounded-lg border bg-card shadow-none">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display">
              {modalMode === "edit" ? "Edit Source Creator" : "Add Source Creator"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleModalSubmit} className="space-y-4 pt-2">
            {modalMode === "create" && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="source-modal-platform"
                  className="label-mono text-muted-foreground"
                >
                  Platform *
                </Label>
                <SelectField
                  id="source-modal-platform"
                  ariaLabel="Platform"
                  value={formPlatformId}
                  onValueChange={setFormPlatformId}
                  options={platforms.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="source-modal-handle"
                className="label-mono text-muted-foreground"
              >
                Creator Handle *
              </Label>
              <Input
                id="source-modal-handle"
                required
                value={formHandle}
                onChange={(e) => setFormHandle(e.target.value)}
                placeholder="e.g. @creatorhandle"
                className="text-xs font-mono h-9 rounded-md"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="source-modal-notes"
                className="label-mono text-muted-foreground"
              >
                Notes &amp; Content Angles (Optional)
              </Label>
              <Textarea
                id="source-modal-notes"
                rows={3}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Why do we track this creator? Pacing, framing, hook pattern..."
                className="text-xs font-mono rounded-md"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border/70">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleModalOpenChange(false)}
                className="h-9 text-xs font-mono uppercase tracking-wider rounded-md"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="h-9 text-xs font-mono uppercase tracking-wider font-bold rounded-md bg-foreground text-background hover:bg-foreground/90"
              >
                {isPending
                  ? "Saving..."
                  : modalMode === "edit"
                    ? "Save Changes"
                    : "Save Creator"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Creator Account?"
        description={
          deleteTarget
            ? `Permanently remove @${deleteTarget.handle} (${deleteTarget.platform.name})?`
            : ""
        }
        confirmLabel="Delete Creator"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
