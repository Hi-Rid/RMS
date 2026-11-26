"use client";

import * as React from "react";
import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  X,
  RotateCcw,
  Archive,
  ArrowUpDown,
  AlertCircle,
  Sparkles,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/app/select-field";
import { cn } from "@/lib/utils";
import type { MasterData, ReferenceSortOption } from "@/lib/queries/references";
import type { SidebarCounts } from "@/lib/queries/home";

interface ReferenceFiltersProps {
  masterData: MasterData;
  counts?: SidebarCounts;
}

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "inbox", label: "Inbox" },
  { value: "selected", label: "Selected" },
  { value: "production", label: "Production" },
  { value: "posted", label: "Posted" },
  { value: "evaluating", label: "Evaluating" },
  { value: "skipped", label: "Skipped" },
] as const;

const SORT_OPTIONS: { value: ReferenceSortOption; label: string }[] = [
  { value: "recent", label: "Newest saved" },
  { value: "oldest", label: "Oldest saved" },
  { value: "updated", label: "Recently edited" },
  { value: "title", label: "Hook / Title A–Z" },
];

export function ReferenceFilters({ masterData, counts }: ReferenceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentStatus = searchParams.get("status") || "all";
  const currentPillar = searchParams.get("pillar") || "all";
  const currentPlatform = searchParams.get("platform") || "all";
  const currentFormat = searchParams.get("format") || "all";
  const currentHookType = searchParams.get("hookType") || "all";
  const currentUnused = searchParams.get("unused") === "1";
  const currentMissing = searchParams.get("missing") === "1";
  const currentArchived = searchParams.get("archived") === "1";
  const currentQuery = searchParams.get("q") || "";
  const rawSort = searchParams.get("sort");
  const currentSort: ReferenceSortOption =
    rawSort === "oldest" || rawSort === "updated" || rawSort === "title" ? rawSort : "recent";

  const [searchValue, setSearchValue] = useState(currentQuery);
  const [prevQuery, setPrevQuery] = useState(currentQuery);

  if (prevQuery !== currentQuery) {
    setPrevQuery(currentQuery);
    setSearchValue(currentQuery);
  }

  const navigateWithParams = React.useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutator(params);
      params.delete("page");
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/references?${qs}` : "/references", { scroll: false });
      });
    },
    [router, searchParams]
  );

  // Debounced live search
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchValue.trim();
      if (trimmed !== currentQuery.trim()) {
        navigateWithParams((params) => {
          if (trimmed) {
            params.set("q", trimmed);
          } else {
            params.delete("q");
          }
        });
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [searchValue, currentQuery, navigateWithParams]);

  const updateFilter = React.useCallback(
    (key: string, val: string | null) => {
      navigateWithParams((params) => {
        if (!val || val === "all") {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      });
    },
    [navigateWithParams]
  );

  const resetAll = () => {
    setSearchValue("");
    startTransition(() => {
      router.push("/references", { scroll: false });
    });
  };

  const pillarCountMap = useMemo(() => {
    if (!counts) return new Map<string, number>();
    return new Map(counts.pillars.map((p) => [p.slug, p.count]));
  }, [counts]);

  const getStatusCount = (statusValue: string): number | null => {
    if (!counts || currentArchived) return null;
    if (statusValue === "all") return counts.references;
    const key = statusValue as keyof SidebarCounts["statuses"];
    return counts.statuses[key] ?? 0;
  };

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; value: string; onClear: () => void }[] = [];
    if (currentQuery) {
      chips.push({
        key: "q",
        label: "Search",
        value: `"${currentQuery}"`,
        onClear: () => {
          setSearchValue("");
          updateFilter("q", null);
        },
      });
    }
    if (currentStatus !== "all") {
      const statusLabel = STATUS_TABS.find((t) => t.value === currentStatus)?.label || currentStatus;
      chips.push({
        key: "status",
        label: "Status",
        value: statusLabel,
        onClear: () => updateFilter("status", null),
      });
    }
    if (currentPillar !== "all") {
      const pillarName =
        masterData.pillars.find((p) => p.slug === currentPillar)?.name || currentPillar;
      chips.push({
        key: "pillar",
        label: "Pillar",
        value: pillarName,
        onClear: () => updateFilter("pillar", null),
      });
    }
    if (currentPlatform !== "all") {
      const platformName =
        masterData.platforms.find((p) => p.slug === currentPlatform)?.name || currentPlatform;
      chips.push({
        key: "platform",
        label: "Platform",
        value: platformName,
        onClear: () => updateFilter("platform", null),
      });
    }
    if (currentFormat !== "all") {
      const formatName =
        masterData.formats.find((f) => f.slug === currentFormat)?.name || currentFormat;
      chips.push({
        key: "format",
        label: "Format",
        value: formatName,
        onClear: () => updateFilter("format", null),
      });
    }
    if (currentHookType !== "all") {
      const hookName =
        masterData.hookTypes.find((h) => h.slug === currentHookType)?.name || currentHookType;
      chips.push({
        key: "hookType",
        label: "Hook",
        value: hookName,
        onClear: () => updateFilter("hookType", null),
      });
    }
    if (currentUnused) {
      chips.push({
        key: "unused",
        label: "Filter",
        value: "Unused only",
        onClear: () => updateFilter("unused", null),
      });
    }
    if (currentMissing) {
      chips.push({
        key: "missing",
        label: "Quality",
        value: "Needs details",
        onClear: () => updateFilter("missing", null),
      });
    }
    if (currentArchived) {
      chips.push({
        key: "archived",
        label: "Scope",
        value: "Archived",
        onClear: () => updateFilter("archived", null),
      });
    }
    if (currentSort !== "recent") {
      const sortLabel = SORT_OPTIONS.find((s) => s.value === currentSort)?.label || currentSort;
      chips.push({
        key: "sort",
        label: "Sort",
        value: sortLabel,
        onClear: () => updateFilter("sort", null),
      });
    }
    return chips;
  }, [
    currentQuery,
    currentStatus,
    currentPillar,
    currentPlatform,
    currentFormat,
    currentHookType,
    currentUnused,
    currentMissing,
    currentArchived,
    currentSort,
    masterData,
    updateFilter,
  ]);

  const hasFilters = activeFilterChips.length > 0;

  return (
    <div className={cn("space-y-3.5 transition-opacity", isPending && "opacity-75")}>
      {/* Row 1: Search & Dropdown Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchValue) {
                e.preventDefault();
                setSearchValue("");
                updateFilter("q", null);
              }
            }}
            placeholder="Search hooks, @creator, audio, visual notes, URL..."
            aria-label="Search references"
            className="h-9 pl-9 pr-8 text-xs font-mono bg-card border-border rounded-md focus-visible:border-foreground"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                updateFilter("q", null);
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <SelectField
            value={currentPlatform}
            onValueChange={(val) => updateFilter("platform", val)}
            ariaLabel="Filter by platform"
            className={cn(
              "w-auto min-w-[132px] max-w-[180px] rounded-md font-mono text-xs bg-card",
              currentPlatform !== "all" && "border-foreground font-semibold"
            )}
            options={[
              { value: "all", label: "All Platforms" },
              ...masterData.platforms.map((p) => ({ value: p.slug, label: p.name })),
            ]}
          />

          <SelectField
            value={currentFormat}
            onValueChange={(val) => updateFilter("format", val)}
            ariaLabel="Filter by format"
            className={cn(
              "w-auto min-w-[124px] max-w-[170px] rounded-md font-mono text-xs bg-card",
              currentFormat !== "all" && "border-foreground font-semibold"
            )}
            options={[
              { value: "all", label: "All Formats" },
              ...masterData.formats.map((f) => ({ value: f.slug, label: f.name })),
            ]}
          />

          {masterData.hookTypes.length > 0 && (
            <SelectField
              value={currentHookType}
              onValueChange={(val) => updateFilter("hookType", val)}
              ariaLabel="Filter by hook type"
              icon={<Sparkles className="size-3" />}
              className={cn(
                "w-auto min-w-[132px] max-w-[185px] rounded-md font-mono text-xs bg-card",
                currentHookType !== "all" && "border-foreground font-semibold"
              )}
              options={[
                { value: "all", label: "All Hooks" },
                ...masterData.hookTypes.map((h) => ({ value: h.slug, label: h.name })),
              ]}
            />
          )}

          <SelectField
            value={currentSort}
            onValueChange={(val) => updateFilter("sort", val === "recent" ? null : val)}
            ariaLabel="Sort references"
            icon={<ArrowUpDown className="size-3" />}
            className="w-auto min-w-[148px] max-w-[190px] rounded-md font-mono text-xs bg-card"
            options={SORT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          />
        </div>
      </div>

      {/* Row 2: Status Tabs (Left) + Quick Scope Toggles (Right) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const isActive = currentStatus === tab.value;
            const count = getStatusCount(tab.value);
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => updateFilter("status", tab.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-mono transition-colors shrink-0 inline-flex items-center gap-1.5",
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

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateFilter("unused", currentUnused ? null : "1")}
            aria-pressed={currentUnused}
            className={cn(
              "h-8 text-xs font-mono rounded-md px-2.5 transition-colors",
              currentUnused
                ? "bg-foreground text-background border-foreground hover:bg-foreground/90 hover:text-background"
                : "bg-card text-muted-foreground hover:text-foreground border-border"
            )}
          >
            Unused Only
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateFilter("missing", currentMissing ? null : "1")}
            aria-pressed={currentMissing}
            title="Show references missing hook, summary, or pillar"
            className={cn(
              "h-8 text-xs font-mono rounded-md px-2.5 gap-1.5 transition-colors",
              currentMissing
                ? "bg-warning/15 text-warning border-warning/40 hover:bg-warning/20"
                : "bg-card text-muted-foreground hover:text-foreground border-border"
            )}
          >
            <AlertCircle className="size-3.5" />
            <span>Needs Details</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateFilter("archived", currentArchived ? null : "1")}
            aria-pressed={currentArchived}
            className={cn(
              "h-8 text-xs font-mono rounded-md px-2.5 gap-1.5 transition-colors",
              currentArchived
                ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/15"
                : "bg-card text-muted-foreground hover:text-foreground border-border"
            )}
          >
            <Archive className="size-3.5" />
            <span>Archived</span>
          </Button>
        </div>
      </div>

      {/* Row 3: Wrapped Content Pillars */}
      {masterData.pillars.length > 0 && (
        <div className="flex items-start gap-2 flex-wrap">
          <span className="label-mono text-muted-foreground shrink-0 pt-1.5 pr-0.5">
            Pillars:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            <button
              type="button"
              onClick={() => updateFilter("pillar", "all")}
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
              const pCount = !currentArchived ? pillarCountMap.get(pillar.slug) : undefined;
              return (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => updateFilter("pillar", pillar.slug)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors shrink-0 inline-flex items-center gap-1.5",
                    isActive
                      ? "bg-brand/10 text-brand border-brand/35 font-semibold"
                      : "bg-card text-muted-foreground border-border/80 hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  <span>{pillar.name}</span>
                  {typeof pCount === "number" && (
                    <span
                      className={cn(
                        "text-[10px] tabular-nums",
                        isActive ? "text-brand/80" : "text-muted-foreground/80"
                      )}
                    >
                      {pCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 4: Removable Active Filter Chips */}
      {hasFilters && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
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
