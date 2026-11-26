"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Music,
  Plus,
  Search,
  ArrowUpDown,
  Disc,
  X,
  RotateCcw,
  Star,
  Pencil,
  Trash2,
  Filter,
  Sparkles,
  FileVideo,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/app/empty-state";
import { SelectField } from "@/components/app/select-field";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createAudio, updateAudio, deleteAudio } from "@/lib/actions/audio";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AudioListItem, AudioSortOption } from "@/lib/queries/audio";

export type AudioScopeFilter = "all" | "unused" | "used" | "original";

interface AudioListClientProps {
  initialItems: AudioListItem[];
  initialScope?: AudioScopeFilter;
  initialQuery?: string;
  initialSort?: AudioSortOption;
}

const SORT_OPTIONS: { value: AudioSortOption; label: string }[] = [
  { value: "recent", label: "Recently Used" },
  { value: "refs", label: "Most Referenced" },
  { value: "contents", label: "Most Produced" },
  { value: "rating", label: "Highest Rated" },
  { value: "newest", label: "Newest Added" },
  { value: "title", label: "Title (A–Z)" },
];

const SHORT_DATE_UTC = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function AudioListClient({
  initialItems,
  initialScope = "all",
  initialQuery = "",
  initialSort = "recent",
}: AudioListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const items = initialItems;
  const [searchText, setSearchText] = useState(initialQuery);
  const [scope, setScope] = useState<AudioScopeFilter>(initialScope);
  const [sortBy, setSortBy] = useState<AudioSortOption>(initialSort);

  const [prevQuery, setPrevQuery] = useState(initialQuery);
  if (prevQuery !== initialQuery) {
    setPrevQuery(initialQuery);
    setSearchText(initialQuery);
  }

  const [prevScope, setPrevScope] = useState(initialScope);
  if (prevScope !== initialScope) {
    setPrevScope(initialScope);
    setScope(initialScope);
  }

  const [prevSort, setPrevSort] = useState(initialSort);
  if (prevSort !== initialSort) {
    setPrevSort(initialSort);
    setSortBy(initialSort);
  }

  const syncUrlParams = React.useCallback(
    (q: string, nextScope: AudioScopeFilter, nextSort: AudioSortOption) => {
      const qp = new URLSearchParams();
      if (q.trim()) qp.set("q", q.trim());
      if (nextScope !== "all") qp.set("filter", nextScope);
      if (nextSort !== "recent") qp.set("sort", nextSort);
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

  // Debounced URL sync while typing (filtering itself is instantaneous in memory)
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      syncUrlParams(searchText, scope, sortBy);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText, scope, sortBy, syncUrlParams]);

  // Create & Edit Modal State
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<AudioListItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formArtist, setFormArtist] = useState("");
  const [formIsOriginal, setFormIsOriginal] = useState(false);
  const [formNotes, setFormNotes] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AudioListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const openCreateModal = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormArtist("");
    setFormIsOriginal(false);
    setFormNotes("");
    setModalMode("create");
  };

  const openEditModal = (item: AudioListItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormArtist(item.artist);
    setFormIsOriginal(item.isOriginal);
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Audio title is required");
      return;
    }

    if (modalMode === "edit" && editingItem) {
      startTransition(async () => {
        const res = await updateAudio({
          id: editingItem.id,
          title: formTitle.trim(),
          artist: formArtist.trim(),
          isOriginal: formIsOriginal,
          notes: formNotes.trim() || undefined,
        });
        if (res.ok) {
          toast.success("Audio track updated");
          setModalMode(null);
          setEditingItem(null);
          router.refresh();
        } else {
          toast.error(res.error.message);
        }
      });
      return;
    }

    const existsLocally = items.some(
      (i) =>
        i.title.toLowerCase().trim() === formTitle.toLowerCase().trim() &&
        i.artist.toLowerCase().trim() === formArtist.toLowerCase().trim()
    );

    startTransition(async () => {
      const res = await createAudio({
        title: formTitle.trim(),
        artist: formArtist.trim(),
        isOriginal: formIsOriginal,
        notes: formNotes.trim() || undefined,
      });

      if (res.ok) {
        if (existsLocally) {
          toast.info("Matching audio track already exists — opening existing track.", {
            action: {
              label: "Open",
              onClick: () => router.push(`/audio/${res.data.id}`),
            },
          });
        } else {
          toast.success("Audio track added");
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
      const res = await deleteAudio(deleteTarget.id);
      if (res.ok) {
        toast.success(`Deleted "${deleteTarget.title}"`);
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(res.error.message);
        setDeleteTarget(null);
      }
    });
  };

  // Summary metrics & scope counts across full catalog
  const counts = React.useMemo(() => {
    let unused = 0;
    let used = 0;
    let original = 0;
    let totalRefs = 0;
    for (const item of items) {
      if (item.isUnused) unused += 1;
      else used += 1;
      if (item.isOriginal) original += 1;
      totalRefs += item.refsCount;
    }
    return { total: items.length, unused, used, original, totalRefs };
  }, [items]);

  const filteredItems = React.useMemo(() => {
    const term = searchText.trim().toLowerCase();
    return items
      .filter((item) => {
        if (scope === "unused" && !item.isUnused) return false;
        if (scope === "used" && item.isUnused) return false;
        if (scope === "original" && !item.isOriginal) return false;
        if (!term) return true;
        return (
          item.title.toLowerCase().includes(term) ||
          item.artist.toLowerCase().includes(term) ||
          (item.notes && item.notes.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => {
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "refs")
          return b.refsCount - a.refsCount || b.createdAt.localeCompare(a.createdAt);
        if (sortBy === "contents")
          return (
            b.contentsCount - a.contentsCount ||
            b.refsCount - a.refsCount ||
            b.createdAt.localeCompare(a.createdAt)
          );
        if (sortBy === "rating")
          return (
            (b.avgRating ?? -1) - (a.avgRating ?? -1) ||
            b.postsCount - a.postsCount ||
            b.createdAt.localeCompare(a.createdAt)
          );
        if (sortBy === "newest") return b.createdAt.localeCompare(a.createdAt);
        if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt);
        if (a.lastUsedAt) return -1;
        if (b.lastUsedAt) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [items, scope, searchText, sortBy]);

  const hasFilters = Boolean(
    searchText.trim() || scope !== "all" || sortBy !== "recent"
  );

  const resetFilters = () => {
    setSearchText("");
    setScope("all");
    setSortBy("recent");
    syncUrlParams("", "all", "recent");
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
            <div className="label-mono text-muted-foreground">Total Catalog</div>
            <div className="text-xl font-black font-display text-foreground mt-1 tabular-nums">
              {counts.total}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setScope(scope === "unused" ? "all" : "unused")}
            className={cn(
              "text-left bg-card border rounded-lg p-3.5 transition-colors",
              scope === "unused"
                ? "border-brand bg-brand/5"
                : "border-border hover:border-foreground/30"
            )}
          >
            <div className="label-mono text-muted-foreground flex items-center justify-between">
              <span>Unused Sounds</span>
              {counts.unused > 0 && (
                <Sparkles className="size-3 text-brand" />
              )}
            </div>
            <div className="text-xl font-black font-display text-foreground mt-1 tabular-nums">
              {counts.unused}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setScope(scope === "original" ? "all" : "original")}
            className={cn(
              "text-left bg-card border rounded-lg p-3.5 transition-colors",
              scope === "original"
                ? "border-foreground/50 bg-secondary/40"
                : "border-border hover:border-foreground/30"
            )}
          >
            <div className="label-mono text-muted-foreground flex items-center justify-between">
              <span>Original / VO</span>
              <Mic className="size-3 text-muted-foreground" />
            </div>
            <div className="text-xl font-black font-display text-foreground mt-1 tabular-nums">
              {counts.original}
            </div>
          </button>

          <div className="bg-card border border-border rounded-lg p-3.5">
            <div className="label-mono text-muted-foreground">Linked Refs</div>
            <div className="text-xl font-black font-display text-foreground mt-1 tabular-nums">
              {counts.totalRefs}
            </div>
          </div>
        </div>
      )}

      {/* Search, Sort & Add Track Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search audio tracks, artists, or cues..."
            aria-label="Search audio library"
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

        <div className="flex items-center gap-2 flex-wrap">
          <SelectField
            ariaLabel="Sort audio tracks"
            value={sortBy}
            icon={<ArrowUpDown className="size-3" />}
            onValueChange={(val) => setSortBy(val as AudioSortOption)}
            className="w-auto min-w-[165px] bg-card font-mono text-xs rounded-md"
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
            <span>New Audio</span>
          </Button>
        </div>
      </div>

      {/* Scope Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border/80 pb-2">
        {(
          [
            { value: "all", label: "All Tracks", count: counts.total },
            { value: "unused", label: "Unused", count: counts.unused },
            { value: "used", label: "In Use", count: counts.used },
            { value: "original", label: "Original", count: counts.original },
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

      {/* Active Filter Summary */}
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
          {sortBy !== "recent" && (
            <button
              type="button"
              onClick={() => setSortBy("recent")}
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

      {/* Audio List */}
      {filteredItems.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<Music className="size-5" />}
            title="No matching audio tracks"
            description={
              scope === "unused" && !searchText.trim()
                ? "All saved audio tracks have already been used in produced content."
                : "No tracks match your current search or filter."
            }
            primaryAction={{
              label: "Clear Filters",
              onClick: resetFilters,
              icon: <RotateCcw className="size-3.5" />,
            }}
          />
        ) : (
          <EmptyState
            icon={<Music className="size-5" />}
            title="No audio tracks yet"
            description="Save trending sounds or voiceovers manually, or attach audio when capturing references."
            primaryAction={{
              label: "Add Audio Track",
              onClick: openCreateModal,
              icon: <Plus className="size-3.5" />,
            }}
          />
        )
      ) : (
        <>
          {/* Mobile Cards (< md) */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className="bg-card border border-border rounded-lg p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <Link
                      href={`/audio/${item.id}`}
                      className="font-bold text-foreground hover:text-brand text-sm font-display flex items-center gap-1.5 transition-colors"
                    >
                      <Disc className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {item.artist || "Unknown artist"}
                      {item.isOriginal && " · Original"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.avgRating !== null && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30 inline-flex items-center gap-0.5 tabular-nums">
                        <Star className="size-2.5 fill-current" />
                        <span>{item.avgRating}</span>
                      </span>
                    )}
                    {item.isUnused ? (
                      <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md bg-brand/10 text-brand border border-brand/30">
                        Unused
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border">
                        {item.contentsCount}{" "}
                        {item.contentsCount === 1 ? "Content" : "Contents"}
                      </span>
                    )}
                  </div>
                </div>

                {item.notes && (
                  <p className="text-[11px] font-mono text-muted-foreground line-clamp-1">
                    {item.notes}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground pt-2 border-t border-border/60 flex-wrap">
                  <span className="tabular-nums">
                    {item.refsCount} refs · {item.postsCount} posts
                    {item.lastUsedAt
                      ? ` · ${SHORT_DATE_UTC.format(new Date(item.lastUsedAt))}`
                      : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] font-mono rounded-md gap-1"
                    >
                      <Link href={`/contents/new?audioId=${item.id}`}>
                        <FileVideo className="size-3" />
                        <span>Use</span>
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(item)}
                      aria-label={`Edit ${item.title}`}
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
                        aria-label={`Delete ${item.title}`}
                        className="h-7 w-7 p-0 rounded-md text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden md:block rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-secondary/50 border-b border-border/80 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">Track, Artist &amp; Cues</th>
                    <th className="py-2.5 px-4 font-bold">Status</th>
                    <th className="py-2.5 px-4 font-bold text-center">Refs</th>
                    <th className="py-2.5 px-4 font-bold text-center">Contents</th>
                    <th className="py-2.5 px-4 font-bold text-center">Avg Rating</th>
                    <th className="py-2.5 px-4 font-bold">Last Posted</th>
                    <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-secondary/30 transition-colors group"
                    >
                      <td className="py-3 px-4 max-w-[360px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <Disc className="size-3.5 text-muted-foreground shrink-0" />
                          <Link
                            href={`/audio/${item.id}`}
                            className="font-bold text-foreground text-sm font-display hover:text-brand transition-colors truncate"
                          >
                            {item.title}
                          </Link>
                          {item.isOriginal && (
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border shrink-0">
                              Original
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate pl-5">
                          {item.artist || "Unknown artist"}
                          {item.notes ? ` · ${item.notes}` : ""}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.isUnused ? (
                          <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md bg-brand/10 text-brand border border-brand/30">
                            Unused
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border">
                            In {item.contentsCount}{" "}
                            {item.contentsCount === 1 ? "Content" : "Contents"}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-foreground tabular-nums">
                        {item.refsCount}
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-foreground tabular-nums">
                        {item.contentsCount}
                        {item.postsCount > 0 && (
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            {item.postsCount} posted
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {item.avgRating !== null ? (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-warning tabular-nums">
                            <Star className="size-3 fill-current" />
                            <span>{item.avgRating}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-muted-foreground text-[11px] whitespace-nowrap tabular-nums">
                        {item.lastUsedAt
                          ? SHORT_DATE_UTC.format(new Date(item.lastUsedAt))
                          : "Never"}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-[11px] font-mono rounded-md gap-1"
                          >
                            <Link href={`/contents/new?audioId=${item.id}`}>
                              <FileVideo className="size-3" />
                              <span>Use Track</span>
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(item)}
                            aria-label={`Edit ${item.title}`}
                            title="Edit track"
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
                              aria-label={`Delete ${item.title}`}
                              title="Delete unused track"
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
                            <Link href={`/audio/${item.id}`}>Details</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Shared Create / Edit Audio Modal */}
      <Dialog open={modalMode !== null} onOpenChange={handleModalOpenChange}>
        <DialogContent className="sm:max-w-md rounded-lg border bg-card shadow-none">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display">
              {modalMode === "edit" ? "Edit Audio Track" : "Add Audio Track"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="audio-modal-title" className="label-mono text-muted-foreground">
                Audio Title *
              </Label>
              <Input
                id="audio-modal-title"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. As It Was"
                className="text-xs font-mono h-9 rounded-md"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audio-modal-artist" className="label-mono text-muted-foreground">
                Artist / Creator
              </Label>
              <Input
                id="audio-modal-artist"
                value={formArtist}
                onChange={(e) => setFormArtist(e.target.value)}
                placeholder="e.g. Harry Styles"
                className="text-xs font-mono h-9 rounded-md"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <Checkbox
                id="audio-modal-original"
                checked={formIsOriginal}
                onCheckedChange={(checked) => setFormIsOriginal(Boolean(checked))}
              />
              <Label
                htmlFor="audio-modal-original"
                className="text-xs font-mono cursor-pointer select-none"
              >
                Original Sound / Voiceover
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="audio-modal-notes" className="label-mono text-muted-foreground">
                Notes &amp; Editing Cues (Optional)
              </Label>
              <Textarea
                id="audio-modal-notes"
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Tempo, vibe, or beat drop timestamp (e.g. Drop at 0:08)"
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
                    : "Save Track"}
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
        title="Delete Audio Track?"
        description={
          deleteTarget
            ? `Permanently remove "${deleteTarget.title}" from your audio library?`
            : ""
        }
        confirmLabel="Delete Track"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
