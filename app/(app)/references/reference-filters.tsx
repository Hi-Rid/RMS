"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, X, Check, Archive } from "lucide-react";
import type { MasterData } from "@/lib/queries/references";

interface ReferenceFiltersProps {
  masterData: MasterData;
}

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Selected", value: "selected" },
  { label: "Production", value: "production" },
  { label: "Posted", value: "posted" },
  { label: "Evaluating", value: "evaluating" },
  { label: "Skipped", value: "skipped" },
  { label: "Inbox", value: "inbox" },
];

export function ReferenceFilters({ masterData }: ReferenceFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get("status") || "all";
  const currentPillar = searchParams.get("pillar") || "all";
  const currentPlatform = searchParams.get("platform") || "all";
  const currentFormat = searchParams.get("format") || "all";
  const currentUnused = searchParams.get("unused") === "1";
  const currentArchived = searchParams.get("archived") === "1";
  const currentQuery = searchParams.get("q") || "";

  const [searchTerm, setSearchTerm] = React.useState(currentQuery);

  const updateFilters = (updates: Record<string, string | null>) => {
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
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ q: searchTerm.trim() || null });
  };

  return (
    <div className="space-y-4">
      {/* Search Bar, Platform/Format Selects & Toggles */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search hook, url, notes, creator, tags..."
            className="pl-8 h-8 text-xs font-mono pr-8"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                updateFilters({ q: null });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={currentPlatform}
            onChange={(e) => updateFilters({ platform: e.target.value })}
            aria-label="Filter by platform"
            className="h-8 px-2.5 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:border-foreground"
          >
            <option value="all">All Platforms</option>
            {masterData.platforms.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={currentFormat}
            onChange={(e) => updateFilters({ format: e.target.value })}
            aria-label="Filter by format"
            className="h-8 px-2.5 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:border-foreground"
          >
            <option value="all">All Formats</option>
            {masterData.formats.map((f) => (
              <option key={f.id} value={f.slug}>
                {f.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => updateFilters({ unused: currentUnused ? null : "1" })}
            className={`px-3 py-1 h-8 text-xs font-mono rounded border transition-all flex items-center gap-1.5 select-none ${
              currentUnused
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {currentUnused && <Check className="size-3" />}
            <span>Unused only</span>
          </button>

          <button
            type="button"
            onClick={() => updateFilters({ archived: currentArchived ? null : "1" })}
            className={`px-3 py-1 h-8 text-xs font-mono rounded border transition-all flex items-center gap-1.5 select-none ${
              currentArchived
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            <Archive className="size-3" />
            <span>Archived</span>
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border/60">
        {statusOptions.map((opt) => {
          const isActive = currentStatus === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => updateFilters({ status: opt.value === "all" ? null : opt.value })}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all select-none whitespace-nowrap ${
                isActive
                  ? "bg-foreground text-background font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Pillar Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">
          Pillars:
        </span>
        <button
          onClick={() => updateFilters({ pillar: null })}
          className={`px-2.5 py-1 rounded border text-[11px] transition-all whitespace-nowrap ${
            currentPillar === "all"
              ? "bg-secondary text-foreground border-foreground/40 font-bold"
              : "text-muted-foreground border-transparent hover:border-border hover:text-foreground"
          }`}
        >
          All
        </button>
        {masterData.pillars.map((pillar) => {
          const isActive = currentPillar === pillar.slug;
          return (
            <button
              key={pillar.id}
              onClick={() => updateFilters({ pillar: isActive ? null : pillar.slug })}
              className={`px-2.5 py-1 rounded border text-[11px] transition-all whitespace-nowrap ${
                isActive
                  ? "bg-foreground text-background border-foreground font-bold"
                  : "text-muted-foreground border-border/80 bg-secondary/50 hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {pillar.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
