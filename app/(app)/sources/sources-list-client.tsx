"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { Users, Search, ArrowUpDown, ExternalLink, Camera, Video, Film, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SourceListItem } from "@/lib/queries/sources";

interface SourcesListClientProps {
  initialItems: SourceListItem[];
}

function getPlatformBadge(slug: string) {
  switch (slug.toLowerCase()) {
    case "instagram":
      return "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/30";
    case "tiktok":
      return "bg-cyan-500/10 text-cyan-800 dark:text-cyan-400 border-cyan-500/30";
    case "youtube":
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export function SourcesListClient({ initialItems }: SourcesListClientProps) {
  const [items] = useState<SourceListItem[]>(initialItems);
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<"refs" | "handle">("refs");

  const filteredItems = items
    .filter((item) => {
      if (!searchText.trim()) return true;
      const term = searchText.toLowerCase();
      return (
        item.handle.toLowerCase().includes(term) ||
        item.platform.name.toLowerCase().includes(term) ||
        (item.notes && item.notes.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      if (sortBy === "handle") return a.handle.localeCompare(b.handle);
      return b.refsCount - a.refsCount;
    });

  return (
    <div className="space-y-6">
      {/* Controls Bar: Search & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search creator handles or platforms..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 h-9 text-xs font-mono bg-card"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-secondary/80 border border-border px-3 py-1.5 rounded-md text-xs font-mono self-start sm:self-auto">
          <ArrowUpDown className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground uppercase text-[10px]">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent text-xs font-mono uppercase tracking-wider outline-none text-foreground cursor-pointer font-bold"
          >
            <option value="refs">References Count</option>
            <option value="handle">Handle (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Sources Table / Grid */}
      {filteredItems.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-dashed border-border bg-card/40 space-y-3">
          <Users className="size-8 mx-auto text-muted-foreground/60" />
          <div className="text-sm font-semibold text-foreground font-display">No creator accounts found</div>
          <p className="text-xs font-mono text-muted-foreground max-w-sm mx-auto">
            Ingest references with creator handles or add them during Quick Capture.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-secondary/60 border-b border-border/80 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-bold">Creator Handle</th>
                  <th className="py-3 px-4 font-bold">Platform</th>
                  <th className="py-3 px-4 font-bold text-center">References</th>
                  <th className="py-3 px-4 font-bold text-center">Selected</th>
                  <th className="py-3 px-4 font-bold text-center">In Production</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary/30 transition-colors group">
                    <td className="py-3.5 px-4 font-sans">
                      <Link href={`/sources/${item.id}`} className="group-hover:underline">
                        <div className="font-bold text-foreground text-sm font-mono flex items-center gap-1.5">
                          <span>@{item.handle}</span>
                        </div>
                      </Link>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground truncate max-w-[260px] font-sans mt-0.5">
                          {item.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${getPlatformBadge(
                          item.platform.slug
                        )}`}
                      >
                        {item.platform.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-foreground">
                      {item.refsCount}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      {item.selectedCount > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-foreground text-background font-bold text-[10px]">
                          {item.selectedCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      {item.productionCount > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold text-[10px] border border-blue-500/30">
                          {item.productionCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/sources/${item.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-[11px] font-mono uppercase tracking-wider"
                        >
                          View References
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
