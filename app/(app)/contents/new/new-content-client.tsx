"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/app/select-field";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import {
  ArrowLeft,
  Loader2,
  Plus,
  ExternalLink,
  Link as LinkIcon,
  AlertTriangle,
} from "lucide-react";
import { createContent } from "@/lib/actions/contents";
import { toast } from "sonner";
import type { MasterData, ReferenceListItem } from "@/lib/queries/references";
import type { StudioMasterOptions } from "@/lib/queries/contents";

interface NewContentClientProps {
  masterData: MasterData;
  studioOptions: StudioMasterOptions;
  sourceReference: ReferenceListItem | null;
  requestedRefMissing?: boolean;
  initialIdea?: string;
  initialAudioId?: string;
}

function buildDefaultTitle(idea: string, ref: ReferenceListItem | null): string {
  if (idea) return idea.slice(0, 180);
  if (ref?.hookText) {
    const clean = ref.hookText.trim();
    return clean.length > 55 ? `Adapt: ${clean.slice(0, 55)}...` : `Adapt: ${clean}`;
  }
  return "";
}

export function NewContentClient({
  masterData,
  studioOptions,
  sourceReference,
  requestedRefMissing = false,
  initialIdea = "",
  initialAudioId = "",
}: NewContentClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const trimmedIdea = initialIdea.trim();
  const initialTitle = buildDefaultTitle(trimmedIdea, sourceReference);
  const initialNotes =
    trimmedIdea && sourceReference?.notes
      ? `Adaptation Focus: ${trimmedIdea}\n\n${sourceReference.notes}`
      : sourceReference?.notes || "";
  const initialTags = (sourceReference?.tags || []).join(", ");
  const resolvedInitialAudioId = sourceReference?.audio?.id || initialAudioId || "";

  const [title, setTitle] = useState(initialTitle);
  const [formatId, setFormatId] = useState(sourceReference?.format?.id || "");
  const [seriesId, setSeriesId] = useState("");
  const [audioId, setAudioId] = useState(resolvedInitialAudioId);
  const [selectedPillars, setSelectedPillars] = useState<string[]>(
    sourceReference?.pillars.map((p) => p.id) || []
  );
  const [hookText, setHookText] = useState(sourceReference?.hookText || "");
  const [hookTypeId, setHookTypeId] = useState(sourceReference?.hookType?.id || "");
  const [notes, setNotes] = useState(initialNotes);
  const [changesNote, setChangesNote] = useState(trimmedIdea ? trimmedIdea : "");
  const [tagsInput, setTagsInput] = useState(initialTags);
  const [plannedFor, setPlannedFor] = useState("");
  const [workUrl, setWorkUrl] = useState("");

  const isDirty = React.useMemo(() => {
    return (
      title !== initialTitle ||
      formatId !== (sourceReference?.format?.id || "") ||
      seriesId !== "" ||
      audioId !== resolvedInitialAudioId ||
      hookText !== (sourceReference?.hookText || "") ||
      hookTypeId !== (sourceReference?.hookType?.id || "") ||
      notes !== initialNotes ||
      changesNote !== (trimmedIdea || "") ||
      tagsInput !== initialTags ||
      plannedFor !== "" ||
      workUrl !== ""
    );
  }, [
    title,
    initialTitle,
    formatId,
    seriesId,
    audioId,
    resolvedInitialAudioId,
    hookText,
    hookTypeId,
    notes,
    initialNotes,
    changesNote,
    trimmedIdea,
    tagsInput,
    initialTags,
    plannedFor,
    workUrl,
    sourceReference,
  ]);

  useUnsavedChanges(isDirty);

  const cancelHref = sourceReference ? `/references/${sourceReference.id}` : "/contents";

  const parsedTags = React.useMemo(
    () =>
      Array.from(
        new Set(
          tagsInput
            .split(",")
            .map((t) => t.trim().replace(/^#/, ""))
            .filter(Boolean)
        )
      ).slice(0, 30),
    [tagsInput]
  );

  const togglePillar = (id: string) => {
    setSelectedPillars((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      const res = await createContent({
        title: title.trim(),
        formatId: formatId || null,
        seriesId: seriesId || null,
        audioId: audioId || null,
        pillarIds: selectedPillars,
        refIds: sourceReference ? [sourceReference.id] : [],
        hookText: hookText.trim() || undefined,
        hookTypeId: hookTypeId || null,
        notes: notes.trim() || undefined,
        changesNote: changesNote.trim() || undefined,
        tags: parsedTags,
        workUrl: cleanWorkUrl || null,
        plannedFor: plannedFor || null,
      });

      if (res.ok) {
        toast.success("Content created! Moving to studio...");
        router.push(`/contents/${res.data.id}`);
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-4">
        <button
          type="button"
          onClick={() => {
            if (isDirty) setLeaveDialogOpen(true);
            else router.push(cancelHref);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back</span>
        </button>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-foreground">
          {sourceReference ? "Create Content from Reference" : "New Content Piece"}
        </h1>
        <p className="label-mono text-muted-foreground">
          {sourceReference
            ? `Adapting inspiration from ${sourceReference.platform.name}${
                sourceReference.sourceAccount?.handle ? ` (@${sourceReference.sourceAccount.handle})` : ""
              }`
            : "Original concept without external reference"}
        </p>
      </div>

      {requestedRefMissing && (
        <div className="p-3.5 rounded-lg border border-warning/40 bg-warning/10 text-xs font-mono text-foreground flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning shrink-0" />
          <span>
            The requested reference could not be found. Starting a blank content draft instead.
          </span>
        </div>
      )}

      {/* Linked Reference Preview if present */}
      {sourceReference && (
        <div className="bg-secondary/40 border border-border rounded-lg p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="label-mono text-muted-foreground flex items-center gap-1.5">
              <LinkIcon className="size-3.5" />
              <span>Primary Reference Attached</span>
            </span>
            <a
              href={sourceReference.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <span>View Original</span>
              <ExternalLink className="size-3" />
            </a>
          </div>

          {sourceReference.contentId && (
            <div className="p-2.5 rounded-md border border-warning/40 bg-warning/10 text-[11px] font-mono text-foreground flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-warning shrink-0" />
                <span>
                  Note: this reference is already linked to another Content draft. Submitting will move the link to this new content.
                </span>
              </span>
              <Link
                href={`/contents/${sourceReference.contentId}`}
                className="underline font-semibold hover:text-brand"
              >
                Open existing draft →
              </Link>
            </div>
          )}

          <p className="text-xs font-mono text-foreground">
            {sourceReference.hookText || sourceReference.summary || sourceReference.url}
          </p>

          {sourceReference.visualNotes && (
            <p className="text-[11px] font-mono text-muted-foreground border-l-2 border-border pl-2.5">
              Visual structure: {sourceReference.visualNotes}
            </p>
          )}
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-5 sm:p-6 space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="new-content-title" className="label-mono text-muted-foreground">
            Content Working Title *
          </Label>
          <Input
            id="new-content-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 3 Tools I Use to 10x Content Output"
            className="text-sm font-mono h-10 font-medium rounded-md"
            required
          />
        </div>

        {/* Pillars Selection */}
        <div className="space-y-2">
          <Label className="label-mono text-muted-foreground">
            Content Pillars
          </Label>
          <div className="flex flex-wrap gap-2">
            {masterData.pillars.map((pillar) => {
              const isSelected = selectedPillars.includes(pillar.id);
              return (
                <button
                  key={pillar.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => togglePillar(pillar.id)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
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

        {/* Format, Series, Hook Type, Audio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-content-format" className="label-mono text-muted-foreground">
              Format
            </Label>
            <SelectField
              id="new-content-format"
              value={formatId}
              onValueChange={setFormatId}
              ariaLabel="Format"
              options={[
                { value: "", label: "-- Choose format --" },
                ...masterData.formats.map((fmt) => ({ value: fmt.id, label: fmt.name })),
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-content-series" className="label-mono text-muted-foreground">
              Series
            </Label>
            <SelectField
              id="new-content-series"
              value={seriesId}
              onValueChange={setSeriesId}
              ariaLabel="Series"
              options={[
                { value: "", label: "-- Standalone content --" },
                ...studioOptions.series.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-content-hook-type" className="label-mono text-muted-foreground">
              Hook Classification
            </Label>
            <SelectField
              id="new-content-hook-type"
              value={hookTypeId}
              onValueChange={setHookTypeId}
              ariaLabel="Hook Classification"
              options={[
                { value: "", label: "-- Choose hook type --" },
                ...masterData.hookTypes.map((ht) => ({ value: ht.id, label: ht.name })),
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-content-audio" className="label-mono text-muted-foreground">
              Audio Track
            </Label>
            <SelectField
              id="new-content-audio"
              value={audioId}
              onValueChange={setAudioId}
              ariaLabel="Audio Track"
              options={[
                { value: "", label: "-- Choose audio (optional) --" },
                ...studioOptions.audios.map((audio) => ({
                  value: audio.id,
                  label: `${audio.title}${audio.artist ? ` — ${audio.artist}` : ""}${audio.isOriginal ? " (Original)" : ""}`,
                })),
              ]}
            />
          </div>
        </div>

        {/* Hook statement */}
        <div className="space-y-1.5">
          <Label htmlFor="new-content-hook" className="label-mono text-muted-foreground">
            Opening Hook Statement
          </Label>
          <Input
            id="new-content-hook"
            value={hookText}
            onChange={(e) => setHookText(e.target.value)}
            placeholder="First 3 seconds line or opening title..."
            className="text-xs font-mono h-9 rounded-md"
          />
        </div>

        {/* What I Changed / Differentiation */}
        <div className="space-y-1.5">
          <Label htmlFor="new-content-changes" className="label-mono text-muted-foreground">
            What I Changed / Differentiation
          </Label>
          <Textarea
            id="new-content-changes"
            value={changesNote}
            onChange={(e) => setChangesNote(e.target.value)}
            placeholder="Your original angle, framing, pacing, or product twist vs. the reference..."
            rows={3}
            className="text-xs font-mono rounded-md"
          />
        </div>

        {/* Script / Outline / Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="new-content-notes" className="label-mono text-muted-foreground">
            Script / Production Outline
          </Label>
          <Textarea
            id="new-content-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key points, dialogue, visual cues, shot checklist..."
            rows={5}
            className="text-xs font-mono rounded-md"
          />
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <Label htmlFor="new-content-tags" className="label-mono text-muted-foreground">
            Tags (comma-separated)
          </Label>
          <Input
            id="new-content-tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="lighting, storytelling, transition"
            className="text-xs font-mono h-9 rounded-md"
          />
          {parsedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {parsedTags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-secondary/70 border border-border/70 text-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Planned Date & Drive / Work URL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-content-planned" className="label-mono text-muted-foreground">
              Planned Shoot / Post Date
            </Label>
            <Input
              id="new-content-planned"
              type="date"
              value={plannedFor}
              onChange={(e) => setPlannedFor(e.target.value)}
              className="text-xs font-mono h-9 rounded-md"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-content-work-url" className="label-mono text-muted-foreground">
              Work Asset / Drive URL (Optional)
            </Label>
            <Input
              id="new-content-work-url"
              type="url"
              value={workUrl}
              onChange={(e) => setWorkUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="text-xs font-mono h-9 rounded-md"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={isPending}
            onClick={() => {
              if (isDirty) setLeaveDialogOpen(true);
              else router.push(cancelHref);
            }}
            className="text-xs font-mono h-9 rounded-md"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="text-xs font-mono h-9 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5 px-4"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            <span>Create Content &amp; Open Studio</span>
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        title="Discard new content draft?"
        description="Your edits haven't been created yet. Leaving will clear the form."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="destructive"
        onConfirm={() => {
          setLeaveDialogOpen(false);
          router.push(cancelHref);
        }}
      />
    </div>
  );
}
