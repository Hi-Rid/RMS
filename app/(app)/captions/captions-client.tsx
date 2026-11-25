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
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [activeTab, setActiveTab] = useState<"caption" | "hashtag_set">("caption");
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => {
    setSnippets(initialSnippets);
  }, [initialSnippets]);

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

  const handleCopy = async (snippet: SnippetItem) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(snippet.body);
      } else {
        // Fallback for iOS Safari
        const textarea = document.createElement("textarea");
        textarea.value = snippet.body;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiedId(snippet.id);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2000);

      // Record usage asynchronously
      markSnippetUsed(snippet.id);
      setSnippets((prev) =>
        prev.map((s) => (s.id === snippet.id ? { ...s, useCount: s.useCount + 1 } : s))
      );
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
        setNewTitle("");
        setNewBody("");
        setNewPillarId("");
        setNewPlatformId("");
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

  const handleDeleteConfirm = () => {
    if (!deletingSnippet) return;
    const target = deletingSnippet;
    setDeletingSnippet(null);

    startTransition(async () => {
      const res = await deleteSnippet(target.id);
      if (res.ok) {
        toast.success("Snippet deleted");
        setSnippets((prev) => prev.filter((item) => item.id !== target.id));
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const filteredSnippets = snippets.filter((s) => s.kind === activeTab);

  return (
    <div className="space-y-6">
      {/* Tab Switcher & New Snippet Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("caption")}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold transition-all rounded-md flex items-center gap-1.5 ${
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
            onClick={() => setActiveTab("hashtag_set")}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold transition-all rounded-md flex items-center gap-1.5 ${
              activeTab === "hashtag_set"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Hash className="size-3.5" />
            <span>Hashtag Sets</span>
          </button>
        </div>

        {/* New Snippet Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9 px-3 text-xs font-mono uppercase tracking-wider font-bold gap-1.5 self-start sm:self-auto">
              <Plus className="size-3.5" />
              <span>{activeTab === "caption" ? "New Caption" : "New Hashtag Set"}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-display">
                Create {newKind === "caption" ? "Caption Template" : "Hashtag Set"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider">Type</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewKind("caption")}
                    className={`flex-1 py-1.5 text-xs font-mono uppercase rounded border transition-all ${
                      newKind === "caption"
                        ? "bg-foreground text-background border-foreground font-bold"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    Caption Template
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewKind("hashtag_set")}
                    className={`flex-1 py-1.5 text-xs font-mono uppercase rounded border transition-all ${
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
                <Label className="text-xs font-mono uppercase tracking-wider">Title *</Label>
                <Input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={newKind === "caption" ? "e.g. Tutorial Closing CTA" : "e.g. Creator Economy Core Tags"}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider">Content Body *</Label>
                <Textarea
                  required
                  rows={4}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder={
                    newKind === "caption"
                      ? "Drop a comment below if you want the full template breakdown..."
                      : "#contentcreator #creatortips #videoediting #reelsstrategy"
                  }
                  className="text-xs font-mono resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider">Pillar (Optional)</Label>
                  <select
                    value={newPillarId}
                    onChange={(e) => setNewPillarId(e.target.value)}
                    className="w-full h-8 px-2 text-xs font-mono bg-background border border-border rounded"
                  >
                    <option value="">-- All Pillars --</option>
                    {pillars.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider">Platform (Optional)</Label>
                  <select
                    value={newPlatformId}
                    onChange={(e) => setNewPlatformId(e.target.value)}
                    className="w-full h-8 px-2 text-xs font-mono bg-background border border-border rounded"
                  >
                    <option value="">-- All Platforms --</option>
                    {platforms.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                  {isPending ? "Saving..." : "Save Snippet"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Snippets Grid */}
      {filteredSnippets.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-dashed border-border bg-card/40 space-y-3">
          {activeTab === "caption" ? (
            <Quote className="size-8 mx-auto text-muted-foreground/60" />
          ) : (
            <Hash className="size-8 mx-auto text-muted-foreground/60" />
          )}
          <div className="text-sm font-semibold text-foreground font-display">
            No {activeTab === "caption" ? "caption templates" : "hashtag sets"} yet
          </div>
          <p className="text-xs font-mono text-muted-foreground max-w-sm mx-auto">
            Save reusable captions and hashtag bundles for rapid 1-click copying during publishing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSnippets.map((snippet) => (
            <div
              key={snippet.id}
              className="bg-card border border-border rounded-xl p-4 space-y-3 flex flex-col justify-between hover:border-foreground/40 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
                    {snippet.pillarName || snippet.platformName || "Universal"}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Used {snippet.useCount}x
                  </span>
                </div>

                <h3 className="text-xs font-mono font-bold text-foreground">
                  {snippet.title}
                </h3>

                <pre className="p-3 rounded-lg bg-secondary/40 border border-border/80 text-xs font-mono text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed line-clamp-4 select-all">
                  {snippet.body}
                </pre>
              </div>

              {/* Action Bar */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartEdit(snippet)}
                    className="size-7 p-0 text-muted-foreground hover:text-foreground"
                    title="Edit snippet"
                  >
                    <Edit3 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingSnippet(snippet)}
                    className="size-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Delete snippet"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleCopy(snippet)}
                  className="h-7 px-3 text-[11px] font-mono uppercase tracking-wider font-bold gap-1.5"
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
          ))}
        </div>
      )}

      {/* Edit Snippet Modal */}
      {editingSnippet && (
        <Dialog open={Boolean(editingSnippet)} onOpenChange={(open) => !open && setEditingSnippet(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold font-display">Edit Snippet</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider">Title *</Label>
                <Input
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider">Content Body *</Label>
                <Textarea
                  required
                  rows={4}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="text-xs font-mono resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider">Pillar (Optional)</Label>
                  <select
                    value={editPillarId}
                    onChange={(e) => setEditPillarId(e.target.value)}
                    className="w-full h-8 px-2 text-xs font-mono bg-background border border-border rounded"
                  >
                    <option value="">-- All Pillars --</option>
                    {pillars.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider">Platform (Optional)</Label>
                  <select
                    value={editPlatformId}
                    onChange={(e) => setEditPlatformId(e.target.value)}
                    className="w-full h-8 px-2 text-xs font-mono bg-background border border-border rounded"
                  >
                    <option value="">-- All Platforms --</option>
                    {platforms.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSnippet(null)}
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
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Snippet Confirmation Dialog */}
      <AlertDialog
        open={Boolean(deletingSnippet)}
        onOpenChange={(open) => {
          if (!open) setDeletingSnippet(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Snippet?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deletingSnippet?.title}&rdquo; from your snippets library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirm}>
              Delete Snippet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
