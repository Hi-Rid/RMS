"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/app/status-badge";
import { SelectField } from "@/components/app/select-field";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
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
  Star,
  Link as LinkIcon,
  Unlink,
  FileText,
  Sparkles,
  Archive,
  RotateCcw,
  X,
} from "lucide-react";
import {
  updateContent,
  toggleChecklistItem,
  addChecklistItem,
  deleteChecklistItem,
  linkReferenceToContent,
  unlinkReferenceFromContent,
  archiveContent,
  restoreContent,
  deleteContentPermanently,
} from "@/lib/actions/contents";
import { addPost, deletePost } from "@/lib/actions/posts";
import {
  aiGenerateHooks,
  aiDraftScript,
  aiGenerateCaption,
  type GeneratedHook,
} from "@/lib/actions/ai";
import { toast } from "sonner";
import type { ContentDetailItem, StudioMasterOptions } from "@/lib/queries/contents";
import type { MasterData } from "@/lib/queries/references";

interface ContentStudioClientProps {
  content: ContentDetailItem;
  masterData: MasterData;
  studioOptions: StudioMasterOptions;
}

function getLocalDatetimeInputValue(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ContentStudioClient({
  content,
  masterData,
  studioOptions,
}: ContentStudioClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Content metadata & script state
  const [title, setTitle] = useState(content.title);
  const [formatId, setFormatId] = useState(content.format?.id || "");
  const [seriesId, setSeriesId] = useState(content.series?.id || "");
  const [hookTypeId, setHookTypeId] = useState(content.hookType?.id || "");
  const [audioId, setAudioId] = useState(content.audio?.id || "");
  const [selectedPillars, setSelectedPillars] = useState<string[]>(
    content.pillars.map((p) => p.id)
  );
  const [hookText, setHookText] = useState(content.hookText || "");
  const [notes, setNotes] = useState(content.notes || "");
  const [changesNote, setChangesNote] = useState(content.changesNote || "");
  const [tagsInput, setTagsInput] = useState((content.tags || []).join(", "));
  const [workUrl, setWorkUrl] = useState(content.workUrl || "");
  const [plannedFor, setPlannedFor] = useState(content.plannedFor || "");

  // Checklist state
  const [checklist, setChecklist] = useState(content.checklist);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [deleteStepTarget, setDeleteStepTarget] = useState<{ id: string; label: string } | null>(null);

  // Reference linking state
  const linkedRefIds = React.useMemo(
    () => new Set(content.refs.map((r) => r.id)),
    [content.refs]
  );
  const unlinkedRefs = React.useMemo(
    () => studioOptions.availableRefs.filter((r) => !linkedRefIds.has(r.id)),
    [studioOptions.availableRefs, linkedRefIds]
  );
  const [linkRefId, setLinkRefId] = useState(unlinkedRefs[0]?.id || "");

  // Posted platforms tracking to avoid picking an already-posted platform by accident
  const postedPlatformIds = React.useMemo(
    () => new Set(content.posts.map((p) => p.platformId)),
    [content.posts]
  );
  const defaultNextPlatformId = React.useMemo(() => {
    const unposted = masterData.platforms.find((p) => !postedPlatformIds.has(p.id));
    return unposted?.id || masterData.platforms[0]?.id || "";
  }, [masterData.platforms, postedPlatformIds]);

  // Add post dialog state
  const [isAddPostOpen, setIsAddPostOpen] = useState(false);
  const [postPlatformId, setPostPlatformId] = useState(defaultNextPlatformId);
  const [postUrl, setPostUrl] = useState("");
  const [postCaption, setPostCaption] = useState("");
  const [postDateTime, setPostDateTime] = useState(getLocalDatetimeInputValue);
  const [selectedSnippetId, setSelectedSnippetId] = useState("");
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [deletePostTargetId, setDeletePostTargetId] = useState<string | null>(null);

  // Final rating state
  const [rating, setRating] = useState<number | null>(content.finalRating);
  const [finalRatingNote, setFinalRatingNote] = useState(content.finalRatingNote || "");

  // AI & safety confirmation states
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [isDraftingScript, setIsDraftingScript] = useState(false);
  const [hookOptions, setHookOptions] = useState<GeneratedHook[]>([]);
  const [isHooksModalOpen, setIsHooksModalOpen] = useState(false);
  const [deleteContentDialogOpen, setDeleteContentDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  React.useEffect(() => {
    setChecklist(content.checklist);
  }, [content.checklist]);

  React.useEffect(() => {
    if (!unlinkedRefs.some((r) => r.id === linkRefId)) {
      setLinkRefId(unlinkedRefs[0]?.id || "");
    }
  }, [unlinkedRefs, linkRefId]);

  React.useEffect(() => {
    if (isAddPostOpen) {
      setPostPlatformId(defaultNextPlatformId);
      setPostDateTime(getLocalDatetimeInputValue());
    }
  }, [isAddPostOpen, defaultNextPlatformId]);

  const serverSignature = React.useMemo(
    () =>
      JSON.stringify({
        title: content.title,
        formatId: content.format?.id || "",
        seriesId: content.series?.id || "",
        hookTypeId: content.hookType?.id || "",
        audioId: content.audio?.id || "",
        pillars: content.pillars.map((p) => p.id),
        hookText: content.hookText || "",
        notes: content.notes || "",
        changesNote: content.changesNote || "",
        tagsInput: (content.tags || []).join(", "),
        workUrl: content.workUrl || "",
        plannedFor: content.plannedFor || "",
        finalRatingNote: content.finalRatingNote || "",
      }),
    [content]
  );

  const isDirty = React.useMemo(() => {
    const cur = JSON.stringify({
      title,
      formatId,
      seriesId,
      hookTypeId,
      audioId,
      pillars: selectedPillars,
      hookText,
      notes,
      changesNote,
      tagsInput,
      workUrl,
      plannedFor,
      finalRatingNote,
    });
    return cur !== serverSignature;
  }, [
    title,
    formatId,
    seriesId,
    hookTypeId,
    audioId,
    selectedPillars,
    hookText,
    notes,
    changesNote,
    tagsInput,
    workUrl,
    plannedFor,
    finalRatingNote,
    serverSignature,
  ]);

  useUnsavedChanges(isDirty);

  const togglePillar = (id: string) => {
    setSelectedPillars((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const parseTags = (raw: string) =>
    Array.from(
      new Set(
        raw
          .split(",")
          .map((t) => t.trim().replace(/^#/, ""))
          .filter(Boolean)
      )
    ).slice(0, 30);

  const parsedTags = React.useMemo(() => parseTags(tagsInput), [tagsInput]);
  const liveFormat = masterData.formats.find((f) => f.id === formatId) || null;
  const liveSeries = studioOptions.series.find((s) => s.id === seriesId) || null;
  const liveHookType = masterData.hookTypes.find((h) => h.id === hookTypeId) || null;
  const liveAudio = studioOptions.audios.find((a) => a.id === audioId) || content.audio || null;
  const livePillars = masterData.pillars.filter((p) => selectedPillars.includes(p.id));

  const handleGenerateHooks = async () => {
    setIsGeneratingHooks(true);
    try {
      const selectedFormatName = liveFormat?.name;
      const primaryPillarName = livePillars[0]?.name;

      const res = await aiGenerateHooks({
        topic: title,
        pillar: primaryPillarName,
        format: selectedFormatName,
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
    const prevHook = hookText;
    setHookText(hook.text);
    setIsHooksModalOpen(false);
    toast.success(`Selected hook applied`, {
      action: prevHook.trim()
        ? {
            label: "Undo",
            onClick: () => setHookText(prevHook),
          }
        : undefined,
    });
  };

  const handleDraftScript = async () => {
    setIsDraftingScript(true);
    const previousNotes = notes;
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
      toast.success("AI Script drafted!", {
        action: previousNotes.trim()
          ? {
              label: "Undo Replace",
              onClick: () => setNotes(previousNotes),
            }
          : undefined,
      });
    } catch {
      toast.error("Failed to draft script");
    } finally {
      setIsDraftingScript(false);
    }
  };

  const handleGenerateCaption = async () => {
    setIsGeneratingCaption(true);
    const previousCaption = postCaption;
    try {
      const platformName =
        masterData.platforms.find((p) => p.id === postPlatformId)?.name || "Instagram Reels";
      const res = await aiGenerateCaption({
        title,
        hookText,
        notes,
        platform: platformName,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      setPostCaption(res.data.caption);
      toast.success("AI caption drafted", {
        action: previousCaption.trim()
          ? {
              label: "Undo Replace",
              onClick: () => setPostCaption(previousCaption),
            }
          : undefined,
      });
    } catch {
      toast.error("Failed to generate caption");
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleInsertSnippet = (snippetId: string) => {
    setSelectedSnippetId("");
    const snippet = studioOptions.snippets.find((s) => s.id === snippetId);
    if (!snippet) return;
    setPostCaption((prev) => (prev.trim() ? `${prev.trim()}\n\n${snippet.body}` : snippet.body));
    toast.success(`Inserted snippet: ${snippet.title}`);
  };

  const handleSaveDetails = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const cleanWorkUrl = workUrl.trim();
    if (cleanWorkUrl && !/^https?:\/\/.+/i.test(cleanWorkUrl)) {
      toast.error("Work Asset URL must start with http:// or https://");
      return;
    }

    startTransition(async () => {
      const res = await updateContent({
        id: content.id,
        title: title.trim(),
        formatId: formatId || null,
        seriesId: seriesId || null,
        hookTypeId: hookTypeId || null,
        audioId: audioId || null,
        pillarIds: selectedPillars,
        hookText,
        notes,
        changesNote,
        tags: parseTags(tagsInput),
        workUrl: cleanWorkUrl || null,
        plannedFor: plannedFor || null,
        finalRating: rating,
        finalRatingNote,
      });

      if (res.ok) {
        toast.success("Content studio saved");
        router.refresh();
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
      const res = await toggleChecklistItem({ id, isDone: next });
      if (!res.ok) {
        setChecklist((prev) =>
          prev.map((item) => (item.id === id ? { ...item, isDone: current } : item))
        );
        toast.error(res.error.message || "Failed to update checklist item");
      }
    });
  };

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newChecklistText.trim();
    if (!clean || isPending) return;

    startTransition(async () => {
      const res = await addChecklistItem({
        contentId: content.id,
        label: clean,
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

  const handleConfirmDeleteChecklist = async () => {
    if (!deleteStepTarget) return;
    const targetId = deleteStepTarget.id;
    const res = await deleteChecklistItem({ id: targetId, contentId: content.id });
    if (res.ok) {
      setChecklist((prev) => prev.filter((item) => item.id !== targetId));
      setDeleteStepTarget(null);
      toast.success("Checklist step removed");
    } else {
      toast.error(res.error.message || "Failed to remove checklist step");
    }
  };

  const handleLinkRef = () => {
    if (!linkRefId) return;
    startTransition(async () => {
      const res = await linkReferenceToContent({ contentId: content.id, refId: linkRefId });
      if (res.ok) {
        toast.success("Reference linked to content");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleUnlinkRef = (refId: string) => {
    startTransition(async () => {
      const res = await unlinkReferenceFromContent({ contentId: content.id, refId });
      if (res.ok) {
        toast.success("Reference unlinked");
        router.refresh();
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

    const cleanPostUrl = postUrl.trim();
    if (cleanPostUrl && !/^https?:\/\/.+/i.test(cleanPostUrl)) {
      toast.error("Post URL must start with http:// or https://");
      return;
    }

    const parsedDate = postDateTime ? new Date(postDateTime) : new Date();
    const postedIso = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString()
      : parsedDate.toISOString();

    startTransition(async () => {
      const res = await addPost({
        contentId: content.id,
        platformId: postPlatformId,
        url: cleanPostUrl || null,
        caption: postCaption || undefined,
        postedAt: postedIso,
      });

      if (res.ok) {
        toast.success(
          res.data.checkpointsCreated > 0
            ? `Post added! ${res.data.checkpointsCreated} evaluation checkpoints generated.`
            : "Post recorded! (This format does not generate checkpoints)"
        );
        setIsAddPostOpen(false);
        setPostUrl("");
        setPostCaption("");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleConfirmDeletePost = async () => {
    if (!deletePostTargetId) return;
    const res = await deletePost({ postId: deletePostTargetId, contentId: content.id });
    if (res.ok) {
      toast.success("Post & checkpoints removed");
      setDeletePostTargetId(null);
      router.refresh();
    } else {
      toast.error(res.error.message);
    }
  };

  const handleSetRating = (score: number | null) => {
    setRating(score);
    startTransition(async () => {
      const res = await updateContent({
        id: content.id,
        finalRating: score,
        finalRatingNote,
      });
      if (res.ok) {
        toast.success(score === null ? "Rating cleared" : `Rated ${score}/5`);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleSaveRatingNote = () => {
    startTransition(async () => {
      const res = await updateContent({
        id: content.id,
        finalRating: rating,
        finalRatingNote,
      });
      if (res.ok) {
        toast.success("Evaluation note saved");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleArchiveToggle = () => {
    startTransition(async () => {
      const res = content.archivedAt
        ? await restoreContent({ id: content.id })
        : await archiveContent({ id: content.id });

      if (res.ok) {
        toast.success(content.archivedAt ? "Content restored" : "Content archived");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handlePermanentDelete = async () => {
    const res = await deleteContentPermanently({ id: content.id });
    if (res.ok) {
      toast.success("Content permanently deleted");
      setDeleteContentDialogOpen(false);
      router.push("/contents");
    } else {
      toast.error(res.error.message);
    }
  };

  const doneCount = checklist.filter((c) => c.isDone).length;
  const progressPct = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0;
  const backHref = content.archivedAt ? "/contents?archived=1" : "/contents";

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border/80 pb-4">
        <button
          type="button"
          onClick={() => {
            if (isDirty) setLeaveDialogOpen(true);
            else router.push(backHref);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Contents</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && (
            <span className="text-[11px] font-mono font-semibold text-warning px-2 py-0.5 rounded-md bg-warning/10 border border-warning/30">
              Unsaved edits
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleArchiveToggle}
            className="text-xs font-mono h-8 rounded-md gap-1.5"
          >
            {content.archivedAt ? (
              <>
                <RotateCcw className="size-3.5" />
                <span>Restore</span>
              </>
            ) : (
              <>
                <Archive className="size-3.5" />
                <span>Archive</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => setDeleteContentDialogOpen(true)}
            className="text-xs font-mono h-8 rounded-md gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
            <span>Delete</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={Boolean(content.archivedAt)}
            title={content.archivedAt ? "Restore content first to publish a post" : undefined}
            onClick={() => setIsAddPostOpen(true)}
            className="text-xs font-mono h-8 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5"
          >
            <Send className="size-3.5" />
            <span>Publish Post</span>
          </Button>
        </div>
      </div>

      {/* Archived Banner */}
      {content.archivedAt && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border border-warning/40 bg-warning/10 text-xs font-mono">
          <span className="text-foreground">
            This content is archived ({new Date(content.archivedAt).toLocaleDateString("en-US", { timeZone: "Asia/Jakarta" })}) and hidden from active workflows.
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={handleArchiveToggle}
            className="h-8 text-xs font-mono rounded-md gap-1.5 bg-background"
          >
            <RotateCcw className="size-3.5" />
            <span>Restore to Active</span>
          </Button>
        </div>
      )}

      {/* Main Content Info Card (reads live state) */}
      <div className="bg-card border border-border rounded-lg p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {liveFormat && (
                <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-foreground text-background">
                  {liveFormat.name}
                </span>
              )}
              {liveSeries && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border">
                  {liveSeries.name}
                </span>
              )}
              {liveHookType && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border">
                  Hook: {liveHookType.name}
                </span>
              )}
              {liveAudio && (
                <Link
                  href={`/audio/${liveAudio.id}`}
                  className="text-xs font-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground border border-border inline-flex items-center gap-1"
                >
                  <span>Audio: {liveAudio.title}</span>
                </Link>
              )}
              <StatusBadge status={content.status} />
            </div>

            <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-foreground break-words">
              {title || content.title}
            </h1>
          </div>

          {/* Rating & Evaluation Note */}
          <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto shrink-0">
            <div className="flex items-center gap-2">
              <span className="label-mono text-muted-foreground">
                Overall Rating
              </span>
              {rating !== null && (
                <button
                  type="button"
                  onClick={() => handleSetRating(null)}
                  className="text-[10px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                >
                  <X className="size-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Overall evaluation rating">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = Boolean(rating && star <= rating);
                return (
                  <button
                    key={star}
                    type="button"
                    aria-label={`Rate ${star} out of 5`}
                    aria-pressed={rating === star}
                    onClick={() => handleSetRating(star)}
                    className={`p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                      active
                        ? "text-warning hover:text-warning/80"
                        : "text-muted-foreground/40 hover:text-foreground"
                    }`}
                  >
                    <Star className={`size-4 ${active ? "fill-current" : ""}`} />
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 w-full md:w-64">
              <Input
                value={finalRatingNote}
                onChange={(e) => setFinalRatingNote(e.target.value)}
                onBlur={() => {
                  if (finalRatingNote !== (content.finalRatingNote || "")) {
                    handleSaveRatingNote();
                  }
                }}
                placeholder="Evaluation takeaway note..."
                aria-label="Evaluation rating note"
                className="h-8 flex-1 text-[11px] font-mono rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Pillars & Tags Summary */}
        {(livePillars.length > 0 || parsedTags.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {livePillars.map((pillar) => (
              <span
                key={pillar.id}
                className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border font-medium"
              >
                {pillar.name}
              </span>
            ))}
            {parsedTags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-mono px-2 py-0.5 rounded-md border border-border/70 text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Studio Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Script, Metadata & Posts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Script & Metadata Editor Card */}
          <div className="bg-card border border-border rounded-lg p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 flex-wrap gap-2">
              <h2 className="text-sm font-black font-display tracking-tight text-foreground flex items-center gap-1.5">
                <FileText className="size-4" />
                <span>Studio Editor &amp; Metadata</span>
              </h2>

              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateHooks}
                  disabled={isGeneratingHooks || isPending}
                  className="text-xs font-mono h-8 rounded-md gap-1 border-border/80 hover:bg-secondary text-foreground"
                >
                  {isGeneratingHooks ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3 text-warning fill-warning" />
                  )}
                  <span>AI Hooks</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDraftScript}
                  disabled={isDraftingScript || isPending}
                  className="text-xs font-mono h-8 rounded-md gap-1 border-border/80 hover:bg-secondary text-foreground"
                >
                  {isDraftingScript ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3 text-warning fill-warning" />
                  )}
                  <span>Draft Script</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveDetails}
                  disabled={isPending}
                  className="text-xs font-mono h-8 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1"
                >
                  {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                  <span>Save Changes</span>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="studio-title" className="label-mono text-muted-foreground">
                  Title
                </Label>
                <Input
                  id="studio-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs font-mono h-9 rounded-md"
                />
              </div>

              {/* Classification Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="studio-format" className="label-mono text-muted-foreground">
                    Format
                  </Label>
                  <SelectField
                    id="studio-format"
                    value={formatId}
                    onValueChange={setFormatId}
                    ariaLabel="Format"
                    options={[
                      { value: "", label: "-- Unset Format --" },
                      ...masterData.formats.map((f) => ({ value: f.id, label: f.name })),
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="studio-series" className="label-mono text-muted-foreground">
                    Series
                  </Label>
                  <SelectField
                    id="studio-series"
                    value={seriesId}
                    onValueChange={setSeriesId}
                    ariaLabel="Series"
                    options={[
                      { value: "", label: "-- Standalone Content --" },
                      ...studioOptions.series.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="studio-hook-type" className="label-mono text-muted-foreground">
                    Hook Classification
                  </Label>
                  <SelectField
                    id="studio-hook-type"
                    value={hookTypeId}
                    onValueChange={setHookTypeId}
                    ariaLabel="Hook Classification"
                    options={[
                      { value: "", label: "-- Unset Hook Type --" },
                      ...masterData.hookTypes.map((ht) => ({ value: ht.id, label: ht.name })),
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="studio-audio" className="label-mono text-muted-foreground">
                    Audio Track
                  </Label>
                  <SelectField
                    id="studio-audio"
                    value={audioId}
                    onValueChange={setAudioId}
                    ariaLabel="Audio Track"
                    options={[
                      { value: "", label: "-- No Track Selected --" },
                      ...studioOptions.audios.map((audio) => ({
                        value: audio.id,
                        label: `${audio.title}${audio.artist ? ` — ${audio.artist}` : ""}${audio.isOriginal ? " (Original)" : ""}`,
                      })),
                    ]}
                  />
                </div>
              </div>

              {/* Pillars Selection */}
              <div className="space-y-2">
                <Label className="label-mono text-muted-foreground">
                  Content Pillars
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {masterData.pillars.map((pillar) => {
                    const isSelected = selectedPillars.includes(pillar.id);
                    return (
                      <button
                        key={pillar.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => togglePillar(pillar.id)}
                        className={`px-2.5 py-1.5 text-[11px] font-mono rounded-md border transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                          isSelected
                            ? "bg-foreground text-background border-foreground font-semibold"
                            : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {pillar.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="studio-hook-text" className="label-mono text-muted-foreground">
                  Opening Hook Line
                </Label>
                <Input
                  id="studio-hook-text"
                  value={hookText}
                  onChange={(e) => setHookText(e.target.value)}
                  placeholder="The opening line or headline..."
                  className="text-xs font-mono h-9 rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="studio-notes" className="label-mono text-muted-foreground">
                  Script / Outline &amp; Cues
                </Label>
                <Textarea
                  id="studio-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Draft your script, scene breakdown, b-roll checklist..."
                  rows={8}
                  className="text-xs font-mono rounded-md leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="studio-changes" className="label-mono text-muted-foreground">
                  What I Changed / Original Spin
                </Label>
                <Textarea
                  id="studio-changes"
                  value={changesNote}
                  onChange={(e) => setChangesNote(e.target.value)}
                  placeholder="How you adapted the angle, pacing, visual framing, or audience context..."
                  rows={3}
                  className="text-xs font-mono rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="studio-tags" className="label-mono text-muted-foreground">
                  Tags (comma-separated)
                </Label>
                <Input
                  id="studio-tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="lighting, tutorial, desk-tour"
                  className="text-xs font-mono h-9 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="studio-work-url" className="label-mono text-muted-foreground">
                    Work Asset / Drive Link
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="studio-work-url"
                      type="url"
                      value={workUrl}
                      onChange={(e) => setWorkUrl(e.target.value)}
                      placeholder="https://..."
                      className="text-xs font-mono h-9 rounded-md flex-1 min-w-0"
                    />
                    {workUrl.trim() && /^https?:\/\/.+/i.test(workUrl.trim()) && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        title="Open work asset link"
                        className="h-9 w-9 p-0 shrink-0 rounded-md"
                      >
                        <a href={workUrl.trim()} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="studio-planned-for" className="label-mono text-muted-foreground">
                    Target Shoot Date
                  </Label>
                  <Input
                    id="studio-planned-for"
                    type="date"
                    value={plannedFor}
                    onChange={(e) => setPlannedFor(e.target.value)}
                    className="text-xs font-mono h-9 rounded-md"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-muted-foreground">
                {isDirty ? "Unsaved changes in editor" : "All changes saved"}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveDetails}
                disabled={isPending}
                className="text-xs font-mono h-9 px-4 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                <span>Save Changes</span>
              </Button>
            </div>
          </div>

          {/* Published Posts & Snapshots Card */}
          <div className="bg-card border border-border rounded-lg p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="space-y-0.5">
                <h2 className="text-sm font-black font-display tracking-tight text-foreground flex items-center gap-2">
                  <Send className="size-4" />
                  <span>Published Posts &amp; Performance Checkpoints</span>
                </h2>
                <p className="text-[11px] font-mono text-muted-foreground">
                  Posts auto-generate 24h, 7d, and 30d evaluation checkpoints for eligible formats
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(content.archivedAt)}
                onClick={() => setIsAddPostOpen(true)}
                className="text-xs font-mono h-8 rounded-md gap-1 shrink-0"
              >
                <Plus className="size-3" />
                <span>Add Post</span>
              </Button>
            </div>

            {content.posts.length === 0 ? (
              <div className="p-8 text-center rounded-md border border-dashed border-border bg-secondary/30 space-y-3">
                <Clock className="size-6 mx-auto text-muted-foreground" />
                <p className="text-xs font-mono text-muted-foreground max-w-md mx-auto">
                  Not published yet. When ready, click &ldquo;Add Post&rdquo; to record the live URL and start tracking checkpoints.
                </p>
                {!content.archivedAt && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddPostOpen(true)}
                    className="h-8 text-xs font-mono rounded-md gap-1.5"
                  >
                    <Send className="size-3.5" />
                    <span>Record First Post</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {content.posts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 rounded-md border border-border bg-secondary/20 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-foreground text-background">
                          {post.platformName}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {new Date(post.postedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "Asia/Jakarta",
                          })}
                        </span>
                        {post.url ? (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 underline underline-offset-2"
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
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${post.platformName} post`}
                        onClick={() => setDeletePostTargetId(post.id)}
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 rounded-md"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    {post.caption && (
                      <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap border-l-2 border-border pl-2.5">
                        {post.caption}
                      </p>
                    )}

                    {/* Checkpoints for this post */}
                    {post.snapshots.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {post.snapshots.map((snap) => {
                          const isDone = snap.status === "done";
                          return (
                            <Link
                              key={snap.id}
                              href={isDone ? "/evaluate?filter=done" : "/evaluate"}
                              className={`p-2.5 rounded-md border text-xs font-mono space-y-1 transition-colors hover:border-foreground/40 ${
                                isDone
                                  ? "bg-success/10 border-success/30 text-success"
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
                                  {snap.rating !== null && ` • ${snap.rating}/5`}
                                </div>
                              ) : (
                                <div className="text-[10px] text-muted-foreground/90">
                                  Due: {new Date(snap.dueAt).toLocaleDateString("en-US", { timeZone: "Asia/Jakarta" })}
                                </div>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
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
                <h3 className="label-mono font-bold text-foreground flex items-center gap-1.5">
                  <CheckSquare className="size-3.5" />
                  <span>Checklist</span>
                </h3>
                <span className="text-xs font-mono font-bold text-muted-foreground tabular-nums">
                  {doneCount}/{checklist.length} ({progressPct}%)
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Production checklist completion"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="w-full h-1.5 bg-secondary rounded-sm overflow-hidden border border-border/60"
              >
                <div
                  className="h-full bg-foreground transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-secondary/40 transition-colors group"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleChecklist(item.id, item.isDone)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0 focus-visible:outline-none focus-visible:underline"
                  >
                    {item.isDone ? (
                      <CheckSquare className="size-4 text-success shrink-0" />
                    ) : (
                      <Square className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={`text-xs font-mono select-none break-words ${
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
                    aria-label={`Remove step ${item.label}`}
                    onClick={() => setDeleteStepTarget({ id: item.id, label: item.label })}
                    className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-destructive p-1.5 rounded-md transition-opacity shrink-0"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddChecklist} className="pt-2 flex items-center gap-2">
              <Input
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                maxLength={120}
                placeholder="Add step..."
                aria-label="Add checklist step"
                className="text-xs font-mono h-9 rounded-md"
              />
              <Button
                size="sm"
                type="submit"
                disabled={isPending || !newChecklistText.trim()}
                aria-label="Add step"
                className="text-xs font-mono h-9 px-3 rounded-md shrink-0"
              >
                <Plus className="size-3.5" />
              </Button>
            </form>
          </div>

          {/* Linked References Card */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="label-mono font-bold text-foreground flex items-center gap-1.5 border-b border-border/60 pb-3">
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
                    className="p-2.5 rounded-md border border-border bg-secondary/30 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                        {ref.platformName} • #{ref.contentPosition || 1}
                      </span>
                      <button
                        type="button"
                        aria-label="Unlink reference"
                        onClick={() => handleUnlinkRef(ref.id)}
                        title="Unlink reference"
                        className="text-muted-foreground hover:text-destructive p-1 rounded"
                      >
                        <Unlink className="size-3.5" />
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

            {/* + Link existing reference */}
            {unlinkedRefs.length > 0 && (
              <div className="pt-2 border-t border-border/60 space-y-2">
                <Label htmlFor="studio-link-ref" className="label-mono text-muted-foreground">
                  Link Existing Reference
                </Label>
                <div className="flex items-center gap-2">
                  <SelectField
                    id="studio-link-ref"
                    value={linkRefId}
                    onValueChange={setLinkRefId}
                    ariaLabel="Select existing reference to link"
                    className="flex-1 min-w-0"
                    options={unlinkedRefs.map((ref) => ({
                      value: ref.id,
                      label: `[${ref.platformName}] ${(ref.hookText || ref.url).slice(0, 48)}`,
                    }))}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending || !linkRefId}
                    onClick={handleLinkRef}
                    className="h-9 px-2.5 text-xs font-mono rounded-md gap-1 shrink-0"
                  >
                    <Plus className="size-3" />
                    <span>Link</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Post Dialog */}
      <Dialog open={isAddPostOpen} onOpenChange={setIsAddPostOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleAddPost}>
            <DialogHeader>
              <DialogTitle className="text-lg font-black font-display tracking-tight">
                Record Published Post
              </DialogTitle>
              <DialogDescription className="text-xs font-mono text-muted-foreground">
                Recording a post marks this content as POSTED and schedules 24h, 7d, and 30d snapshots when supported by format.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="post-platform" className="label-mono text-muted-foreground">
                    Platform
                  </Label>
                  <SelectField
                    id="post-platform"
                    value={postPlatformId}
                    onValueChange={setPostPlatformId}
                    ariaLabel="Platform"
                    options={masterData.platforms.map((p) => {
                      const already = postedPlatformIds.has(p.id);
                      return {
                        value: p.id,
                        label: `${p.name}${already ? " (Already posted)" : ""}`,
                        disabled: already,
                      };
                    })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="post-date-time" className="label-mono text-muted-foreground">
                    Published Date &amp; Time
                  </Label>
                  <Input
                    id="post-date-time"
                    type="datetime-local"
                    value={postDateTime}
                    onChange={(e) => setPostDateTime(e.target.value)}
                    className="text-xs font-mono h-9 rounded-md"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="post-url" className="label-mono text-muted-foreground">
                  Post URL (Optional)
                </Label>
                <Input
                  id="post-url"
                  type="url"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  placeholder="https://instagram.com/reel/..."
                  className="text-xs font-mono h-9 rounded-md"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label htmlFor="post-caption" className="label-mono text-muted-foreground">
                    Caption or Post Notes (Optional)
                  </Label>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {studioOptions.snippets.length > 0 && (
                      <SelectField
                        ariaLabel="Insert caption or hashtag snippet"
                        size="sm"
                        value={selectedSnippetId}
                        onValueChange={handleInsertSnippet}
                        className="w-auto min-w-[148px] max-w-[200px] text-[11px]"
                        options={[
                          { value: "", label: "+ Insert Snippet" },
                          ...studioOptions.snippets.map((sn) => ({
                            value: sn.id,
                            label: `[${sn.kind}] ${sn.title}`,
                          })),
                        ]}
                      />
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isGeneratingCaption}
                      onClick={handleGenerateCaption}
                      className="h-8 px-2.5 text-[11px] font-mono rounded-md gap-1"
                    >
                      {isGeneratingCaption ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Sparkles className="size-3 text-warning fill-warning" />
                      )}
                      <span>AI Write Caption</span>
                    </Button>
                  </div>
                </div>

                <Textarea
                  id="post-caption"
                  value={postCaption}
                  onChange={(e) => setPostCaption(e.target.value)}
                  placeholder="Write caption, CTA, or hashtags..."
                  rows={5}
                  className="text-xs font-mono rounded-md"
                />
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddPostOpen(false)}
                className="text-xs font-mono h-9 rounded-md"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || postedPlatformIds.has(postPlatformId)}
                className="text-xs font-mono h-9 rounded-md bg-foreground text-background font-bold gap-1.5"
              >
                {isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                <span>Confirm Post</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hook Picker Dialog (keyboard-accessible button items) */}
      <Dialog open={isHooksModalOpen} onOpenChange={setIsHooksModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-black font-display tracking-tight flex items-center gap-2">
              <Sparkles className="size-4 text-warning fill-warning" />
              <span>AI Viral Hook Suggestions</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-mono text-muted-foreground">
              Select any generated hook to apply directly to your content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {hookOptions.map((hook, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyHook(hook)}
                className="w-full text-left p-3 rounded-lg border border-border bg-secondary/30 hover:border-foreground/60 hover:bg-secondary/70 transition-colors space-y-1.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-foreground text-background">
                    {hook.archetype}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground group-hover:text-foreground">
                    Apply →
                  </span>
                </div>
                <p className="text-xs font-mono font-medium text-foreground">
                  &ldquo;{hook.text}&rdquo;
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {hook.whyItWorks}
                </p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteContentDialogOpen}
        onOpenChange={setDeleteContentDialogOpen}
        title="Delete Content Permanently?"
        description={`This removes "${content.title}", its production checklist, published post logs, and evaluation snapshots. Linked references will automatically return to Selected status.`}
        confirmLabel="Delete Permanently"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={isPending}
        onConfirm={handlePermanentDelete}
      />

      <ConfirmDialog
        open={Boolean(deletePostTargetId)}
        onOpenChange={(open) => !open && setDeletePostTargetId(null)}
        title="Delete Published Post?"
        description="Deleting this post also deletes all of its 24h, 7d, and 30d evaluation snapshots and reverts content/reference statuses if no other posts remain."
        confirmLabel="Delete Post"
        cancelLabel="Keep Post"
        variant="destructive"
        isPending={isPending}
        onConfirm={handleConfirmDeletePost}
      />

      <ConfirmDialog
        open={Boolean(deleteStepTarget)}
        onOpenChange={(open) => !open && setDeleteStepTarget(null)}
        title="Remove checklist step?"
        description={`Remove "${deleteStepTarget?.label || ""}" from the production checklist?`}
        confirmLabel="Remove Step"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={isPending}
        onConfirm={handleConfirmDeleteChecklist}
      />

      <ConfirmDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        title="Leave with unsaved changes?"
        description="You have unsaved edits in the Studio Editor. Leaving now will discard them."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={() => {
          setLeaveDialogOpen(false);
          router.push(backHref);
        }}
      />
    </div>
  );
}
