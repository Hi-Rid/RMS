"use client";

import * as React from "react";
import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReferencePreview } from "@/components/app/reference-preview";
import { SelectField } from "@/components/app/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  Archive,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Sparkles,
  Trophy,
  RotateCcw,
} from "lucide-react";
import {
  setReferenceStatus,
  skipReference,
  unskipReference,
  archiveReference,
  restoreReference,
  saveCapture,
} from "@/lib/actions/references";
import { aiBedahReference } from "@/lib/actions/ai";
import { matchHookTypeId } from "@/lib/domain/normalize";
import { toast } from "sonner";
import type { ReferenceListItem, MasterData } from "@/lib/queries/references";

interface TriageFlowProps {
  initialItems: ReferenceListItem[];
  masterData: MasterData;
}

interface TriageDecision {
  index: number;
  refId: string;
  action: "selected" | "skipped" | "archived";
}

function isEditableFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable ||
    Boolean(el.closest('[contenteditable="true"]'))
  );
}

export function TriageFlow({ initialItems, masterData }: TriageFlowProps) {
  const router = useRouter();
  const [items] = useState<ReferenceListItem[]>(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<TriageDecision[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isAiLoading, setIsAiLoading] = useState(false);

  const currentItem = items[currentIndex] || null;

  const [selectedPillars, setSelectedPillars] = useState<string[]>([]);
  const [formatId, setFormatId] = useState<string>("");
  const [hookTypeId, setHookTypeId] = useState<string>("");
  const [sourceHandle, setSourceHandle] = useState<string>("");
  const [audioTitle, setAudioTitle] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [hookText, setHookText] = useState<string>("");
  const [visualNotes, setVisualNotes] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [tagsInput, setTagsInput] = useState<string>("");

  useEffect(() => {
    if (currentItem) {
      setSelectedPillars(currentItem.pillars.map((p) => p.id));
      setFormatId(currentItem.format?.id || "");
      setHookTypeId(currentItem.hookType?.id || "");
      setSourceHandle(currentItem.sourceAccount?.handle || "");
      setAudioTitle(currentItem.audio?.title || "");
      setSummary(currentItem.summary || "");
      setHookText(currentItem.hookText || "");
      setVisualNotes(currentItem.visualNotes || "");
      setNotes(currentItem.notes || "");
      setTagsInput((currentItem.tags || []).join(", "));
    }
  }, [currentItem]);

  const togglePillar = (id: string) => {
    setSelectedPillars((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const advance = useCallback((decision: TriageDecision) => {
    setHistory((prev) => [...prev, decision]);
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= items.length) {
        router.refresh();
      }
      return next;
    });
  }, [items.length, router]);

  const handleUndo = useCallback(() => {
    if (isPending || history.length === 0) return;
    const last = history[history.length - 1];
    startTransition(async () => {
      let okRes = false;
      let errMsg = "Failed to undo last triage action";

      if (last.action === "selected") {
        const res = await setReferenceStatus({ id: last.refId, status: "inbox" });
        okRes = res.ok;
        if (!res.ok) errMsg = res.error.message;
      } else if (last.action === "skipped") {
        const res = await unskipReference({ id: last.refId, to: "inbox" });
        okRes = res.ok;
        if (!res.ok) errMsg = res.error.message;
      } else if (last.action === "archived") {
        const res = await restoreReference({ id: last.refId });
        okRes = res.ok;
        if (!res.ok) errMsg = res.error.message;
      }

      if (!okRes) {
        toast.error(errMsg);
        return;
      }

      setHistory((prev) => prev.slice(0, -1));
      setCurrentIndex(last.index);
      toast.info("Restored previous item back to Inbox queue");
    });
  }, [history, isPending]);

  const handleAiBedah = useCallback(async () => {
    if (!currentItem || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const res = await aiBedahReference({
        refId: currentItem.id,
        text: [summary, hookText, visualNotes].filter(Boolean).join(" — ") || currentItem.url,
        platform: currentItem.platform.name,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      setHookText(res.data.hookText);
      setVisualNotes(res.data.visualNotes);
      const aiBlock = `Key Takeaway: ${res.data.keyTakeaway}\n\nAdaptation Ideas:\n- ${res.data.adaptIdeas.join("\n- ")}`;
      setNotes((prev) => {
        if (!prev.trim()) return aiBlock;
        if (prev.includes(`Key Takeaway: ${res.data.keyTakeaway}`)) return prev;
        return `${prev.trim()}\n\n${aiBlock}`;
      });
      const matchedHook = matchHookTypeId(res.data.hookType, masterData.hookTypes);
      if (matchedHook) setHookTypeId(matchedHook);
      if (res.data.suggestedTags?.length) {
        setTagsInput(res.data.suggestedTags.join(", "));
      }
      toast.success("AI breakdown complete! Review fields below before selecting.");
    } catch {
      toast.error("Failed to run AI Breakdown");
    } finally {
      setIsAiLoading(false);
    }
  }, [currentItem, isAiLoading, summary, hookText, visualNotes, masterData.hookTypes]);

  const handleSelect = useCallback(() => {
    if (!currentItem || isPending || isAiLoading) return;
    startTransition(async () => {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const saveRes = await saveCapture({
        id: currentItem.id,
        pillarIds: selectedPillars,
        formatId: formatId || null,
        hookTypeId: hookTypeId || null,
        sourceHandle,
        audioTitle,
        summary,
        hookText,
        visualNotes,
        notes,
        tags,
      });

      if (!saveRes.ok) {
        toast.error(saveRes.error.message || "Failed to save capture edits");
        return;
      }

      const statusRes = await setReferenceStatus({ id: currentItem.id, status: "selected" });
      if (statusRes.ok) {
        toast.success("Reference saved & selected");
        advance({ index: currentIndex, refId: currentItem.id, action: "selected" });
      } else {
        toast.error(statusRes.error.message);
      }
    });
  }, [
    currentItem,
    isPending,
    isAiLoading,
    tagsInput,
    selectedPillars,
    formatId,
    hookTypeId,
    sourceHandle,
    audioTitle,
    summary,
    hookText,
    visualNotes,
    notes,
    advance,
    currentIndex,
  ]);

  const handleSkip = useCallback(() => {
    if (!currentItem || isPending || isAiLoading) return;
    startTransition(async () => {
      const res = await skipReference({ id: currentItem.id });
      if (res.ok) {
        toast.success("Reference skipped");
        advance({ index: currentIndex, refId: currentItem.id, action: "skipped" });
      } else {
        toast.error(res.error.message);
      }
    });
  }, [currentItem, isPending, isAiLoading, advance, currentIndex]);

  const handleArchive = useCallback(() => {
    if (!currentItem || isPending || isAiLoading) return;
    startTransition(async () => {
      const res = await archiveReference({ id: currentItem.id });
      if (res.ok) {
        toast.success("Reference archived");
        advance({ index: currentIndex, refId: currentItem.id, action: "archived" });
      } else {
        toast.error(res.error.message);
      }
    });
  }, [currentItem, isPending, isAiLoading, advance, currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isEditableFocused()) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        handleSelect();
      } else if (e.key === "2") {
        e.preventDefault();
        handleSkip();
      } else if (e.key === "3") {
        e.preventDefault();
        handleArchive();
      } else if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        void handleAiBedah();
      } else if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (e.key === "Escape") {
        e.preventDefault();
        router.push("/inbox");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSelect, handleSkip, handleArchive, handleAiBedah, handleUndo, router]);

  if (!currentItem) {
    return (
      <div className="w-full max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="size-16 rounded-md bg-secondary flex items-center justify-center mx-auto text-foreground border border-border">
          <Trophy className="size-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black font-display tracking-tight text-foreground">
            All Caught Up!
          </h2>
          <p className="text-xs font-mono text-muted-foreground max-w-md mx-auto">
            You processed all references in your inbox. Head over to Selected References or start crafting Content.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-4 flex-wrap">
          {history.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleUndo}
              className="text-xs font-mono h-8 rounded-md gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              <span>Undo Last</span>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="text-xs font-mono h-8 rounded-md">
            <Link href="/inbox">Back to Inbox</Link>
          </Button>
          <Button asChild size="sm" className="text-xs font-mono h-8 rounded-md bg-brand text-brand-foreground hover:bg-brand/90 font-bold">
            <Link href="/references?status=selected">Selected References</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="text-xs font-mono h-8 rounded-md border-foreground font-bold">
            <Link href="/contents/new">New Content</Link>
          </Button>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / items.length) * 100);

  return (
    <div className="w-full max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-8 space-y-6 pb-24 lg:pb-8">
      {/* Top Header & Progress */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/inbox"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Exit Triage</span>
            <kbd className="hidden sm:inline-block text-[10px] px-1 py-0.5 border border-border rounded bg-secondary">
              Esc
            </kbd>
          </Link>

          {history.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleUndo}
              className="h-7 px-2.5 text-[11px] font-mono rounded-md gap-1.5"
            >
              <RotateCcw className="size-3" />
              <span>Undo</span>
              <kbd className="hidden sm:inline-block text-[10px] text-muted-foreground">Z</kbd>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-muted-foreground tabular-nums">
            {currentIndex + 1} of {items.length}
          </span>
          <div
            role="progressbar"
            aria-label="Triage progress"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-28 h-2 bg-secondary rounded-sm overflow-hidden border border-border/60"
          >
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Two-Column Triage Studio: Preview (Left) + Capture & AI (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 9:16 Visual Preview & Source URL */}
        <div className="lg:col-span-5 bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-foreground text-background">
                {currentItem.platform.name}
              </span>
              {currentItem.format && (
                <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border">
                  {currentItem.format.name}
                </span>
              )}
            </div>
            <a
              href={currentItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              <span>Open Original</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          <div className="max-w-[260px] sm:max-w-[300px] mx-auto">
            <ReferencePreview
              key={currentItem.id}
              url={currentItem.url}
              platform={currentItem.platform.slug}
              format={currentItem.format?.name}
              coverUrl={currentItem.coverUrl}
              hookText={hookText || currentItem.hookText}
              summary={summary || currentItem.summary}
              handle={sourceHandle || currentItem.sourceAccount?.handle}
              className="aspect-[9/16] rounded-lg"
            />
          </div>

          <div className="p-2.5 rounded-md bg-secondary/50 border border-border/80 font-mono text-[11px] text-muted-foreground break-all">
            {currentItem.urlOriginal || currentItem.url}
          </div>
        </div>

        {/* Right: AI Breakdown + Metadata Capture + Quick Actions */}
        <div className="lg:col-span-7 bg-card border border-border rounded-lg p-5 sm:p-6 space-y-5">
          {/* AI Auto-Breakdown Quick Trigger */}
          <div className="p-3.5 rounded-lg border border-border bg-secondary/40 flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-0.5">
              <div className="font-bold text-foreground font-display flex items-center gap-1.5 text-xs">
                <Sparkles className="size-3.5 text-brand" />
                <span>AI Auto-Breakdown</span>
                <kbd className="hidden sm:inline-block text-[10px] font-mono px-1 py-0.5 rounded border border-border bg-card text-muted-foreground">
                  B
                </kbd>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">
                Extract opening hook, visual cues &amp; adaptation ideas before selecting
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isAiLoading || isPending}
              onClick={handleAiBedah}
              className="text-xs font-mono h-8 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5 shrink-0"
            >
              {isAiLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>Run Breakdown</span>
            </Button>
          </div>

          {/* Pillars Selection */}
          <div className="space-y-2">
            <Label className="label-mono text-muted-foreground">
              Assign Pillars
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {masterData.pillars.map((pillar) => {
                const active = selectedPillars.includes(pillar.id);
                return (
                  <button
                    key={pillar.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => togglePillar(pillar.id)}
                    className={`px-2.5 py-1.5 text-xs font-mono rounded-md border transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                      active
                        ? "bg-foreground text-background border-foreground font-bold"
                        : "bg-secondary text-muted-foreground border-border hover:border-foreground/50 hover:text-foreground"
                    }`}
                  >
                    {pillar.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format & Hook Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="triage-format" className="label-mono text-muted-foreground">
                Format
              </Label>
              <SelectField
                id="triage-format"
                value={formatId}
                onValueChange={setFormatId}
                ariaLabel="Format"
                options={[
                  { value: "", label: "-- Auto / Choose format --" },
                  ...masterData.formats.map((fmt) => ({ value: fmt.id, label: fmt.name })),
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="triage-hook-type" className="label-mono text-muted-foreground">
                Hook Archetype
              </Label>
              <SelectField
                id="triage-hook-type"
                value={hookTypeId}
                onValueChange={setHookTypeId}
                ariaLabel="Hook Archetype"
                options={[
                  { value: "", label: "-- Choose hook type --" },
                  ...masterData.hookTypes.map((ht) => ({ value: ht.id, label: ht.name })),
                ]}
              />
            </div>
          </div>

          {/* Creator & Audio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="triage-creator" className="label-mono text-muted-foreground">
                Creator Handle
              </Label>
              <Input
                id="triage-creator"
                value={sourceHandle}
                onChange={(e) => setSourceHandle(e.target.value)}
                placeholder="@username"
                className="text-xs font-mono h-9 rounded-md"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="triage-audio" className="label-mono text-muted-foreground">
                Audio / Sound
              </Label>
              <Input
                id="triage-audio"
                value={audioTitle}
                onChange={(e) => setAudioTitle(e.target.value)}
                placeholder="Track or sound name..."
                className="text-xs font-mono h-9 rounded-md"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label htmlFor="triage-summary" className="label-mono text-muted-foreground">
              Content Title / Summary
            </Label>
            <Input
              id="triage-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Concise summary of what this video is about..."
              className="text-xs font-mono h-9 rounded-md"
            />
          </div>

          {/* Hook Text */}
          <div className="space-y-1.5">
            <Label htmlFor="triage-hook-text" className="label-mono text-muted-foreground">
              Hook / Core Angle
            </Label>
            <Input
              id="triage-hook-text"
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              placeholder="Opening 3-second hook..."
              className="text-xs font-mono h-9 rounded-md"
            />
          </div>

          {/* Visual Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="triage-visual-notes" className="label-mono text-muted-foreground">
              Visual Structure
            </Label>
            <Textarea
              id="triage-visual-notes"
              value={visualNotes}
              onChange={(e) => setVisualNotes(e.target.value)}
              placeholder="Framing, pacing, shot transitions..."
              rows={2}
              className="text-xs font-mono rounded-md resize-y"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="triage-notes" className="label-mono text-muted-foreground">
              Takeaways &amp; Adaptation Notes
            </Label>
            <Textarea
              id="triage-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Takeaway or angle to replicate..."
              rows={3}
              className="text-xs font-mono rounded-md resize-y"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="triage-tags" className="label-mono text-muted-foreground">
              Tags (comma separated)
            </Label>
            <Input
              id="triage-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="outfit, fast-cuts, talking-head..."
              className="text-xs font-mono h-9 rounded-md"
            />
          </div>

          {/* Action Buttons Row (Desktop) */}
          <div className="hidden lg:block pt-4 border-t border-border/80 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isPending || isAiLoading}
                onClick={handleSkip}
                className="text-xs font-mono h-11 rounded-md border-border/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
              >
                <XCircle className="size-4" />
                <span className="font-bold">[2] Skip</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isPending || isAiLoading}
                onClick={handleArchive}
                className="text-xs font-mono h-11 rounded-md border-border/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
              >
                <Archive className="size-4" />
                <span className="font-bold">[3] Archive</span>
              </Button>

              <Button
                type="button"
                size="lg"
                disabled={isPending || isAiLoading}
                onClick={handleSelect}
                className="text-xs font-mono h-11 rounded-md bg-brand text-brand-foreground hover:bg-brand/90 font-black flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    <span>[1] Save &amp; Select</span>
                  </>
                )}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] font-mono text-muted-foreground">
              <span>1 Save &amp; Select</span>
              <span>2 Skip</span>
              <span>3 Archive</span>
              <span>B AI Breakdown</span>
              <span>Z Undo</span>
              <span>Esc Exit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Action Bar (< lg) */}
      <div className="lg:hidden fixed bottom-14 md:bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-xs border-t border-border px-3 py-2.5">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {history.length > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending || isAiLoading}
              onClick={handleUndo}
              aria-label="Undo last action"
              className="h-10 w-10 p-0 rounded-md shrink-0"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}

          <div className="grid grid-cols-3 gap-2 flex-1">
            <Button
              type="button"
              variant="outline"
              disabled={isPending || isAiLoading}
              onClick={handleSkip}
              className="text-xs font-mono h-10 rounded-md gap-1.5"
            >
              <XCircle className="size-3.5 shrink-0" />
              <span>Skip</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isPending || isAiLoading}
              onClick={handleArchive}
              className="text-xs font-mono h-10 rounded-md gap-1.5"
            >
              <Archive className="size-3.5 shrink-0" />
              <span>Archive</span>
            </Button>

            <Button
              type="button"
              disabled={isPending || isAiLoading}
              onClick={handleSelect}
              className="text-xs font-mono h-10 rounded-md bg-brand text-brand-foreground hover:bg-brand/90 font-bold gap-1.5"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  <span>Select</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
