"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/app/status-badge";
import { ReferencePreview } from "@/components/app/reference-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ExternalLink,
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  Archive,
  Save,
  CheckCircle2,
  FileText,
  Layers,
} from "lucide-react";
import {
  saveCapture,
  saveBedah,
  archiveReference,
  deleteReferencePermanently,
  setReferenceStatus,
} from "@/lib/actions/references";
import { aiBedahReference } from "@/lib/actions/ai";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import type { ReferenceListItem, MasterData } from "@/lib/queries/references";

interface ReferenceDetailClientProps {
  reference: ReferenceListItem;
  masterData: MasterData;
}

const availableElements: { id: "idea" | "hook" | "audio" | "visual" | "topic"; label: string }[] = [
  { id: "idea", label: "Idea / Concept" },
  { id: "hook", label: "Hook & Opening" },
  { id: "audio", label: "Sound / Audio" },
  { id: "visual", label: "Visual Style / B-Roll" },
  { id: "topic", label: "Core Topic" },
];

export function ReferenceDetailClient({
  reference,
  masterData,
}: ReferenceDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Active tab: "capture" | "bedah"
  const [tab, setTab] = useState<"capture" | "bedah">("capture");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAiBedah = async () => {
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
          `${prev ? prev + "\n\n" : ""}Key Takeaway: ${res.data.keyTakeaway}\n\nAdaptation Ideas:\n- ${res.data.adaptIdeas.join("\n- ")}`
      );
      if (res.data.suggestedTags?.length) {
        setTagsInput(res.data.suggestedTags.join(", "));
      }
      toast.success("AI Bedah completed! Extracted hook and adaptation ideas.");
    } catch {
      toast.error("Failed to run AI Bedah");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Capture Form State
  const [selectedPillars, setSelectedPillars] = useState<string[]>(
    reference.pillars.map((p) => p.id)
  );
  const [formatId, setFormatId] = useState<string>(reference.format?.id || "");
  const [sourceHandle, setSourceHandle] = useState<string>(
    reference.sourceAccount?.handle || ""
  );
  const [audioTitle, setAudioTitle] = useState<string>(
    reference.audio?.title || ""
  );
  const [audioArtist, setAudioArtist] = useState<string>(
    reference.audio?.artist || ""
  );
  const [hookText, setHookText] = useState<string>(reference.hookText || "");
  const [hookTypeId, setHookTypeId] = useState<string>(
    reference.hookType?.id || ""
  );
  const [visualNotes, setVisualNotes] = useState<string>(
    reference.visualNotes || ""
  );
  const [notes, setNotes] = useState<string>(reference.notes || "");
  const [tagsInput, setTagsInput] = useState<string>(
    reference.tags?.join(", ") || ""
  );

  // Bedah Elements State
  const [selectedElements, setSelectedElements] = useState<
    ("idea" | "hook" | "audio" | "visual" | "topic")[]
  >((reference.elements as any) || []);

  const togglePillar = (id: string) => {
    setSelectedPillars((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleElement = (el: "idea" | "hook" | "audio" | "visual" | "topic") => {
    setSelectedElements((prev) =>
      prev.includes(el) ? prev.filter((e) => e !== el) : [...prev, el]
    );
  };

  const handleSaveCapture = () => {
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

      if (res.ok) {
        toast.success("Capture updated");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleSaveBedah = () => {
    startTransition(async () => {
      const res = await saveBedah({
        id: reference.id,
        hookText: hookText || undefined,
        hookTypeId: hookTypeId || null,
        visualNotes: visualNotes || undefined,
        notes: notes || undefined,
        elements: selectedElements,
      });

      if (res.ok) {
        toast.success("Bedah breakdown updated");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleArchive = () => {
    startTransition(async () => {
      const res = await archiveReference({ id: reference.id });
      if (res.ok) {
        toast.success("Reference archived");
        router.push("/references");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to permanently delete this reference?")) return;
    startTransition(async () => {
      const res = await deleteReferencePermanently({ id: reference.id });
      if (res.ok) {
        toast.success("Reference permanently deleted");
        router.push("/references");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleSelectStatus = () => {
    startTransition(async () => {
      const res = await setReferenceStatus({ id: reference.id, status: "selected" });
      if (res.ok) {
        toast.success("Marked as Selected");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between border-b border-border/80 pb-4">
        <Link
          href="/references"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to References</span>
        </Link>

        <div className="flex items-center gap-2">
          {reference.status === "inbox" && (
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleSelectStatus}
              className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Select for Content</span>
            </Button>
          )}

          <Link href={`/contents/new?refId=${reference.id}`}>
            <Button
              size="sm"
              className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>Create Content</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Header & Visual Media Preview */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          {/* Visual Media Preview Poster */}
          <div className="md:col-span-1 w-full max-w-[240px] mx-auto md:mx-0">
            <ReferencePreview
              url={reference.url}
              platform={reference.platform.slug}
              format={reference.format?.name}
              coverUrl={null}
              hookText={reference.hookText}
              summary={reference.summary}
              handle={reference.sourceAccount?.handle}
              className="aspect-[9/16] rounded-lg shadow-xs"
            />
          </div>

          {/* Details & Metadata */}
          <div className="md:col-span-3 space-y-4 flex flex-col justify-between h-full">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-foreground text-background">
                    {reference.platform.name}
                  </span>
                  {reference.format && (
                    <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                      {reference.format.name}
                    </span>
                  )}
                  <StatusBadge status={reference.status} />
                </div>

                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground border border-border rounded px-3 py-1.5 hover:bg-secondary transition-colors"
                >
                  <span>Open Original Post</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </div>

              <h1 className="text-lg sm:text-2xl font-black font-display tracking-tight text-foreground pt-1">
                {reference.hookText || reference.summary || "Untitled Reference"}
              </h1>

              {reference.sourceAccount?.handle && (
                <div className="text-xs font-mono text-muted-foreground">
                  Creator:{" "}
                  <span className="text-foreground font-bold">
                    @{reference.sourceAccount.handle}
                  </span>
                </div>
              )}
            </div>

            {/* Ingested URL */}
            <div className="p-3 rounded bg-secondary/50 border border-border font-mono text-xs text-muted-foreground break-all">
              {reference.urlOriginal || reference.url}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: Capture vs Bedah */}
      <div className="flex items-center gap-2 border-b border-border/60">
        <button
          type="button"
          onClick={() => setTab("capture")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold transition-all border-b-2 select-none flex items-center gap-2 ${
            tab === "capture"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="size-3.5" />
          <span>Quick Capture</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("bedah")}
          className={`px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold transition-all border-b-2 select-none flex items-center gap-2 ${
            tab === "bedah"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="size-3.5" />
          <span>Bedah Breakdown</span>
        </button>
      </div>

      {/* Tab 1: Capture Content */}
      {tab === "capture" && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div className="space-y-4">
            {/* Pillars */}
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Pillars
              </Label>
              <div className="flex flex-wrap gap-2">
                {masterData.pillars.map((pillar) => {
                  const isSelected = selectedPillars.includes(pillar.id);
                  return (
                    <button
                      key={pillar.id}
                      type="button"
                      onClick={() => togglePillar(pillar.id)}
                      className={`px-3 py-1 text-xs font-mono rounded border transition-all select-none ${
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

            {/* Format & Hook Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Format
                </Label>
                <select
                  value={formatId}
                  onChange={(e) => setFormatId(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:border-foreground"
                >
                  <option value="">-- Choose format --</option>
                  {masterData.formats.map((fmt) => (
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
                  className="w-full h-9 px-2.5 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:border-foreground"
                >
                  <option value="">-- Choose hook type --</option>
                  {masterData.hookTypes.map((ht) => (
                    <option key={ht.id} value={ht.id}>
                      {ht.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hook text */}
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Hook Text / Headline
              </Label>
              <Input
                value={hookText}
                onChange={(e) => setHookText(e.target.value)}
                placeholder="The hook statement or opening text..."
                className="text-xs font-mono h-9"
              />
            </div>

            {/* Creator & Audio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Source Creator Handle
                </Label>
                <Input
                  value={sourceHandle}
                  onChange={(e) => setSourceHandle(e.target.value)}
                  placeholder="@handle"
                  className="text-xs font-mono h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Audio / Sound Title
                </Label>
                <Input
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  placeholder="Audio track title..."
                  className="text-xs font-mono h-9"
                />
              </div>
            </div>

            {/* Visual Notes & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Visual Structure
                </Label>
                <Textarea
                  value={visualNotes}
                  onChange={(e) => setVisualNotes(e.target.value)}
                  placeholder="Visual pacing, shot types, framing..."
                  rows={3}
                  className="text-xs font-mono resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Key Notes & Insights
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Insights, reasons it worked, takeaways..."
                  rows={3}
                  className="text-xs font-mono resize-none"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Tags (comma separated)
              </Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="editing, pacing, typography"
                className="text-xs font-mono h-9"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchive}
                disabled={isPending}
                className="text-xs font-mono h-8 text-muted-foreground hover:text-foreground gap-1"
              >
                <Archive className="size-3.5" />
                <span>Archive</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isPending || Boolean(reference.contentId)}
                className="text-xs font-mono h-8 text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </Button>
            </div>

            <Button
              size="sm"
              onClick={handleSaveCapture}
              disabled={isPending}
              className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>Save Changes</span>
            </Button>
          </div>
        </div>
      )}

      {/* Tab 2: Bedah Breakdown */}
      {tab === "bedah" && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          {/* AI Bedah Banner */}
          <div className="p-4 rounded-lg border border-border bg-secondary/40 flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-0.5">
              <span className="font-bold text-foreground font-display flex items-center gap-1.5 text-xs">
                <Sparkles className="size-3.5 text-amber-500 fill-amber-500" />
                <span>AI Auto-Breakdown (Gemini)</span>
              </span>
              <p className="text-[11px] font-mono text-muted-foreground">
                Automatically extract opening hooks, visual structure & original adaptation ideas
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isAiLoading}
              onClick={handleAiBedah}
              className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
            >
              {isAiLoading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
              <span>Run Auto-Breakdown</span>
            </Button>
          </div>

          <div className="space-y-4">
            {/* Elements Checkboxes */}
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Elements to Replicate / Adapt (Bedah)
              </Label>
              <div className="flex flex-wrap gap-2">
                {availableElements.map((el) => {
                  const active = selectedElements.includes(el.id);
                  return (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() => toggleElement(el.id)}
                      className={`px-3 py-1.5 text-xs font-mono rounded border transition-all select-none ${
                        active
                          ? "bg-foreground text-background border-foreground font-bold"
                          : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {active ? "✓ " : "+ "}
                      {el.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hook & Hook Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Hook Analysis
                </Label>
                <Input
                  value={hookText}
                  onChange={(e) => setHookText(e.target.value)}
                  placeholder="Hook text..."
                  className="text-xs font-mono h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Hook Classification
                </Label>
                <select
                  value={hookTypeId}
                  onChange={(e) => setHookTypeId(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:border-foreground"
                >
                  <option value="">-- Choose hook type --</option>
                  {masterData.hookTypes.map((ht) => (
                    <option key={ht.id} value={ht.id}>
                      {ht.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Visual Breakdown */}
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Visual & Pacing Breakdown
              </Label>
              <Textarea
                value={visualNotes}
                onChange={(e) => setVisualNotes(e.target.value)}
                placeholder="Scene 1: Hook with face zoom. Scene 2: Screen recording b-roll. Scene 3: Strong takeaway..."
                rows={4}
                className="text-xs font-mono"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Bedah Synthesis / Spin Idea
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How to adapt this for our niche: Change the context from X to Y..."
                rows={3}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end">
            <Button
              size="sm"
              onClick={handleSaveBedah}
              disabled={isPending}
              className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>Save Bedah</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
