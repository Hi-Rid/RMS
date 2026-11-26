"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/app/select-field";
import {
  Search,
  X,
  Archive,
  RotateCcw,
  ArrowUpDown,
  Sparkles,
  Calendar,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MasterData } from "@/lib/queries/references";
import type { ContentCounts, ContentSortOption } from "@/lib/queries/contents";

interface ContentFiltersProps {
  masterData: MasterData;
  seriesList: { id: string; name: string; slug: string }[];
  counts?: ContentCounts;
}

const STATUS_TABS = [
  { label: "All", value: "all" },
  { label: "Production", value: "production" },
  { label: "Posted", value: "posted" },
  { label: "Evaluating", value: "evaluating" },
] as const;

const SORT_OPTIONS: { value: ContentSortOption; label: string }[] = [
  { value: "recent", label: "Newest created" },
  { value: "updated", label: "Recently edited" },
  { value: "planned", label: "Planned soonest" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
  { value: "rating", label: "Highest rated" },
];

export function ContentFilters({
  masterData,
  seriesList,
  counts,
}: ContentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const currentStatus = searchParams.get("status") || "all";
  const currentPillar = searchParams.get("pillar") || "all";
  const currentFormat = searchParams.get("format") || "all";
  const currentSeries = searchParams.get("series") || "all";
  const currentHookType = searchParams.get("hookType") || "all";
  const rawPlanned = searchParams.get("planned");
  const currentPlanned =
    rawPlanned === "scheduled" || rawPlanned === "unscheduled" ? rawPlanned : "all";
  const currentArchived = searchParams.get("archived") === "1";
  const currentQuery = searchParams.get("q") || "";
  const rawSort = searchParams.get("sort");
  const currentSort: ContentSortOption =
    rawSort === "updated" ||
    rawSort === "planned" ||
    rawSort === "oldest" ||
    rawSort === "title" ||
    rawSort === "rating"
      ? rawSort
      : "recent";

  const [searchTerm, setSearchTerm] = React.useState(currentQuery);
  const [prevQuery, setPrevQuery] = React.useState(currentQuery);

  if (prevQuery !== currentQuery) {
    setPrevQuery(currentQuery);
    setSearchTerm(currentQuery);
  }

  const updateFilters = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!("page" in updates)) {
        params.delete("page");
      }
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  React.useEffect(() => {
    const clean = searchTerm.trim();
    if (clean === currentQuery.trim()) return;
    const timer = window.setTimeout(() => {
      updateFilters({ q: clean || null });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchTerm, currentQuery, updateFilters]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ q: searchTerm.trim() || null });
  };

  const resetAll = () => {
    setSearchTerm("");
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  };

  const getStatusCount = (statusValue: string): number | null => {
    if (!counts || currentArchived) return null;
    if (statusValue === "all") return counts.all;
    if (statusValue === "production") return counts.production;
    if (statusValue === "posted") return counts.posted;
    if (statusValue === "evaluating") return counts.evaluating;
    return null;
  };

  const activeFilterChips = React.useMemo(() => {
    const chips: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (currentQuery) {
      chips.push({
        key: "q",
        label: "Search",
        value: `"${currentQuery}"`,
        onClear: () => {
          setSearchTerm("");
          updateFilters({ q: null });
        },
      });
    }
    if (currentStatus !== "all") {
      const tabLabel =
        STATUS_TABS.find((t) => t.value === currentStatus)?.label || currentStatus;
      chips.push({
        key: "status",
        label: "Stage",
        value: tabLabel,
        onClear: () => updateFilters({ status: null }),
      });
    }
    if (currentPillar !== "all") {
      const pillarName =
        masterData.pillars.find((p) => p.slug === currentPillar)?.name || currentPillar;
      chips.push({
        key: "pillar",
        label: "Pillar",
        value: pillarName,
        onClear: () => updateFilters({ pillar: null }),
      });
    }
    if (currentFormat !== "all") {
      const fmtName =
        masterData.formats.find((f) => f.slug === currentFormat)?.name || currentFormat;
      chips.push({
        key: "format",
        label: "Format",
        value: fmtName,
        onClear: () => updateFilters({ format: null }),
      });
    }
    if (currentSeries !== "all") {
      const serName =
        seriesList.find((s) => s.id === currentSeries)?.name || "Selected series";
      chips.push({
        key: "series",
        label: "Series",
        value: serName,
        onClear: () => updateFilters({ series: null }),
      });
    }
    if (currentHookType !== "all") {
      const hookName =
        masterData.hookTypes.find((h) => h.slug === currentHookType)?.name || currentHookType;
      chips.push({
        key: "hookType",
        label: "Hook",
        value: hookName,
        onClear: () => updateFilters({ hookType: null }),
      });
    }
    if (currentPlanned !== "all") {
      chips.push({
        key: "planned",
        label: "Schedule",
        value: currentPlanned === "scheduled" ? "Scheduled" : "Unscheduled",
        onClear: () => updateFilters({ planned: null }),
      });
    }
    if (currentArchived) {
      chips.push({
        key: "archived",
        label: "Scope",
        value: "Archived",
        onClear: () => updateFilters({ archived: null }),
      });
    }
    if (currentSort !== "recent") {
      const sortLabel =
        SORT_OPTIONS.find((s) => s.value === currentSort)?.label || currentSort;
      chips.push({
        key: "sort",
        label: "Sort",
        value: sortLabel,
        onClear: () => updateFilters({ sort: null }),
      });
    }
    return chips;
  }, [
    currentQuery,
    currentStatus,
    currentPillar,
    currentFormat,
    currentSeries,
    currentHookType,
    currentPlanned,
    currentArchived,
    currentSort,
    masterData,
    seriesList,
    updateFilters,
  ]);

  const hasActiveFilters = activeFilterChips.length > 0;

  return (
    <div className={cn("space-y-3.5 transition-opacity", isPending && "opacity-75")}>
      {/* Row 1: Search & Dropdown Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-2.5">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchTerm) {
                e.preventDefault();
                setSearchTerm("");
                updateFilters({ q: null });
              }
            }}
            placeholder="Search title, hook, script, series, audio..."
            aria-label="Search contents"
            className="pl-9 pr-8 h-9 text-xs font-mono bg-card border-border rounded-md focus-visible:border-foreground"
          />
          {searchTerm && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearchTerm("");
                updateFilters({ q: null });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <SelectField
            value={currentFormat}
            onValueChange={(val) => updateFilters({ format: val })}
            ariaLabel="Filter by format"
            className={cn(
              "w-auto min-w-[122px] max-w-[170px] bg-card font-mono text-xs rounded-md",
              currentFormat !== "all" && "border-foreground font-semibold"
            )}
            options={[
              { value: "all", label: "All Formats" },
              ...masterData.formats.map((f) => ({ value: f.slug, label: f.name })),
            ]}
          />

          <SelectField
            value={currentSeries}
            onValueChange={(val) => updateFilters({ series: val })}
            ariaLabel="Filter by series"
            className={cn(
              "w-auto min-w-[122px] max-w-[180px] bg-card font-mono text-xs rounded-md",
              currentSeries !== "all" && "border-foreground font-semibold"
            )}
            options={[
              { value: "all", label: "All Series" },
              ...seriesList.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />

          {masterData.hookTypes.length > 0 && (
            <SelectField
              value={currentHookType}
              onValueChange={(val) => updateFilters({ hookType: val })}
              ariaLabel="Filter by hook type"
              icon={<Sparkles className="size-3" />}
              className={cn(
                "w-auto min-w-[124px] max-w-[175px] bg-card font-mono text-xs rounded-md",
                currentHookType !== "all" && "border-foreground font-semibold"
              )}
              options={[
                { value: "all", label: "All Hooks" },
                ...masterData.hookTypes.map((h) => ({ value: h.slug, label: h.name })),
              ]}
            />
          )}

          <SelectField
            value={currentPlanned}
            onValueChange={(val) => updateFilters({ planned: val === "all" ? null : val })}
            ariaLabel="Filter by schedule"
            icon={<Calendar className="size-3" />}
            className={cn(
              "w-auto min-w-[130px] max-w-[175px] bg-card font-mono text-xs rounded-md",
              currentPlanned !== "all" && "border-foreground font-semibold"
            )}
            options={[
              { value: "all", label: "Any Schedule" },
              { value: "scheduled", label: "Scheduled only" },
              { value: "unscheduled", label: "Unscheduled" },
            ]}
          />

          <SelectField
            value={currentSort}
            onValueChange={(val) => updateFilters({ sort: val === "recent" ? null : val })}
            ariaLabel="Sort contents"
            icon={<ArrowUpDown className="size-3" />}
            className="w-auto min-w-[146px] max-w-[185px] bg-card font-mono text-xs rounded-md"
            options={SORT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        </div>
      </div>

      {/* Row 2: Pipeline Status Tabs (Left) + Archived Toggle (Right) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const isActive = currentStatus === tab.value;
            const count = getStatusCount(tab.value);
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  updateFilters({ status: tab.value === "all" ? null : tab.value })
                }
                className={cn(
                  "px-3 py-1.5 text-xs font-mono rounded-md transition-colors shrink-0 inline-flex items-center gap-1.5",
                  isActive
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <span>{tab.label}</span>
                {count !== null && (
                  <span
                    className={cn(
                      "text-[10px] tabular-nums px-1 py-0.5 rounded",
                      isActive
                        ? "bg-background/15 text-background"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={currentArchived}
          onClick={() => updateFilters({ archived: currentArchived ? null : "1" })}
          className={cn(
            "h-8 px-2.5 text-xs font-mono rounded-md gap-1.5 transition-colors self-start sm:self-auto shrink-0",
            currentArchived
              ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/15"
              : "bg-card text-muted-foreground hover:text-foreground border-border"
          )}
        >
          <Archive className="size-3.5" />
          <span>Archived</span>
          {counts && counts.archived > 0 && !currentArchived && (
            <span className="text-[10px] tabular-nums text-muted-foreground/80">
              ({counts.archived})
            </span>
          )}
        </Button>
      </div>

      {/* Row 3: Wrapped Pillar Chips */}
      {masterData.pillars.length > 0 && (
        <div className="flex items-start gap-2 flex-wrap">
          <span className="label-mono text-muted-foreground shrink-0 pt-1.5 pr-0.5">
            Pillars:
          </span>
          <div className="flex items-center flex-wrap gap-1.5 flex-1">
            <button
              type="button"
              onClick={() => updateFilters({ pillar: null })}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors shrink-0",
                currentPillar === "all"
                  ? "bg-brand/10 text-brand border-brand/35 font-semibold"
                  : "bg-card text-muted-foreground border-border/80 hover:border-foreground/30 hover:text-foreground"
              )}
            >
              All Pillars
            </button>
            {masterData.pillars.map((pillar) => {
              const isActive = currentPillar === pillar.slug;
              return (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => updateFilters({ pillar: isActive ? null : pillar.slug })}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors shrink-0",
                    isActive
                      ? "bg-brand/10 text-brand border-brand/35 font-semibold"
                      : "bg-card text-muted-foreground border-border/80 hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  {pillar.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 4: Removable Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
            <Filter className="size-3" />
            Active:
          </span>
          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClear}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/80 border border-border text-[11px] font-mono text-foreground hover:border-foreground/40 transition-colors"
            >
              <span className="text-muted-foreground">{chip.label}:</span>
              <span className="font-medium max-w-[160px] truncate">{chip.value}</span>
              <X className="size-3 text-muted-foreground hover:text-foreground" />
            </button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="h-6 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground gap-1 rounded-md"
          >
            <RotateCcw className="size-3" />
            <span>Reset all</span>
          </Button>
        </div>
      )}
    </div>
  );
}
