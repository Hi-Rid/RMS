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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Copy,
  Check,
  Music,
  User,
} from "lucide-react";
import {
  saveCapture,
  saveBedah,
  archiveReference,
  deleteReferencePermanently,
  setReferenceStatus,
  enrichReferenceWithAgent,
} from "@/lib/actions/references";
import { aiBedahReference } from "@/lib/actions/ai";
import { matchHookTypeId } from "@/lib/domain/normalize";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import type {
  ReferenceListItem,
  MasterData,
  SimilarReferenceItem,
} from "@/lib/queries/references";

interface ReferenceDetailClientProps {
  reference: ReferenceListItem;
  masterData: MasterData;
  similarReferences?: SimilarReferenceItem[];
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
  similarReferences = [],
}: ReferenceDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Active tab: "capture" | "bedah"
  const [tab, setTab] = useState<"capture" | "bedah">("capture");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopyUrl = async () => {
    const raw = reference.urlOriginal || reference.url;
    try {
      await navigator.clipboard.writeText(raw);
      setCopiedUrl(true);
      toast.success("Source URL copied");
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const handleAutoEnrich = async () => {
    setIsAgentLoading(true);
    try {
      const res = await enrichReferenceWithAgent({ id: reference.id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      if (res.data.draftContentTitle) {
        toast.success(`AI Agent enriched & drafted "${res.data.draftContentTitle}" in Studio!`);
      } else if (res.data.enriched) {
        toast.success("AI Agent populated summary, hook, pillars & strategy notes!");
      } else {
        toast.info("Metadata refreshed from source.");
      }
      router.refresh();
    } catch {
      toast.error("Failed to run AI Content Agent");
    } finally {
      setIsAgentLoading(false);
    }
  };

  const [aiIdeas, setAiIdeas] = useState<string[]>(() => {
    if (!reference.notes) return [];
    const marker = "Adaptation Ideas:";
    const idx = reference.notes.indexOf(marker);
    if (idx === -1) return [];
    return reference.notes
      .slice(idx + marker.length)
      .split("\n")
      .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
      .filter(Boolean);
  });

  const handleAiBedah = async () => {
    setIsAiLoading(true);
    try {
      const res = await aiBedahReference({
        refId: reference.id,
        text: [summary, hookText, visualNotes].filter(Boolean).join(" — ") || reference.url,
        platform: reference.platform.name,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      setHookText(res.data.hookText);
      setVisualNotes(res.data.visualNotes);
      setAiIdeas(res.data.adaptIdeas || []);
      setNotes(
        (prev) =>
          `${prev ? prev + "\n\n" : ""}Key Takeaway: ${res.data.keyTakeaway}\n\nAdaptation Ideas:\n- ${res.data.adaptIdeas.join("\n- ")}`
      );
      const matchedHookId = matchHookTypeId(res.data.hookType, masterData.hookTypes);
      if (matchedHookId) setHookTypeId(matchedHookId);
      if (res.data.suggestedTags?.length) {
        setTagsInput(res.data.suggestedTags.join(", "));
      }
      toast.success("AI breakdown completed! Extracted hook and adaptation ideas.");
    } catch {
      toast.error("Failed to run AI Breakdown");
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
  const [summary, setSummary] = useState<string>(reference.summary || "");
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
        summary: summary || undefined,
        hookText: hookText || undefined,
        hookTypeId: hookTypeId || null,
        visualNotes: visualNotes || undefined,
        notes: notes || undefined,
        tags,
      });

      if (res.ok) {
        toast.success("Capture updated");
        router.refresh();
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
        toast.success("Breakdown updated");
        router.refresh();
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
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const livePillarObjects = masterData.pillars.filter((p) =>
    selectedPillars.includes(p.id)
  );
  const parsedTags = tagsInput
    .split(",")
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);
  const activeHookTypeName =
    masterData.hookTypes.find((h) => h.id === hookTypeId)?.name ??
    reference.hookType?.name ??
    null;

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border/80 pb-4">
        <Link
          href="/references"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to References</span>
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
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

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isAgentLoading || isPending}
            onClick={handleAutoEnrich}
            className="text-xs font-mono h-8 border-primary/30 text-primary hover:bg-primary/5 gap-1.5"
          >
            {isAgentLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>{isAgentLoading ? "Analyzing Video..." : "AI Auto-Fill"}</span>
          </Button>

          {reference.contentId ? (
            <Link href={`/contents/${reference.contentId}`}>
              <Button
                size="sm"
                className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
              >
                <ExternalLink className="size-3.5" />
                <span>Open Content Draft</span>
              </Button>
            </Link>
          ) : (
            <Link href={`/contents/new?refId=${reference.id}`}>
              <Button
                size="sm"
                className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Create Content</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Studio 2-Column Workspace: Sticky Video Rail + Editorial Detail Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Sticky 9:16 Media Preview + Quick Identity Specs */}
        <aside className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-6 space-y-4">
          <div className="bg-card border border-border rounded-xl p-3.5 space-y-3.5">
            <div className="w-full max-w-[260px] mx-auto lg:max-w-none">
              <ReferencePreview
                url={reference.url}
                platform={reference.platform.slug}
                format={reference.format?.name}
                coverUrl={reference.coverUrl}
                hookText={hookText || reference.hookText}
                summary={summary || reference.summary}
                handle={sourceHandle || reference.sourceAccount?.handle}
                className="aspect-[9/16] rounded-lg shadow-xs"
              />
            </div>

            {/* Compact Attribution & Source Links */}
            <div className="space-y-2.5 pt-1 border-t border-border/70 text-xs font-mono">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <User className="size-3" />
                  <span>Creator</span>
                </span>
                <span className="text-foreground font-semibold truncate">
                  {sourceHandle ? `@${sourceHandle}` : "—"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0 pt-0.5">
                  <Music className="size-3" />
                  <span>Audio</span>
                </span>
                <span
                  className="text-foreground text-right line-clamp-2 leading-snug"
                  title={audioTitle || undefined}
                >
                  {audioTitle || "—"}
                </span>
              </div>

              {livePillarObjects.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {livePillarObjects.map((p) => (
                    <span
                      key={p.id}
                      className="text-[10px] px-2 py-0.5 rounded bg-secondary text-foreground border border-border/80 font-medium"
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Compact Source URL + Copy + External Open */}
              <div className="pt-1 flex items-center gap-1.5">
                <div
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-secondary/60 border border-border text-[10px] text-muted-foreground truncate"
                  title={reference.urlOriginal || reference.url}
                >
                  {reference.url}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  title="Copy source link"
                  className="h-7 w-7 p-0 shrink-0"
                >
                  {copiedUrl ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open original post"
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border bg-background hover:bg-secondary transition-colors shrink-0"
                >
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column: Editorial Headline + Capture/Breakdown Tabs + Similar Matches */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-5 min-w-0">
          {/* Clean Editorial Header */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-foreground text-background">
                  {reference.platform.name}
                </span>
                {reference.format && (
                  <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                    {reference.format.name}
                  </span>
                )}
                <StatusBadge status={reference.status} />
                {activeHookTypeName && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary/70 text-foreground border border-border/80">
                    {activeHookTypeName}
                  </span>
                )}
              </div>

              {parsedTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {parsedTags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-mono text-muted-foreground"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <h1 className="text-lg sm:text-xl font-bold font-display leading-snug tracking-tight text-foreground">
              {summary || hookText || "Untitled Reference"}
            </h1>

            {summary && hookText && hookText !== summary && (
              <div className="border-l-2 border-primary/50 pl-3 py-0.5 text-xs font-mono text-muted-foreground leading-relaxed">
                <span className="font-bold uppercase tracking-wider text-foreground mr-1.5">
                  Opening Hook:
                </span>
                <span>{hookText}</span>
              </div>
            )}
          </div>

          {/* Tabs Container Card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Tabs Bar */}
            <div className="flex items-center justify-between border-b border-border bg-secondary/20 px-5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab("capture")}
                  className={`py-3 px-2 text-xs font-mono uppercase tracking-wider font-bold transition-all border-b-2 select-none flex items-center gap-2 ${
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
                  className={`py-3 px-2 text-xs font-mono uppercase tracking-wider font-bold transition-all border-b-2 select-none flex items-center gap-2 ${
                    tab === "bedah"
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layers className="size-3.5" />
                  <span>Breakdown</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Capture Content */}
            {tab === "capture" && (
              <div className="p-5 sm:p-6 space-y-5">
                <div className="space-y-4">
                  {/* Pillars */}
                  <div className="space-y-2">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Pillars
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {masterData.pillars.map((pillar) => {
                        const isSelected = selectedPillars.includes(pillar.id);
                        return (
                          <button
                            key={pillar.id}
                            type="button"
                            onClick={() => togglePillar(pillar.id)}
                            className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-all select-none ${
                              isSelected
                                ? "bg-foreground text-background border-foreground font-semibold"
                                : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"
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
                        className="w-full h-9 px-2.5 text-xs font-mono bg-background border border-border rounded-md focus:outline-none focus:border-foreground"
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
                        className="w-full h-9 px-2.5 text-xs font-mono bg-background border border-border rounded-md focus:outline-none focus:border-foreground"
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

                  {/* Summary / Title */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Content Title / Summary
                    </Label>
                    <Input
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Concise description of what this reference shows..."
                      className="text-xs font-mono h-9"
                    />
                  </div>

                  {/* Hook text */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Hook Text / Opening 3s Cue
                    </Label>
                    <Input
                      value={hookText}
                      onChange={(e) => setHookText(e.target.value)}
                      placeholder="Spoken hook or visual opening action..."
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
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                        Visual Structure
                      </Label>
                      <Textarea
                        value={visualNotes}
                        onChange={(e) => setVisualNotes(e.target.value)}
                        placeholder="Visual pacing, shot types, framing..."
                        rows={5}
                        className="text-xs font-mono leading-relaxed"
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
                        rows={5}
                        className="text-xs font-mono leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Tags (comma separated)
                    </Label>
                    <Input
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="all-black-outfit, tilt-up-shot, fit-check"
                      className="text-xs font-mono h-9"
                    />
                    {parsedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {parsedTags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary/70 border border-border/70 text-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between flex-wrap gap-2">
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending || Boolean(reference.contentId)}
                          title={
                            reference.contentId
                              ? "Cannot delete: Reference is attached to content"
                              : "Delete this reference permanently"
                          }
                          className="text-xs font-mono h-8 text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Reference Permanently?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently deletes the reference and its captured breakdown. You can archive it instead if you may need it later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={handleDelete}>
                            Delete Permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

            {/* Tab 2: Breakdown */}
            {tab === "bedah" && (
              <div className="p-5 sm:p-6 space-y-6">
                {/* AI Breakdown Banner */}
                <div className="p-4 rounded-lg border border-border bg-secondary/40 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground font-display flex items-center gap-1.5 text-xs">
                      <Sparkles className="size-3.5 text-amber-500 fill-amber-500" />
                      <span>AI Auto-Breakdown</span>
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
                      Elements to Replicate / Adapt
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
                        className="w-full h-9 px-2.5 text-xs font-mono bg-background border border-border rounded-md focus:outline-none focus:border-foreground"
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
                      rows={5}
                      className="text-xs font-mono leading-relaxed"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Adaptation Synthesis / Spin Idea
                    </Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="How to adapt this for our niche: Change the context from X to Y..."
                      rows={4}
                      className="text-xs font-mono leading-relaxed"
                    />
                  </div>

                  {/* Interactive Adaptation Ideas -> 1-Click Turn into Content */}
                  {aiIdeas.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-amber-500" />
                        <span>Adaptation Ideas (Turn into Original Content)</span>
                      </Label>
                      <div className="space-y-2">
                        {aiIdeas.map((idea, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-border bg-secondary/30 flex items-center justify-between gap-3"
                          >
                            <p className="text-xs font-mono text-foreground leading-relaxed flex-1">
                              {idea}
                            </p>
                            <Link
                              href={`/contents/new?refId=${reference.id}&idea=${encodeURIComponent(idea)}`}
                              className="shrink-0"
                            >
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 px-2.5 text-[11px] font-mono bg-foreground text-background font-bold gap-1"
                              >
                                <Plus className="size-3" />
                                <span>Turn into Content</span>
                              </Button>
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    <span>Save Breakdown</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {similarReferences.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-emerald-500" />
                  <span>Similar References (Semantic Match)</span>
                </h2>
                <span className="text-[10px] font-mono text-muted-foreground">
                  768-d Vector Cosine Similarity
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {similarReferences.map((sim) => (
                  <Link
                    key={sim.id}
                    href={`/references/${sim.id}`}
                    className="p-3 rounded-lg border border-border/80 bg-secondary/20 hover:bg-secondary/50 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground truncate">
                        <span className="uppercase font-semibold text-foreground">
                          {sim.platformName}
                        </span>
                        {sim.handle && <span>@{sim.handle}</span>}
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {Math.round(sim.similarity * 100)}% match
                      </span>
                    </div>
                    <p className="text-xs font-mono text-foreground line-clamp-2 leading-relaxed">
                      {sim.hookText || sim.summary || sim.url}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
