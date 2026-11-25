"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Music, Plus, Search, Filter, ArrowUpDown, ExternalLink, Disc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createAudio } from "@/lib/actions/audio";
import { toast } from "sonner";
import type { AudioListItem } from "@/lib/queries/audio";

interface AudioListClientProps {
  initialItems: AudioListItem[];
  initialUnusedOnly?: boolean;
}

export function AudioListClient({
  initialItems,
  initialUnusedOnly = false,
}: AudioListClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<AudioListItem[]>(initialItems);
  const [searchText, setSearchText] = useState("");
  const [filterUnused, setFilterUnused] = useState(initialUnusedOnly);
  const [sortBy, setSortBy] = useState<"recent" | "title" | "refs">("recent");

  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Create Audio Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [newIsOriginal, setNewIsOriginal] = useState(false);
  const [newNotes, setNewNotes] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Audio title is required");
      return;
    }

    startTransition(async () => {
      const res = await createAudio({
        title: newTitle.trim(),
        artist: newArtist.trim(),
        isOriginal: newIsOriginal,
        notes: newNotes.trim() || undefined,
      });

      if (res.ok) {
        toast.success("Audio track added");
        setIsCreateOpen(false);
        setNewTitle("");
        setNewArtist("");
        setNewNotes("");
        setNewIsOriginal(false);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const filteredItems = items
    .filter((item) => {
      if (filterUnused && !item.isUnused) return false;
      if (!searchText.trim()) return true;
      const term = searchText.toLowerCase();
      return (
        item.title.toLowerCase().includes(term) ||
        item.artist.toLowerCase().includes(term) ||
        (item.notes && item.notes.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "refs") return b.refsCount - a.refsCount;
      if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt);
      if (a.lastUsedAt) return -1;
      if (b.lastUsedAt) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

  return (
    <div className="space-y-6">
      {/* Controls Bar: Search, Filters & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search audio tracks or artists..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 h-9 text-xs font-mono bg-card"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Unused Filter Pill */}
          <button
            type="button"
            onClick={() => setFilterUnused(!filterUnused)}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md border transition-all ${
              filterUnused
                ? "bg-primary text-primary-foreground font-bold border-primary"
                : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            Unused Only
          </button>

          {/* Sort By Select */}
          <div className="flex items-center gap-1.5 bg-secondary/80 border border-border px-2.5 py-1 rounded-md text-xs font-mono">
            <ArrowUpDown className="size-3 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-mono uppercase tracking-wider outline-none text-foreground cursor-pointer"
            >
              <option value="recent">Recently Used</option>
              <option value="title">Title (A-Z)</option>
              <option value="refs">Reference Count</option>
            </select>
          </div>

          {/* New Audio Dialog */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 px-3 text-xs font-mono uppercase tracking-wider gap-1.5 font-bold">
                <Plus className="size-3.5" />
                <span>New Audio</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base font-bold font-display">Add Audio Track</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider">Audio Title *</Label>
                  <Input
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. As It Was"
                    className="text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider">Artist</Label>
                  <Input
                    value={newArtist}
                    onChange={(e) => setNewArtist(e.target.value)}
                    placeholder="e.g. Harry Styles"
                    className="text-xs font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isOriginal"
                    checked={newIsOriginal}
                    onChange={(e) => setNewIsOriginal(e.target.checked)}
                    className="size-4 rounded border-border"
                  />
                  <Label htmlFor="isOriginal" className="text-xs font-mono cursor-pointer">
                    Original Sound / Voiceover
                  </Label>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider">Notes (Optional)</Label>
                  <Input
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Tempo, vibe, or key visual transition notes"
                    className="text-xs font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateOpen(false)}
                    className="text-xs font-mono uppercase tracking-wider"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isPending}
                    className="text-xs font-mono uppercase tracking-wider font-bold"
                  >
                    {isPending ? "Saving..." : "Save Track"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Audio List Table / Grid */}
      {filteredItems.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-dashed border-border bg-card/40 space-y-3">
          <Music className="size-8 mx-auto text-muted-foreground/60" />
          <div className="text-sm font-semibold text-foreground font-display">No audio tracks found</div>
          <p className="text-xs font-mono text-muted-foreground max-w-sm mx-auto">
            {filterUnused
              ? "All saved audio tracks have already been used in produced contents."
              : "Save your first audio track or ingest references with audio attached."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-secondary/60 border-b border-border/80 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-bold">Track & Artist</th>
                  <th className="py-3 px-4 font-bold">Usage Status</th>
                  <th className="py-3 px-4 font-bold text-center">References</th>
                  <th className="py-3 px-4 font-bold text-center">Contents</th>
                  <th className="py-3 px-4 font-bold">Last Used</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary/30 transition-colors group">
                    <td className="py-3.5 px-4 font-sans">
                      <Link href={`/audio/${item.id}`} className="group-hover:underline">
                        <div className="font-bold text-foreground text-sm flex items-center gap-2">
                          <Disc className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[280px]">{item.title}</span>
                          {item.isOriginal && (
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border">
                              Original
                            </span>
                          )}
                        </div>
                      </Link>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {item.artist ? `@${item.artist}` : "Unknown artist"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {item.isUnused ? (
                        <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-primary text-primary-foreground">
                          Unused
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border">
                          In {item.contentsCount} {item.contentsCount === 1 ? "Post" : "Posts"}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-foreground">
                      {item.refsCount}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-foreground">
                      {item.contentsCount}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                      {item.lastUsedAt
                        ? new Date(item.lastUsedAt).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Never"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/audio/${item.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 text-[11px] font-mono uppercase tracking-wider"
                        >
                          Details
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
