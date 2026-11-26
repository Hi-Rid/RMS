"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Quote,
  Hash,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit3,
  Search,
  X,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { createSnippet, updateSnippet, deleteSnippet, markSnippetUsed } from "@/lib/actions/captions";
import { toast } from "sonner";
import type { SnippetItem } from "@/lib/queries/captions";

interface CaptionsClientProps {
  initialSnippets: SnippetItem[];
  pillars: { id: string; name: string }[];
  platforms: { id: string; name: string }[];
}

export function CaptionsClient({
  initialSnippets,
  pillars,
  platforms,
}: CaptionsClientProps) {
  const router = useRouter();
  const [snippets, setSnippets] = useState<SnippetItem[]>(initialSnippets);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = React.useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<"caption" | "hashtag_set">("caption");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPillarId, setFilterPillarId] = useState("");
  const [filterPlatformId, setFilterPlatformId] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => {
    setSnippets(initialSnippets);
  }, [initialSnippets]);

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newKind, setNewKind] = useState<"caption" | "hashtag_set">("caption");
  const [newPillarId, setNewPillarId] = useState("");
  const [newPlatformId, setNewPlatformId] = useState("");

  // Edit Modal State
  const [editingSnippet, setEditingSnippet] = useState<SnippetItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editPillarId, setEditPillarId] = useState("");
  const [editPlatformId, setEditPlatformId] = useState("");

  // Delete Confirmation State
  const [deletingSnippet, setDeletingSnippet] = useState<SnippetItem | null>(null);

  const openCreateModal = () => {
    setNewKind(activeTab);
    setNewTitle("");
    setNewBody("");
    setNewPillarId("");
    setNewPlatformId("");
    setIsCreateOpen(true);
  };

  const handleCopy = async (snippet: SnippetItem) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet.body);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = snippet.body;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      setCopiedId(snippet.id);
      toast.success("Copied to clipboard!");
      copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 2000);

      void markSnippetUsed(snippet.id)
        .then((res) => {
          if (res?.ok) {
            setSnippets((prev) =>
              prev.map((s) => (s.id === snippet.id ? { ...s, useCount: s.useCount + 1 } : s))
            );
          }
        })
        .catch(() => {});
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) {
      toast.error("Title and body are required");
      return;
    }

    startTransition(async () => {
      const res = await createSnippet({
        kind: newKind,
        title: newTitle.trim(),
        body: newBody.trim(),
        pillarId: newPillarId || undefined,
        platformId: newPlatformId || undefined,
      });

      if (res.ok) {
        toast.success(`${newKind === "caption" ? "Caption template" : "Hashtag set"} created`);
        setIsCreateOpen(false);
        setActiveTab(newKind);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleStartEdit = (s: SnippetItem) => {
    setEditingSnippet(s);
    setEditTitle(s.title);
    setEditBody(s.body);
    setEditPillarId(s.pillarId || "");
    setEditPlatformId(s.platformId || "");
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSnippet) return;
    if (!editTitle.trim() || !editBody.trim()) {
      toast.error("Title and body cannot be empty");
      return;
    }

    startTransition(async () => {
      const res = await updateSnippet({
        id: editingSnippet.id,
        title: editTitle.trim(),
        body: editBody.trim(),
        pillarId: editPillarId || undefined,
        platformId: editPlatformId || undefined,
      });

      if (res.ok) {
        toast.success("Snippet updated");
        setEditingSnippet(null);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSnippet) return;
    const target = deletingSnippet;
    const res = await deleteSnippet(target.id);
    if (res.ok) {
      toast.success("Snippet deleted");
      setSnippets((prev) => prev.filter((item) => item.id !== target.id));
      setDeletingSnippet(null);
      router.refresh();
    } else {
      toast.error(res.error.message);
    }
  };

  const filteredSnippets = snippets.filter((s) => {
    if (s.kind !== activeTab) return false;
    if (filterPillarId && s.pillarId !== filterPillarId) return false;
    if (filterPlatformId && s.platformId !== filterPlatformId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q);
    }
    return true;
  });

  const hasFilters = Boolean(searchQuery.trim() || filterPillarId || filterPlatformId);

  return (
    <div className="space-y-6">
      {/* Tab Switcher & New Snippet Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            aria-pressed={activeTab === "caption"}
            onClick={() => setActiveTab("caption")}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold transition-colors rounded-md flex items-center gap-1.5 ${
              activeTab === "caption"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Quote className="size-3.5" />
            <span>Caption Templates</span>
          </button>

          <button
            type="button"
            aria-pressed={activeTab === "hashtag_set"}
            onClick={() => setActiveTab("hashtag_set")}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold transition-colors rounded-md flex items-center gap-1.5 ${
              activeTab === "hashtag_set"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Hash className="size-3.5" />
            <span>Hashtag Sets</span>
          </button>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={openCreateModal}
          className="h-9 px-3 text-xs font-mono uppercase tracking-wider font-bold rounded-md gap-1.5 self-start sm:self-auto"
        >
          <Plus className="size-3.5" />
          <span>{activeTab === "caption" ? "New Caption" : "New Hashtag Set"}</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search snippet title or text..."
            aria-label="Search captions and hashtags"
            className="pl-9 pr-8 h-9 text-xs font-mono rounded-md bg-card"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SelectField
            ariaLabel="Filter by pillar"
            value={filterPillarId}
            onValueChange={setFilterPillarId}
            className={`w-auto min-w-[140px] max-w-[190px] ${
              filterPillarId ? "border-foreground font-semibold" : ""
            }`}
            options={[
              { value: "", label: "All Pillars" },
              ...pillars.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />

          <SelectField
            ariaLabel="Filter by platform"
            value={filterPlatformId}
            onValueChange={setFilterPlatformId}
            className={`w-auto min-w-[140px] max-w-[190px] ${
              filterPlatformId ? "border-foreground font-semibold" : ""
            }`}
            options={[
              { value: "", label: "All Platforms" },
              ...platforms.map((pl) => ({ value: pl.id, label: pl.name })),
            ]}
          />

          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setFilterPillarId("");
                setFilterPlatformId("");
              }}
              className="h-9 px-2.5 text-xs font-mono rounded-md gap-1 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* Snippets Grid */}
      {filteredSnippets.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={activeTab === "caption" ? <Quote className="size-5" /> : <Hash className="size-5" />}
            title="No matching snippets"
            description="No saved snippets match your active search, pillar, or platform filters."
            primaryAction={{
              label: "Clear Filters",
              onClick: () => {
                setSearchQuery("");
                setFilterPillarId("");
                setFilterPlatformId("");
              },
              icon: <RotateCcw className="size-3.5" />,
            }}
          />
        ) : (
          <EmptyState
            icon={activeTab === "caption" ? <Quote className="size-5" /> : <Hash className="size-5" />}
            title={`No ${activeTab === "caption" ? "caption templates" : "hashtag sets"} yet`}
            description="Save reusable captions and hashtag bundles for rapid 1-click copying during publishing."
            primaryAction={{
              label: activeTab === "caption" ? "New Caption" : "New Hashtag Set",
              onClick: openCreateModal,
              icon: <Plus className="size-3.5" />,
            }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSnippets.map((snippet) => {
            const isExpanded = Boolean(expandedIds[snippet.id]);
            const isLong = snippet.body.split("\n").length > 4 || snippet.body.length > 220;

            return (
              <div
                key={snippet.id}
                className="bg-card border border-border rounded-lg p-4 space-y-3 flex flex-col justify-between hover:border-foreground/40 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {snippet.pillarName && (
                        <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border">
                          {snippet.pillarName}
                        </span>
                      )}
                      {snippet.platformName && (
                        <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                          {snippet.platformName}
                        </span>
                      )}
                      {!snippet.pillarName && !snippet.platformName && (
                        <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border">
                          Universal
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                      Used {snippet.useCount}x
                    </span>
                  </div>

                  <h3 className="text-xs font-mono font-bold text-foreground">
                    {snippet.title}
                  </h3>

                  <pre
                    className={`p-3 rounded-md bg-secondary/40 border border-border/80 text-xs font-mono text-foreground/90 whitespace-pre-wrap leading-relaxed select-all ${
                      isExpanded ? "" : "line-clamp-4"
                    }`}
                  >
                    {snippet.body}
                  </pre>

                  {isLong && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIds((prev) => ({
                          ...prev,
                          [snippet.id]: !prev[snippet.id],
                        }))
                      }
                      className="text-[11px] font-mono text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      {isExpanded ? "Show less" : "Show full text"}
                    </button>
                  )}
                </div>

                {/* Action Bar */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(snippet)}
                      className="size-8 p-0 text-muted-foreground hover:text-foreground rounded-md"
                      title="Edit snippet"
                      aria-label={`Edit ${snippet.title}`}
                    >
                      <Edit3 className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingSnippet(snippet)}
                      className="size-8 p-0 text-muted-foreground hover:text-destructive rounded-md"
                      title="Delete snippet"
                      aria-label={`Delete ${snippet.title}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCopy(snippet)}
                    className="h-8 px-3 text-[11px] font-mono uppercase tracking-wider font-bold rounded-md gap-1.5"
                  >
                    {copiedId === snippet.id ? (
                      <>
                        <Check className="size-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Snippet Modal */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => !isPending && setIsCreateOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display">
              Create {newKind === "caption" ? "Caption Template" : "Hashtag Set"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="label-mono text-muted-foreground">Type</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={newKind === "caption"}
                  onClick={() => setNewKind("caption")}
                  className={`flex-1 py-2 text-xs font-mono uppercase rounded-md border transition-colors ${
                    newKind === "caption"
                      ? "bg-foreground text-background border-foreground font-bold"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  Caption Template
                </button>
                <button
                  type="button"
                  aria-pressed={newKind === "hashtag_set"}
                  onClick={() => setNewKind("hashtag_set")}
                  className={`flex-1 py-2 text-xs font-mono uppercase rounded-md border transition-colors ${
                    newKind === "hashtag_set"
                      ? "bg-foreground text-background border-foreground font-bold"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  Hashtag Set
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="snippet-new-title" className="label-mono text-muted-foreground">
                Title *
              </Label>
              <Input
                id="snippet-new-title"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={
                  newKind === "caption"
                    ? "e.g. Tutorial Closing CTA"
                    : "e.g. Creator Economy Core Tags"
                }
                className="text-xs font-mono h-9 rounded-md"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="snippet-new-body" className="label-mono text-muted-foreground">
                Content Body *
              </Label>
              <Textarea
                id="snippet-new-body"
                required
                rows={4}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder={
                  newKind === "caption"
                    ? "Drop a comment below if you want the full template breakdown..."
                    : "#contentcreator #creatortips #videoediting #reelsstrategy"
                }
                className="text-xs font-mono leading-relaxed rounded-md"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="snippet-new-pillar" className="label-mono text-muted-foreground">
                  Pillar (Optional)
                </Label>
                <SelectField
                  id="snippet-new-pillar"
                  value={newPillarId}
                  onValueChange={setNewPillarId}
                  ariaLabel="Pillar (Optional)"
                  options={[
                    { value: "", label: "-- All Pillars --" },
                    ...pillars.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="snippet-new-platform" className="label-mono text-muted-foreground">
                  Platform (Optional)
                </Label>
                <SelectField
                  id="snippet-new-platform"
                  value={newPlatformId}
                  onValueChange={setNewPlatformId}
                  ariaLabel="Platform (Optional)"
                  options={[
                    { value: "", label: "-- All Platforms --" },
                    ...platforms.map((pl) => ({ value: pl.id, label: pl.name })),
                  ]}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setIsCreateOpen(false)}
                className="h-9 text-xs font-mono uppercase tracking-wider rounded-md"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="h-9 text-xs font-mono uppercase tracking-wider font-bold rounded-md"
              >
                {isPending ? "Saving..." : "Save Snippet"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Snippet Modal */}
      {editingSnippet && (
        <Dialog
          open={Boolean(editingSnippet)}
          onOpenChange={(open) => !isPending && !open && setEditingSnippet(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-display">Edit Snippet</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="snippet-edit-title" className="label-mono text-muted-foreground">
                  Title *
                </Label>
                <Input
                  id="snippet-edit-title"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xs font-mono h-9 rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="snippet-edit-body" className="label-mono text-muted-foreground">
                  Content Body *
                </Label>
                <Textarea
                  id="snippet-edit-body"
                  required
                  rows={4}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="text-xs font-mono leading-relaxed rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="snippet-edit-pillar" className="label-mono text-muted-foreground">
                    Pillar (Optional)
                  </Label>
                  <SelectField
                    id="snippet-edit-pillar"
                    value={editPillarId}
                    onValueChange={setEditPillarId}
                    ariaLabel="Pillar (Optional)"
                    options={[
                      { value: "", label: "-- All Pillars --" },
                      ...pillars.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="snippet-edit-platform" className="label-mono text-muted-foreground">
                    Platform (Optional)
                  </Label>
                  <SelectField
                    id="snippet-edit-platform"
                    value={editPlatformId}
                    onValueChange={setEditPlatformId}
                    ariaLabel="Platform (Optional)"
                    options={[
                      { value: "", label: "-- All Platforms --" },
                      ...platforms.map((pl) => ({ value: pl.id, label: pl.name })),
                    ]}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setEditingSnippet(null)}
                  className="h-9 text-xs font-mono uppercase tracking-wider rounded-md"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="h-9 text-xs font-mono uppercase tracking-wider font-bold rounded-md"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={Boolean(deletingSnippet)}
        onOpenChange={(open) => !open && setDeletingSnippet(null)}
        title="Delete Snippet?"
        description={`This will permanently delete "${deletingSnippet?.title || ""}" from your snippets library.`}
        confirmLabel="Delete Snippet"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={isPending}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
