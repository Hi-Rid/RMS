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
import { Badge } from "@/components/ui/badge";
import { saveCapture } from "@/lib/actions/references";
import { aiBedahReference } from "@/lib/actions/ai";
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

  const handleAiBedah = async () => {
    if (!reference) return;
    setIsAiLoading(true);
    try {
      const res = await aiBedahReference({
        text: hookText || reference.summary || reference.url,
        platform: reference.platform.name,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      setHookText(res.data.hookText);
      setVisualNotes(res.data.visualNotes);
      setNotes(
        (prev) =>
          `${prev ? prev + "\n\n" : ""}Key Insight: ${res.data.keyTakeaway}\n\nAdaptation Ideas:\n- ${res.data.adaptIdeas.join("\n- ")}`
      );
      if (res.data.suggestedTags?.length) {
        setTagsInput(res.data.suggestedTags.join(", "));
      }
      toast.success("AI Bedah complete! Extracted hook & adaptation ideas.");
    } catch {
      toast.error("Failed to run AI Bedah");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Sync state when reference opens
  React.useEffect(() => {
    if (reference) {
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
    }
  }, [reference]);

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
        sourceHandle: sourceHandle || undefined,
        audioTitle: audioTitle || undefined,
        audioArtist: audioArtist || undefined,
        hookText: hookText || undefined,
        hookTypeId: hookTypeId || null,
        visualNotes: visualNotes || undefined,
        notes: notes || undefined,
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
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-6 space-y-6">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-lg font-black tracking-tight font-display flex items-center justify-between">
            <span>Quick Capture</span>
            <a
              href={reference.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono font-normal text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <span>Original</span>
              <ExternalLink className="size-3" />
            </a>
          </SheetTitle>
          <SheetDescription className="text-xs font-mono truncate text-muted-foreground">
            {reference.url}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 text-xs">
          {/* AI Bedah Quick Button */}
          <div className="p-3 rounded-lg border border-border bg-secondary/40 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-bold text-foreground font-display flex items-center gap-1.5 text-xs">
                <Sparkles className="size-3.5 text-amber-500 fill-amber-500" />
                <span>AI Auto-Bedah (Gemini)</span>
              </span>
              <p className="text-[11px] font-mono text-muted-foreground">
                Ekstrak hook, visual structure & ide adaptasi otomatis
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isAiLoading}
              onClick={handleAiBedah}
              className="text-xs font-mono h-7 bg-foreground text-background font-bold gap-1 shrink-0"
            >
              {isAiLoading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
              <span>Auto-Bedah</span>
            </Button>
          </div>

          {/* Content Pillars */}
          <div className="space-y-2">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Pillars (Select 1 or more)
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {masterData?.pillars.map((pillar) => {
                const isSelected = selectedPillars.includes(pillar.id);
                return (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => togglePillar(pillar.id)}
                    className={`px-2.5 py-1 text-xs font-mono rounded border transition-all select-none ${
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
          </div>

          {/* Format & Hook Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Format
              </Label>
              <select
                value={formatId}
                onChange={(e) => setFormatId(e.target.value)}
                className="w-full h-8 px-2.5 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:border-foreground"
              >
                <option value="">-- Choose format --</option>
                {masterData?.formats.map((fmt) => (
                  <option key={fmt.id} value={fmt.id}>
                    {fmt.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Hook Type
              </Label>
              <select
                value={hookTypeId}
                onChange={(e) => setHookTypeId(e.target.value)}
                className="w-full h-8 px-2.5 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:border-foreground"
              >
                <option value="">-- Choose hook type --</option>
                {masterData?.hookTypes.map((ht) => (
                  <option key={ht.id} value={ht.id}>
                    {ht.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hook Text */}
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Hook / Opening Line
            </Label>
            <Input
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              placeholder="e.g. 90% of creators make this fatal mistake..."
              className="text-xs h-8 font-mono"
            />
          </div>

          {/* Source Account & Audio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Creator Handle
              </Label>
              <Input
                value={sourceHandle}
                onChange={(e) => setSourceHandle(e.target.value)}
                placeholder="@username"
                className="text-xs h-8 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Audio Title
              </Label>
              <Input
                value={audioTitle}
                onChange={(e) => setAudioTitle(e.target.value)}
                placeholder="Sound / Track name"
                className="text-xs h-8 font-mono"
              />
            </div>
          </div>

          {/* Visual Breakdown */}
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Visual Notes / Structure
            </Label>
            <Textarea
              value={visualNotes}
              onChange={(e) => setVisualNotes(e.target.value)}
              placeholder="Pacing, cuts, framing, overlays, screen recording..."
              rows={2}
              className="text-xs font-mono resize-none"
            />
          </div>

          {/* Key Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Key Notes & Takeaways
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why this worked, what to adapt, ideas..."
              rows={2}
              className="text-xs font-mono resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Tags (comma separated)
            </Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="viral, storytelling, lighting, b-roll"
              className="text-xs h-8 font-mono"
            />
          </div>
        </div>

        <SheetFooter className="pt-4 border-t border-border flex flex-row items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="text-xs font-mono h-8"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            className="text-xs font-mono h-8 bg-foreground text-background hover:bg-foreground/90 font-bold"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3 animate-spin mr-1.5" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Capture</span>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
