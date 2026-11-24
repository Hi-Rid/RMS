"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckSquare,
  Square,
  Plus,
  Send,
  ExternalLink,
  Trash2,
  Save,
  Loader2,
  Clock,
  CheckCircle2,
  Star,
  Link as LinkIcon,
  Unlink,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  updateContent,
  toggleChecklistItem,
  addChecklistItem,
  deleteChecklistItem,
  unlinkReferenceFromContent,
} from "@/lib/actions/contents";
import { addPost, deletePost } from "@/lib/actions/posts";
import { aiGenerateHooks, aiDraftScript, type GeneratedHook } from "@/lib/actions/ai";
import { toast } from "sonner";
import type { ContentDetailItem } from "@/lib/queries/contents";
import type { MasterData } from "@/lib/queries/references";

interface ContentStudioClientProps {
  content: ContentDetailItem;
  masterData: MasterData;
}

export function ContentStudioClient({
  content,
  masterData,
}: ContentStudioClientProps) {
  const [isPending, startTransition] = useTransition();

  // Content editing state
  const [title, setTitle] = useState(content.title);
  const [hookText, setHookText] = useState(content.hookText || "");
  const [notes, setNotes] = useState(content.notes || "");
  const [workUrl, setWorkUrl] = useState(content.workUrl || "");
  const [plannedFor, setPlannedFor] = useState(content.plannedFor || "");

  // Checklist state
  const [checklist, setChecklist] = useState(content.checklist);
  const [newChecklistText, setNewChecklistText] = useState("");

  // Add post dialog state
  const [isAddPostOpen, setIsAddPostOpen] = useState(false);
  const [postPlatformId, setPostPlatformId] = useState(masterData.platforms[0]?.id || "");
  const [postUrl, setPostUrl] = useState("");
  const [postCaption, setPostCaption] = useState("");

  // Final rating state
  const [rating, setRating] = useState<number | null>(content.finalRating);

  // AI Assistant states
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [isDraftingScript, setIsDraftingScript] = useState(false);
  const [hookOptions, setHookOptions] = useState<GeneratedHook[]>([]);
  const [isHooksModalOpen, setIsHooksModalOpen] = useState(false);

  const handleGenerateHooks = async () => {
    setIsGeneratingHooks(true);
    try {
      const res = await aiGenerateHooks({
        topic: title,
        pillar: content.pillars[0]?.name,
        format: content.format?.name,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      setHookOptions(res.data.hooks);
      setIsHooksModalOpen(true);
    } catch {
      toast.error("Failed to generate hooks");
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  const handleApplyHook = (hook: GeneratedHook) => {
    setHookText(hook.text);
    setIsHooksModalOpen(false);
    toast.success(`Selected hook: "${hook.text}"`);
  };

  const handleDraftScript = async () => {
    setIsDraftingScript(true);
    try {
      const res = await aiDraftScript({
        title,
        hookText,
        notes,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      setNotes(res.data.script);
      toast.success("AI Script drafted! Check the editor below.");
    } catch {
      toast.error("Failed to draft script");
    } finally {
      setIsDraftingScript(false);
    }
  };

  const handleSaveDetails = () => {
    startTransition(async () => {
      const res = await updateContent({
        id: content.id,
        title,
        hookText,
        notes,
        workUrl: workUrl || null,
        plannedFor: plannedFor || null,
      });

      if (res.ok) {
        toast.success("Content details saved");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleToggleChecklist = (id: string, current: boolean) => {
    const next = !current;
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isDone: next } : item))
    );

    startTransition(async () => {
      await toggleChecklistItem({ id, isDone: next });
    });
  };

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    startTransition(async () => {
      const res = await addChecklistItem({
        contentId: content.id,
        label: newChecklistText.trim(),
      });
      if (res.ok) {
        setChecklist((prev) => [
          ...prev,
          {
            id: res.data.id,
            label: res.data.label,
            isDone: false,
            position: prev.length + 1,
          },
        ]);
        setNewChecklistText("");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleDeleteChecklistItem = (id: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
    startTransition(async () => {
      await deleteChecklistItem({ id, contentId: content.id });
    });
  };

  const handleUnlinkRef = (refId: string) => {
    if (!confirm("Unlink reference from this content? It will return to Selected.")) return;
    startTransition(async () => {
      const res = await unlinkReferenceFromContent({ contentId: content.id, refId });
      if (res.ok) {
        toast.success("Reference unlinked");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleAddPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postPlatformId) {
      toast.error("Please select a platform");
      return;
    }

    startTransition(async () => {
      const res = await addPost({
        contentId: content.id,
        platformId: postPlatformId,
        url: postUrl || null,
        caption: postCaption || undefined,
        postedAt: new Date().toISOString(),
      });

      if (res.ok) {
        toast.success("Post added! 3 Checkpoints generated.");
        setIsAddPostOpen(false);
        setPostUrl("");
        setPostCaption("");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleDeletePost = (postId: string) => {
    if (!confirm("Delete post? Checkpoint tracking will also be removed.")) return;
    startTransition(async () => {
      const res = await deletePost({ postId, contentId: content.id });
      if (res.ok) {
        toast.success("Post deleted");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleSetRating = (score: number) => {
    setRating(score);
    startTransition(async () => {
      const res = await updateContent({ id: content.id, finalRating: score });
      if (res.ok) {
        toast.success(`Rated ${score}/5`);
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const doneCount = checklist.filter((c) => c.isDone).length;
  const progressPct = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0;

  return (
    <div className="w-full max-w-6xl py-8 px-4 sm:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-4">
        <Link
          href="/contents"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Contents</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddPostOpen(true)}
            className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
          >
            <Send className="size-3.5" />
            <span>Publish Post</span>
          </Button>
        </div>
      </div>

      {/* Main Content Info Card */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {content.format && (
                <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-foreground text-background">
                  {content.format.name}
                </span>
              )}
              {content.series && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
                  {content.series.name}
                </span>
              )}
              <StatusBadge status={content.status} />
            </div>

            <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-foreground">
              {content.title}
            </h1>
          </div>

          {/* Rating */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Overall Evaluation Rating
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleSetRating(star)}
                  className={`p-1 transition-colors ${
                    rating && star <= rating
                      ? "text-amber-500 hover:text-amber-600"
                      : "text-muted-foreground/40 hover:text-foreground"
                  }`}
                >
                  <Star className={`size-4 ${rating && star <= rating ? "fill-current" : ""}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pillars */}
        {content.pillars.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {content.pillars.map((pillar) => (
              <span
                key={pillar.id}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary text-foreground border border-border font-medium"
              >
                {pillar.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Studio Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Script & Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Script Editor Card */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 flex-wrap gap-2">
              <h2 className="text-sm font-black font-display tracking-tight text-foreground flex items-center gap-1.5">
                <FileText className="size-4" />
                <span>Script & Production Notes</span>
              </h2>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateHooks}
                  disabled={isGeneratingHooks}
                  className="text-xs font-mono h-7 gap-1 border-border/80 hover:bg-secondary text-foreground"
                >
                  {isGeneratingHooks ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3 text-amber-500 fill-amber-500" />
                  )}
                  <span>AI Hooks</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDraftScript}
                  disabled={isDraftingScript}
                  className="text-xs font-mono h-7 gap-1 border-border/80 hover:bg-secondary text-foreground"
                >
                  {isDraftingScript ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3 text-amber-500 fill-amber-500" />
                  )}
                  <span>Draft Script</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handleSaveDetails}
                  disabled={isPending}
                  className="text-xs font-mono h-7 bg-foreground text-background font-bold gap-1"
                >
                  {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                  <span>Save</span>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Title
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs font-mono h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Opening Hook Line
                </Label>
                <Input
                  value={hookText}
                  onChange={(e) => setHookText(e.target.value)}
                  placeholder="The opening line or headline..."
                  className="text-xs font-mono h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Script / Outline & Cues
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Draft your script, scene breakdown, b-roll checklist..."
                  rows={8}
                  className="text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Work Asset / Drive Link
                  </Label>
                  <Input
                    value={workUrl}
                    onChange={(e) => setWorkUrl(e.target.value)}
                    placeholder="https://..."
                    className="text-xs font-mono h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Target Shoot Date
                  </Label>
                  <Input
                    type="date"
                    value={plannedFor}
                    onChange={(e) => setPlannedFor(e.target.value)}
                    className="text-xs font-mono h-9"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Published Posts & Snapshots Card */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="space-y-0.5">
                <h2 className="text-sm font-black font-display tracking-tight text-foreground flex items-center gap-2">
                  <Send className="size-4" />
                  <span>Published Posts & Performance Checkpoints</span>
                </h2>
                <p className="text-[11px] font-mono text-muted-foreground">
                  Posts auto-generate 24h, 7d, and 30d evaluation checkpoints
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddPostOpen(true)}
                className="text-xs font-mono h-7 gap-1"
              >
                <Plus className="size-3" />
                <span>Add Post</span>
              </Button>
            </div>

            {content.posts.length === 0 ? (
              <div className="p-8 text-center rounded border border-dashed border-border bg-secondary/30 space-y-2">
                <Clock className="size-6 mx-auto text-muted-foreground" />
                <p className="text-xs font-mono text-muted-foreground">
                  Not published yet. When ready, click "Add Post" to record the live URL and start tracking checkpoints.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {content.posts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 rounded border border-border bg-secondary/20 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-foreground text-background">
                          {post.platformName}
                        </span>
                        {post.url ? (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <span>Live Post</span>
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-xs font-mono text-muted-foreground">
                            (No URL provided)
                          </span>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePost(post.id)}
                        className="h-6 px-1.5 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>

                    {/* Checkpoints for this post */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      {post.snapshots.map((snap) => {
                        const isDone = snap.status === "done";
                        return (
                          <div
                            key={snap.id}
                            className={`p-2.5 rounded border text-xs font-mono space-y-1 ${
                              isDone
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-400"
                                : "bg-card border-border text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold uppercase tracking-wider">
                                {snap.checkpoint.toUpperCase()}
                              </span>
                              <StatusBadge status={snap.status} size="sm" />
                            </div>

                            {isDone ? (
                              <div className="text-[11px] font-mono text-foreground font-semibold">
                                {snap.views !== null && `${snap.views} views`}
                                {snap.rating !== null && ` • ${snap.rating}/5 rating`}
                              </div>
                            ) : (
                              <div className="text-[10px] text-muted-foreground/80">
                                Due: {new Date(snap.dueAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Checklist & Linked References */}
        <div className="space-y-6">
          {/* Production Checklist Card */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="space-y-1.5 border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground flex items-center gap-1.5">
                  <CheckSquare className="size-3.5" />
                  <span>Checklist</span>
                </h3>
                <span className="text-xs font-mono font-bold text-muted-foreground">
                  {doneCount}/{checklist.length} ({progressPct}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border/60">
                <div
                  className="h-full bg-foreground transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-2 rounded hover:bg-secondary/40 transition-colors group"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleChecklist(item.id, item.isDone)}
                    className="flex items-center gap-2 text-left flex-1"
                  >
                    {item.isDone ? (
                      <CheckSquare className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={`text-xs font-mono select-none ${
                        item.isDone
                          ? "line-through text-muted-foreground"
                          : "text-foreground font-medium"
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteChecklistItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddChecklist} className="pt-2 flex items-center gap-2">
              <Input
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                placeholder="Add step..."
                className="text-xs font-mono h-8"
              />
              <Button size="sm" type="submit" className="text-xs font-mono h-8 px-2.5">
                <Plus className="size-3.5" />
              </Button>
            </form>
          </div>

          {/* Linked References Card */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground flex items-center gap-1.5 border-b border-border/60 pb-3">
              <LinkIcon className="size-3.5" />
              <span>Linked References ({content.refs.length})</span>
            </h3>

            {content.refs.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground">
                No external references linked. (Original content)
              </p>
            ) : (
              <div className="space-y-2">
                {content.refs.map((ref) => (
                  <div
                    key={ref.id}
                    className="p-2.5 rounded border border-border bg-secondary/30 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                        {ref.platformName} • #{ref.contentPosition || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnlinkRef(ref.id)}
                        title="Unlink reference"
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Unlink className="size-3" />
                      </button>
                    </div>

                    <Link
                      href={`/references/${ref.id}`}
                      className="block text-xs font-mono text-foreground hover:underline line-clamp-2"
                    >
                      {ref.hookText || ref.url}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Post Dialog */}
      <Dialog open={isAddPostOpen} onOpenChange={setIsAddPostOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddPost}>
            <DialogHeader>
              <DialogTitle className="text-lg font-black font-display tracking-tight">
                Record Published Post
              </DialogTitle>
              <DialogDescription className="text-xs font-mono text-muted-foreground">
                Recording a post marks this content as POSTED and schedules 24h, 7d, and 30d snapshots.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Platform
                </Label>
                <select
                  value={postPlatformId}
                  onChange={(e) => setPostPlatformId(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:border-foreground"
                >
                  {masterData.platforms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Post URL (Optional)
                </Label>
                <Input
                  type="url"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  placeholder="https://instagram.com/p/..."
                  className="text-xs font-mono h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Caption or Post Notes (Optional)
                </Label>
                <Textarea
                  value={postCaption}
                  onChange={(e) => setPostCaption(e.target.value)}
                  placeholder="Caption used..."
                  rows={3}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddPostOpen(false)}
                className="text-xs font-mono h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
              >
                {isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                <span>Confirm Post</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Hook Picker Dialog */}
      <Dialog open={isHooksModalOpen} onOpenChange={setIsHooksModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-black font-display tracking-tight flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500 fill-amber-500" />
              <span>AI Viral Hook Suggestions</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-mono text-muted-foreground">
              Select any generated hook to apply directly to your content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {hookOptions.map((hook, idx) => (
              <div
                key={idx}
                onClick={() => handleApplyHook(hook)}
                className="p-3 rounded-lg border border-border bg-secondary/30 hover:border-foreground/60 hover:bg-secondary/70 cursor-pointer transition-all space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-foreground text-background">
                    {hook.archetype}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground group-hover:text-foreground">
                    Click to apply →
                  </span>
                </div>
                <p className="text-xs font-mono font-medium text-foreground">
                  "{hook.text}"
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  💡 {hook.whyItWorks}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
