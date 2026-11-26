"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { SelectField } from "@/components/app/select-field";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { saveCapture } from "@/lib/actions/references";
import { aiBedahReference } from "@/lib/actions/ai";
import { matchHookTypeId } from "@/lib/domain/normalize";
import { toast } from "sonner";
import { Loader2, ExternalLink, Sparkles } from "lucide-react";
import type { ReferenceListItem, MasterData } from "@/lib/queries/references";

interface CaptureSheetProps {
  reference: ReferenceListItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  masterData?: MasterData;
  onSuccess?: () => void;
}

export function CaptureSheet({
  reference,
  isOpen,
  onOpenChange,
  masterData,
  onSuccess,
}: CaptureSheetProps) {
  const [isPending, startTransition] = useTransition();

  const [selectedPillars, setSelectedPillars] = useState<string[]>([]);
  const [formatId, setFormatId] = useState<string>("");
  const [sourceHandle, setSourceHandle] = useState<string>("");
  const [audioTitle, setAudioTitle] = useState<string>("");
  const [audioArtist, setAudioArtist] = useState<string>("");
  const [hookText, setHookText] = useState<string>("");
  const [hookTypeId, setHookTypeId] = useState<string>("");
  const [visualNotes, setVisualNotes] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [tagsInput, setTagsInput] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  // Sync state cleanly every time sheet opens on a reference
  React.useEffect(() => {
    if (isOpen && reference) {
      setSelectedPillars(reference.pillars.map((p) => p.id));
      setFormatId(reference.format?.id || "");
      setSourceHandle(reference.sourceAccount?.handle || "");
      setAudioTitle(reference.audio?.title || "");
      setAudioArtist(reference.audio?.artist || "");
      setHookText(reference.hookText || "");
      setHookTypeId(reference.hookType?.id || "");
      setVisualNotes(reference.visualNotes || "");
      setNotes(reference.notes || "");
      setTagsInput(reference.tags?.join(", ") || "");
      setConfirmDiscardOpen(false);
    }
  }, [reference, isOpen]);

  const isDirty = React.useMemo(() => {
    if (!reference || !isOpen) return false;
    const origPillars = [...reference.pillars.map((p) => p.id)].sort().join(",");
    const curPillars = [...selectedPillars].sort().join(",");
    return (
      origPillars !== curPillars ||
      (reference.format?.id || "") !== formatId ||
      (reference.sourceAccount?.handle || "") !== sourceHandle ||
      (reference.audio?.title || "") !== audioTitle ||
      (reference.audio?.artist || "") !== audioArtist ||
      (reference.hookText || "") !== hookText ||
      (reference.hookType?.id || "") !== hookTypeId ||
      (reference.visualNotes || "") !== visualNotes ||
      (reference.notes || "") !== notes ||
      (reference.tags?.join(", ") || "") !== tagsInput
    );
  }, [
    reference,
    isOpen,
    selectedPillars,
    formatId,
    sourceHandle,
    audioTitle,
    audioArtist,
    hookText,
    hookTypeId,
    visualNotes,
    notes,
    tagsInput,
  ]);

  useUnsavedChanges(isDirty);

  const handleRequestClose = (nextOpen: boolean) => {
    if (!nextOpen && (isPending || isAiLoading)) return;
    if (!nextOpen && isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onOpenChange(nextOpen);
  };

  const handleAiBedah = async () => {
    if (!reference) return;
    setIsAiLoading(true);
    try {
      const res = await aiBedahReference({
        refId: reference.id,
        text: [reference.summary, hookText, visualNotes].filter(Boolean).join(" — ") || reference.url,
        platform: reference.platform.name,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      setHookText(res.data.hookText);
      setVisualNotes(res.data.visualNotes);
      const aiBlock = `Key Insight: ${res.data.keyTakeaway}\n\nAdaptation Ideas:\n- ${res.data.adaptIdeas.join("\n- ")}`;
      setNotes((prev) => {
        if (!prev.trim()) return aiBlock;
        if (prev.includes(`Key Insight: ${res.data.keyTakeaway}`)) return prev;
        return `${prev.trim()}\n\n${aiBlock}`;
      });
      const matchedHookId = matchHookTypeId(res.data.hookType, masterData?.hookTypes || []);
      if (matchedHookId) setHookTypeId(matchedHookId);
      if (res.data.suggestedTags?.length) {
        setTagsInput(res.data.suggestedTags.join(", "));
      }
      toast.success("AI breakdown complete! Review and save your changes.");
    } catch {
      toast.error("Failed to run AI Breakdown");
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!reference) return null;

  const togglePillar = (id: string) => {
    setSelectedPillars((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    startTransition(async () => {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await saveCapture({
        id: reference.id,
        pillarIds: selectedPillars,
        formatId: formatId || null,
        sourceHandle,
        audioTitle,
        audioArtist,
        hookText,
        hookTypeId: hookTypeId || null,
        visualNotes,
        notes,
        tags,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      toast.success("Capture saved");
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleRequestClose}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg flex flex-col p-0 overflow-hidden"
        >
          <SheetHeader className="px-5 pt-5 pb-4 pr-12 border-b border-border/80 space-y-1 shrink-0">
            <SheetTitle className="text-lg font-bold tracking-tight font-display flex items-center justify-between gap-2">
              <span>Quick Capture</span>
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono font-normal text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
              >
                <span>Original</span>
                <ExternalLink className="size-3" />
              </a>
            </SheetTitle>
            <SheetDescription className="text-xs font-mono truncate text-muted-foreground">
              {reference.url}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5 text-xs">
            {/* AI Breakdown Quick Button */}
            <div className="p-3 rounded-lg border border-border bg-secondary/40 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold text-foreground font-display flex items-center gap-1.5 text-xs">
                  <Sparkles className="size-3.5 text-warning fill-warning" />
                  <span>AI Auto-Breakdown</span>
                </span>
                <p className="text-[11px] font-mono text-muted-foreground">
                  Extract hook, visual breakdown &amp; adaptation ideas automatically
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={isAiLoading || isPending}
                onClick={handleAiBedah}
                className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1 shrink-0 rounded-md"
              >
                {isAiLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                <span>Auto-Breakdown</span>
              </Button>
            </div>

            {/* Content Pillars */}
            <div className="space-y-2">
              <Label className="label-mono text-muted-foreground">
                Pillars (Select 1 or more)
              </Label>
              {masterData?.pillars && masterData.pillars.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {masterData.pillars.map((pillar) => {
                    const isSelected = selectedPillars.includes(pillar.id);
                    return (
                      <button
                        key={pillar.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => togglePillar(pillar.id)}
                        className={`px-2.5 py-1.5 text-xs font-mono rounded-md border transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                          isSelected
                            ? "bg-foreground text-background border-foreground font-semibold"
                            : "bg-secondary text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                        }`}
                      >
                        {pillar.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] font-mono text-muted-foreground">
                  No active pillars configured yet in Settings.
                </p>
              )}
            </div>

            {/* Format & Hook Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="capture-format" className="label-mono text-muted-foreground">
                  Format
                </Label>
                <SelectField
                  id="capture-format"
                  value={formatId}
                  onValueChange={setFormatId}
                  ariaLabel="Format"
                  options={[
                    { value: "", label: "-- Choose format --" },
                    ...(masterData?.formats.map((fmt) => ({ value: fmt.id, label: fmt.name })) || []),
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="capture-hook-type" className="label-mono text-muted-foreground">
                  Hook Type
                </Label>
                <SelectField
                  id="capture-hook-type"
                  value={hookTypeId}
                  onValueChange={setHookTypeId}
                  ariaLabel="Hook Type"
                  options={[
                    { value: "", label: "-- Choose hook type --" },
                    ...(masterData?.hookTypes.map((ht) => ({ value: ht.id, label: ht.name })) || []),
                  ]}
                />
              </div>
            </div>

            {/* Hook Text */}
            <div className="space-y-1.5">
              <Label htmlFor="capture-hook-text" className="label-mono text-muted-foreground">
                Hook / Opening Line
              </Label>
              <Input
                id="capture-hook-text"
                value={hookText}
                onChange={(e) => setHookText(e.target.value)}
                placeholder="e.g. 90% of creators make this fatal mistake..."
                className="text-xs h-9 font-mono rounded-md"
              />
            </div>

            {/* Source Account & Audio */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="capture-creator-handle" className="label-mono text-muted-foreground">
                  Creator Handle
                </Label>
                <Input
                  id="capture-creator-handle"
                  value={sourceHandle}
                  onChange={(e) => setSourceHandle(e.target.value)}
                  placeholder="@username"
                  className="text-xs h-9 font-mono rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="capture-audio-title" className="label-mono text-muted-foreground">
                  Audio Title
                </Label>
                <Input
                  id="capture-audio-title"
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  placeholder="Sound / Track"
                  className="text-xs h-9 font-mono rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="capture-audio-artist" className="label-mono text-muted-foreground">
                  Audio Artist
                </Label>
                <Input
                  id="capture-audio-artist"
                  value={audioArtist}
                  onChange={(e) => setAudioArtist(e.target.value)}
                  placeholder="Artist / Handle"
                  disabled={!audioTitle.trim()}
                  className="text-xs h-9 font-mono rounded-md"
                />
              </div>
            </div>

            {/* Visual Breakdown */}
            <div className="space-y-1.5">
              <Label htmlFor="capture-visual-notes" className="label-mono text-muted-foreground">
                Visual Notes / Structure
              </Label>
              <Textarea
                id="capture-visual-notes"
                value={visualNotes}
                onChange={(e) => setVisualNotes(e.target.value)}
                placeholder="Pacing, cuts, framing, overlays, screen recording..."
                rows={2}
                className="text-xs font-mono resize-y rounded-md"
              />
            </div>

            {/* Key Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="capture-key-notes" className="label-mono text-muted-foreground">
                Key Notes &amp; Takeaways
              </Label>
              <Textarea
                id="capture-key-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why this worked, what to adapt, ideas..."
                rows={3}
                className="text-xs font-mono resize-y rounded-md"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5 pb-2">
              <Label htmlFor="capture-tags" className="label-mono text-muted-foreground">
                Tags (comma separated)
              </Label>
              <Input
                id="capture-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="viral, storytelling, lighting, b-roll"
                className="text-xs h-9 font-mono rounded-md"
              />
            </div>
          </div>

          <SheetFooter className="px-5 py-3.5 border-t border-border bg-card flex flex-row items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] font-mono text-muted-foreground">
              {isDirty ? "Unsaved changes" : "All saved"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRequestClose(false)}
                disabled={isPending}
                className="text-xs font-mono h-9 rounded-md"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending || isAiLoading}
                className="text-xs font-mono h-9 bg-foreground text-background hover:bg-foreground/90 font-bold rounded-md"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  "Save Capture"
                )}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
        title="Discard unsaved changes?"
        description="You have edited capture details that haven't been saved yet."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="destructive"
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
