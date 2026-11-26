"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/app/status-badge";
import { ReferencePreview } from "@/components/app/reference-preview";
import { SelectField } from "@/components/app/select-field";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
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
  RotateCcw,
  Save,
  CheckCircle2,
  XCircle,
  Inbox,
  FileText,
  Layers,
  Copy,
  Check,
  Music,
  User,
  Sparkles,
} from "lucide-react";
import {
  saveCapture,
  saveBedah,
  archiveReference,
  restoreReference,
  deleteReferencePermanently,
  setReferenceStatus,
  skipReference,
  unskipReference,
  enrichReferenceWithAgent,
} from "@/lib/actions/references";
import { aiBedahReference } from "@/lib/actions/ai";
import { matchHookTypeId } from "@/lib/domain/normalize";
import { toast } from "sonner";
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

function extractAdaptationIdeas(rawNotes: string | null | undefined): string[] {
  if (!rawNotes) return [];
  const marker = "Adaptation Ideas:";
  const idx = rawNotes.indexOf(marker);
  if (idx === -1) return [];
  const lines = rawNotes.slice(idx + marker.length).split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (out.length > 0) break;
      continue;
    }
    if (/^(Key Takeaway|Key Insight|Notes):/i.test(trimmed)) break;
    out.push(trimmed.replace(/^[-*•]\s*/, ""));
  }
  return out;
}

export function ReferenceDetailClient({
  reference,
  masterData,
  similarReferences = [],
}: ReferenceDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Active tab: "capture" | "bedah" (preserved across saves since key={reference.id})
  const [tab, setTab] = useState<"capture" | "bedah">("capture");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  // Form states
  const [selectedPillars, setSelectedPillars] = useState<string[]>(
    reference.pillars.map((p) => p.id)
  );
  const [formatId, setFormatId] = useState<string>(reference.format?.id || "");
  const [sourceHandle, setSourceHandle] = useState<string>(
    reference.sourceAccount?.handle || ""
  );
  const [audioTitle, setAudioTitle] = useState<string>(reference.audio?.title || "");
  const [audioArtist, setAudioArtist] = useState<string>(reference.audio?.artist || "");
  const [summary, setSummary] = useState<string>(reference.summary || "");
  const [hookText, setHookText] = useState<string>(reference.hookText || "");
  const [hookTypeId, setHookTypeId] = useState<string>(reference.hookType?.id || "");
  const [visualNotes, setVisualNotes] = useState<string>(reference.visualNotes || "");
  const [notes, setNotes] = useState<string>(reference.notes || "");
  const [tagsInput, setTagsInput] = useState<string>(reference.tags?.join(", ") || "");
  const [selectedElements, setSelectedElements] = useState<
    ("idea" | "hook" | "audio" | "visual" | "topic")[]
  >((reference.elements as ("idea" | "hook" | "audio" | "visual" | "topic")[]) || []);

  const [aiIdeas, setAiIdeas] = useState<string[]>(() =>
    extractAdaptationIdeas(reference.notes)
  );

  // Sync only when server data changes after AI Auto-Fill / Refresh while staying on same ref
  const serverSignature = React.useMemo(
    () =>
      JSON.stringify({
        pillars: reference.pillars.map((p) => p.id),
        formatId: reference.format?.id || "",
        sourceHandle: reference.sourceAccount?.handle || "",
        audioTitle: reference.audio?.title || "",
        audioArtist: reference.audio?.artist || "",
        summary: reference.summary || "",
        hookText: reference.hookText || "",
        hookTypeId: reference.hookType?.id || "",
        visualNotes: reference.visualNotes || "",
        notes: reference.notes || "",
        tags: reference.tags?.join(", ") || "",
        elements: reference.elements || [],
      }),
    [reference]
  );

  const isDirty = React.useMemo(() => {
    const currentSignature = JSON.stringify({
      pillars: selectedPillars,
      formatId,
      sourceHandle,
      audioTitle,
      audioArtist,
      summary,
      hookText,
      hookTypeId,
      visualNotes,
      notes,
      tags: tagsInput,
      elements: selectedElements,
    });
    return currentSignature !== serverSignature;
  }, [
    selectedPillars,
    formatId,
    sourceHandle,
    audioTitle,
    audioArtist,
    summary,
    hookText,
    hookTypeId,
    visualNotes,
    notes,
    tagsInput,
    selectedElements,
    serverSignature,
  ]);

  useUnsavedChanges(isDirty);

  // If AI Auto-Fill refreshed the server payload while user was NOT dirty, sync UI cleanly
  const prevServerSigRef = React.useRef(serverSignature);
  React.useEffect(() => {
    if (prevServerSigRef.current === serverSignature) return;
    prevServerSigRef.current = serverSignature;
    setSelectedPillars(reference.pillars.map((p) => p.id));
    setFormatId(reference.format?.id || "");
    setSourceHandle(reference.sourceAccount?.handle || "");
    setAudioTitle(reference.audio?.title || "");
    setAudioArtist(reference.audio?.artist || "");
    setSummary(reference.summary || "");
    setHookText(reference.hookText || "");
    setHookTypeId(reference.hookType?.id || "");
    setVisualNotes(reference.visualNotes || "");
    setNotes(reference.notes || "");
    setTagsInput(reference.tags?.join(", ") || "");
    setSelectedElements((reference.elements as ("idea" | "hook" | "audio" | "visual" | "topic")[]) || []);
    setAiIdeas(extractAdaptationIdeas(reference.notes));
  }, [serverSignature, reference]);

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
      const aiBlock = `Key Takeaway: ${res.data.keyTakeaway}\n\nAdaptation Ideas:\n- ${res.data.adaptIdeas.join("\n- ")}`;
      setNotes((prev) => {
        if (!prev.trim()) return aiBlock;
        if (prev.includes(`Key Takeaway: ${res.data.keyTakeaway}`)) return prev;
        return `${prev.trim()}\n\n${aiBlock}`;
      });
      const matchedHookId = matchHookTypeId(res.data.hookType, masterData.hookTypes);
      if (matchedHookId) setHookTypeId(matchedHookId);
      if (res.data.suggestedTags?.length) {
        setTagsInput(res.data.suggestedTags.join(", "));
      }
      toast.success("AI breakdown completed! Click Save to persist changes.");
    } catch {
      toast.error("Failed to run AI Breakdown");
    } finally {
      setIsAiLoading(false);
    }
  };

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

  // Unified full save so switching tabs or saving from either tab never drops unsaved fields
  const persistAllFields = async (): Promise<boolean> => {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const [capRes, bedahRes] = await Promise.all([
      saveCapture({
        id: reference.id,
        pillarIds: selectedPillars,
        formatId: formatId || null,
        sourceHandle,
        audioTitle,
        audioArtist,
        summary,
        hookText,
        hookTypeId: hookTypeId || null,
        visualNotes,
        notes,
        tags,
      }),
      saveBedah({
        id: reference.id,
        hookText,
        hookTypeId: hookTypeId || null,
        visualNotes,
        notes,
        elements: selectedElements,
      }),
    ]);

    if (!capRes.ok) {
      toast.error(capRes.error.message);
      return false;
    }
    if (!bedahRes.ok) {
      toast.error(bedahRes.error.message);
      return false;
    }
    return true;
  };

  const handleSaveAll = () => {
    startTransition(async () => {
      const okSave = await persistAllFields();
      if (okSave) {
        toast.success("Reference details saved");
        router.refresh();
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

  const handleRestore = () => {
    startTransition(async () => {
      const res = await restoreReference({ id: reference.id });
      if (res.ok) {
        toast.success("Reference restored from archive");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleDelete = async () => {
    const res = await deleteReferencePermanently({ id: reference.id });
    if (res.ok) {
      toast.success("Reference permanently deleted");
      setDeleteDialogOpen(false);
      router.push("/references");
    } else {
      toast.error(res.error.message);
    }
  };

  const handleStatusTransition = (next: "selected" | "inbox" | "skipped") => {
    startTransition(async () => {
      let okRes = false;
      let errMsg = "Status update failed";
      if (next === "skipped") {
        const res = await skipReference({ id: reference.id });
        okRes = res.ok;
        if (!res.ok) errMsg = res.error.message;
      } else if (reference.status === "skipped") {
        const res = await unskipReference({ id: reference.id, to: next });
        okRes = res.ok;
        if (!res.ok) errMsg = res.error.message;
      } else {
        const res = await setReferenceStatus({ id: reference.id, status: next });
        okRes = res.ok;
        if (!res.ok) errMsg = res.error.message;
      }

      if (okRes) {
        toast.success(`Moved to ${next}`);
        router.refresh();
      } else {
        toast.error(errMsg);
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

  const isArchived = Boolean(reference.archivedAt);

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border/80 pb-4">
        <button
          type="button"
          onClick={() => {
            if (isDirty) setLeaveDialogOpen(true);
            else router.push("/references");
          }}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to References</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && (
            <span className="text-[11px] font-mono font-semibold text-warning px-2 py-0.5 rounded-md bg-warning/10 border border-warning/30">
              Unsaved edits
            </span>
          )}

          {!reference.contentId && reference.status !== "selected" && (
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => handleStatusTransition("selected")}
              className="text-xs font-mono h-8 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Select</span>
            </Button>
          )}

          {!reference.contentId && reference.status !== "skipped" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handleStatusTransition("skipped")}
              className="text-xs font-mono h-8 rounded-md gap-1"
            >
              <XCircle className="size-3.5" />
              <span>Skip</span>
            </Button>
          )}

          {!reference.contentId && reference.status !== "inbox" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handleStatusTransition("inbox")}
              className="text-xs font-mono h-8 rounded-md gap-1"
            >
              <Inbox className="size-3.5" />
              <span>Move to Inbox</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isAgentLoading || isPending}
            onClick={handleAutoEnrich}
            className="text-xs font-mono h-8 rounded-md border-brand/30 text-brand hover:bg-brand/5 gap-1.5"
          >
            {isAgentLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>{isAgentLoading ? "Analyzing Video..." : "AI Auto-Fill"}</span>
          </Button>

          {reference.contentId ? (
            <Button
              asChild
              size="sm"
              className="text-xs font-mono h-8 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5"
            >
              <Link href={`/contents/${reference.contentId}`}>
                <ExternalLink className="size-3.5" />
                <span>Open Content Draft</span>
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="text-xs font-mono h-8 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5"
            >
              <Link href={`/contents/new?refId=${reference.id}`}>
                <Plus className="size-3.5" />
                <span>Create Content</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Archived Banner */}
      {isArchived && (
        <div className="p-3.5 rounded-lg border border-warning/40 bg-warning/10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-mono text-foreground">
            This reference is currently <strong>Archived</strong> and hidden from active workflows.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={handleRestore}
            className="h-8 text-xs font-mono rounded-md bg-foreground text-background font-bold gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>Restore Reference</span>
          </Button>
        </div>
      )}

      {/* Studio 2-Column Workspace: Sticky Video Rail + Editorial Detail Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Sticky 9:16 Media Preview + Quick Identity Specs */}
        <aside className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-6 space-y-4">
          <div className="bg-card border border-border rounded-lg p-3.5 space-y-3.5">
            <div className="w-full max-w-[260px] mx-auto lg:max-w-none">
              <ReferencePreview
                url={reference.url}
                platform={reference.platform.slug}
                format={reference.format?.name}
                coverUrl={reference.coverUrl}
                hookText={hookText || reference.hookText}
                summary={summary || reference.summary}
                handle={sourceHandle || reference.sourceAccount?.handle}
                className="aspect-[9/16] rounded-md"
              />
            </div>

            {/* Compact Attribution & Source Links */}
            <div className="space-y-2.5 pt-1 border-t border-border/70 text-xs font-mono">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <User className="size-3" />
                  <span>Creator</span>
                </span>
                {reference.sourceAccount && sourceHandle === reference.sourceAccount.handle ? (
                  <Link
                    href={`/sources/${reference.sourceAccount.id}`}
                    className="text-foreground font-semibold truncate hover:underline"
                  >
                    @{sourceHandle}
                  </Link>
                ) : (
                  <span className="text-foreground font-semibold truncate">
                    {sourceHandle ? `@${sourceHandle}` : "—"}
                  </span>
                )}
              </div>

              <div className="flex items-start justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0 pt-0.5">
                  <Music className="size-3" />
                  <span>Audio</span>
                </span>
                {reference.audio && audioTitle === reference.audio.title ? (
                  <Link
                    href={`/audio/${reference.audio.id}`}
                    title={audioTitle}
                    className="text-foreground text-right line-clamp-2 leading-snug hover:underline"
                  >
                    {audioTitle}
                  </Link>
                ) : (
                  <span className="text-foreground text-right line-clamp-2 leading-snug" title={audioTitle || undefined}>
                    {audioTitle || "—"}
                  </span>
                )}
              </div>

              {livePillarObjects.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {livePillarObjects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/references?pillar=${encodeURIComponent(p.slug)}`}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border/80 font-medium hover:border-foreground/40 hover:bg-background transition-colors"
                    >
                      {p.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Compact Source URL + Copy + External Open */}
              <div className="pt-1 flex items-center gap-1.5">
                <div
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-secondary/60 border border-border text-[10px] text-muted-foreground truncate"
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
                  aria-label="Copy source link"
                  className="h-8 w-8 p-0 shrink-0 rounded-md"
                >
                  {copiedUrl ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open original post"
                  aria-label="Open original post in new tab"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-background hover:bg-secondary transition-colors shrink-0"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column: Editorial Headline + Capture/Breakdown Tabs + Similar Matches */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-5 min-w-0">
          {/* Clean Editorial Header */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-foreground text-background">
                  {reference.platform.name}
                </span>
                {reference.format && (
                  <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border">
                    {reference.format.name}
                  </span>
                )}
                <StatusBadge status={reference.status} />
                {activeHookTypeName && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-secondary/70 text-foreground border border-border/80">
                    {activeHookTypeName}
                  </span>
                )}
              </div>

              {parsedTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {parsedTags.slice(0, 4).map((t) => (
                    <span key={t} className="text-[10px] font-mono text-muted-foreground">
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
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Tabs Bar */}
            <div className="flex items-center justify-between border-b border-border bg-secondary/20 px-5">
              <div role="tablist" aria-label="Reference detail workspace" className="flex items-center gap-2">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "capture"}
                  onClick={() => setTab("capture")}
                  className={`py-3 px-2 text-xs font-mono uppercase tracking-wider font-bold transition-colors border-b-2 select-none flex items-center gap-2 ${
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
                  role="tab"
                  aria-selected={tab === "bedah"}
                  onClick={() => setTab("bedah")}
                  className={`py-3 px-2 text-xs font-mono uppercase tracking-wider font-bold transition-colors border-b-2 select-none flex items-center gap-2 ${
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
                    <Label className="label-mono text-muted-foreground">Pillars</Label>
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
                      <Label htmlFor="ref-format" className="label-mono text-muted-foreground">
                        Format
                      </Label>
                      <SelectField
                        id="ref-format"
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
                      <Label htmlFor="ref-hook-type" className="label-mono text-muted-foreground">
                        Hook Type
                      </Label>
                      <SelectField
                        id="ref-hook-type"
                        value={hookTypeId}
                        onValueChange={setHookTypeId}
                        ariaLabel="Hook Type"
                        options={[
                          { value: "", label: "-- Choose hook type --" },
                          ...masterData.hookTypes.map((ht) => ({ value: ht.id, label: ht.name })),
                        ]}
                      />
                    </div>
                  </div>

                  {/* Summary / Title */}
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-summary" className="label-mono text-muted-foreground">
                      Content Title / Summary
                    </Label>
                    <Input
                      id="ref-summary"
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Concise description of what this reference shows..."
                      className="text-xs font-mono h-9 rounded-md"
                    />
                  </div>

                  {/* Hook text */}
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-hook-text" className="label-mono text-muted-foreground">
                      Hook Text / Opening 3s Cue
                    </Label>
                    <Input
                      id="ref-hook-text"
                      value={hookText}
                      onChange={(e) => setHookText(e.target.value)}
                      placeholder="Spoken hook or visual opening action..."
                      className="text-xs font-mono h-9 rounded-md"
                    />
                  </div>

                  {/* Creator & Audio */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="ref-source-handle" className="label-mono text-muted-foreground">
                        Source Creator Handle
                      </Label>
                      <Input
                        id="ref-source-handle"
                        value={sourceHandle}
                        onChange={(e) => setSourceHandle(e.target.value)}
                        placeholder="@handle"
                        className="text-xs font-mono h-9 rounded-md"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ref-audio-title" className="label-mono text-muted-foreground">
                        Audio / Sound Title
                      </Label>
                      <Input
                        id="ref-audio-title"
                        value={audioTitle}
                        onChange={(e) => setAudioTitle(e.target.value)}
                        placeholder="Audio track title..."
                        className="text-xs font-mono h-9 rounded-md"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ref-audio-artist" className="label-mono text-muted-foreground">
                        Audio Artist
                      </Label>
                      <Input
                        id="ref-audio-artist"
                        value={audioArtist}
                        onChange={(e) => setAudioArtist(e.target.value)}
                        placeholder="Artist name..."
                        disabled={!audioTitle.trim()}
                        className="text-xs font-mono h-9 rounded-md"
                      />
                    </div>
                  </div>

                  {/* Visual Notes & Notes */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="ref-visual-notes" className="label-mono text-muted-foreground">
                        Visual Structure
                      </Label>
                      <Textarea
                        id="ref-visual-notes"
                        value={visualNotes}
                        onChange={(e) => setVisualNotes(e.target.value)}
                        placeholder="Visual pacing, shot types, framing..."
                        rows={5}
                        className="text-xs font-mono leading-relaxed rounded-md"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ref-notes" className="label-mono text-muted-foreground">
                        Key Notes &amp; Insights
                      </Label>
                      <Textarea
                        id="ref-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Insights, reasons it worked, takeaways..."
                        rows={5}
                        className="text-xs font-mono leading-relaxed rounded-md"
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <Label htmlFor="ref-tags" className="label-mono text-muted-foreground">
                      Tags (comma separated)
                    </Label>
                    <Input
                      id="ref-tags"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="all-black-outfit, tilt-up-shot, fit-check"
                      className="text-xs font-mono h-9 rounded-md"
                    />
                    {parsedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
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
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {isArchived ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRestore}
                          disabled={isPending}
                          className="text-xs font-mono h-8 rounded-md gap-1"
                        >
                          <RotateCcw className="size-3.5" />
                          <span>Restore</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleArchive}
                          disabled={isPending}
                          className="text-xs font-mono h-8 rounded-md text-muted-foreground hover:text-foreground gap-1"
                        >
                          <Archive className="size-3.5" />
                          <span>Archive</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending || Boolean(reference.contentId)}
                        onClick={() => setDeleteDialogOpen(true)}
                        className="text-xs font-mono h-8 rounded-md text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Delete</span>
                      </Button>
                    </div>
                    {reference.contentId && (
                      <p className="text-[10px] font-mono text-muted-foreground">
                        Delete disabled while linked to a Studio content draft.
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveAll}
                    disabled={isPending}
                    className="text-xs font-mono h-9 px-4 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5"
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
                      <Sparkles className="size-3.5 text-warning fill-warning" />
                      <span>AI Auto-Breakdown</span>
                    </span>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Automatically extract opening hooks, visual structure &amp; adaptation ideas
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isAiLoading || isPending}
                    onClick={handleAiBedah}
                    className="text-xs font-mono h-8 rounded-md bg-foreground text-background font-bold gap-1.5"
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
                    <Label className="label-mono text-muted-foreground">
                      Elements to Replicate / Adapt
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {availableElements.map((el) => {
                        const active = selectedElements.includes(el.id);
                        return (
                          <button
                            key={el.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleElement(el.id)}
                            className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
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
                      <Label htmlFor="bedah-hook-text" className="label-mono text-muted-foreground">
                        Hook Analysis
                      </Label>
                      <Input
                        id="bedah-hook-text"
                        value={hookText}
                        onChange={(e) => setHookText(e.target.value)}
                        placeholder="Hook text..."
                        className="text-xs font-mono h-9 rounded-md"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bedah-hook-type" className="label-mono text-muted-foreground">
                        Hook Classification
                      </Label>
                      <SelectField
                        id="bedah-hook-type"
                        value={hookTypeId}
                        onValueChange={setHookTypeId}
                        ariaLabel="Hook Classification"
                        options={[
                          { value: "", label: "-- Choose hook type --" },
                          ...masterData.hookTypes.map((ht) => ({ value: ht.id, label: ht.name })),
                        ]}
                      />
                    </div>
                  </div>

                  {/* Visual Breakdown */}
                  <div className="space-y-1.5">
                    <Label htmlFor="bedah-visual-notes" className="label-mono text-muted-foreground">
                      Visual &amp; Pacing Breakdown
                    </Label>
                    <Textarea
                      id="bedah-visual-notes"
                      value={visualNotes}
                      onChange={(e) => setVisualNotes(e.target.value)}
                      placeholder="Scene 1: Hook with face zoom. Scene 2: Screen recording b-roll. Scene 3: Strong takeaway..."
                      rows={5}
                      className="text-xs font-mono leading-relaxed rounded-md"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label htmlFor="bedah-notes" className="label-mono text-muted-foreground">
                      Adaptation Synthesis / Spin Idea
                    </Label>
                    <Textarea
                      id="bedah-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="How to adapt this for our niche: Change the context from X to Y..."
                      rows={4}
                      className="text-xs font-mono leading-relaxed rounded-md"
                    />
                  </div>

                  {/* Interactive Adaptation Ideas -> 1-Click Turn into Content */}
                  {aiIdeas.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <Label className="label-mono text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-warning" />
                        <span>Adaptation Ideas (Turn into Original Content)</span>
                      </Label>
                      <div className="space-y-2">
                        {aiIdeas.map((idea, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-border bg-secondary/30 flex flex-wrap items-center justify-between gap-3"
                          >
                            <p className="text-xs font-mono text-foreground leading-relaxed flex-1 min-w-0">
                              {idea}
                            </p>
                            {reference.contentId ? (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-[11px] font-mono rounded-md gap-1 shrink-0"
                              >
                                <Link href={`/contents/${reference.contentId}`}>
                                  <ExternalLink className="size-3" />
                                  <span>Linked to Draft</span>
                                </Link>
                              </Button>
                            ) : (
                              <Button
                                asChild
                                size="sm"
                                className="h-8 px-2.5 text-[11px] font-mono rounded-md bg-foreground text-background font-bold gap-1 shrink-0"
                              >
                                <Link href={`/contents/new?refId=${reference.id}&idea=${encodeURIComponent(idea)}`}>
                                  <Plus className="size-3" />
                                  <span>Turn into Content</span>
                                </Link>
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveAll}
                    disabled={isPending}
                    className="text-xs font-mono h-9 px-4 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5"
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
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="label-mono text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-success" />
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
                    className="p-3 rounded-md border border-border/80 bg-secondary/20 hover:bg-secondary/50 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground truncate">
                        <span className="uppercase font-semibold text-foreground">
                          {sim.platformName}
                        </span>
                        {sim.handle && <span>@{sim.handle}</span>}
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-success shrink-0">
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

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Reference Permanently?"
        description="This permanently deletes the reference and its captured breakdown. You can archive it instead if you may need it later."
        confirmLabel="Delete Permanently"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={isPending}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        title="Leave with unsaved changes?"
        description="You have unsaved edits on this reference. Leaving now will discard them."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={() => {
          setLeaveDialogOpen(false);
          router.push("/references");
        }}
      />
    </div>
  );
}
