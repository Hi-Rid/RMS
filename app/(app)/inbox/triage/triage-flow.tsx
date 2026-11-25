"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReferencePreview } from "@/components/app/reference-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  XCircle,
  Archive,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  setReferenceStatus,
  skipReference,
  archiveReference,
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

export function TriageFlow({ initialItems, masterData }: TriageFlowProps) {
  const router = useRouter();
  const [items, setItems] = useState<ReferenceListItem[]>(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isAiLoading, setIsAiLoading] = useState(false);

  const currentItem = items[currentIndex] || null;
  const [selectedPillars, setSelectedPillars] = useState<string[]>([]);
  const [formatId, setFormatId] = useState<string>("");
  const [hookTypeId, setHookTypeId] = useState<string>("");
  const [hookText, setHookText] = useState<string>("");
  const [visualNotes, setVisualNotes] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (currentItem) {
      setSelectedPillars(currentItem.pillars.map((p) => p.id));
      setFormatId(currentItem.format?.id || "");
      setHookTypeId(currentItem.hookType?.id || "");
      setHookText(currentItem.hookText || "");
      setVisualNotes(currentItem.visualNotes || "");
      setNotes(currentItem.notes || "");
      setTags(currentItem.tags || []);
    }
  }, [currentItem]);

  const togglePillar = (id: string) => {
    setSelectedPillars((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const advance = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setItems([]);
    }
  };

  const handleAiBedah = async () => {
    if (!currentItem || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const res = await aiBedahReference({
        text: hookText || currentItem.summary || currentItem.url,
        platform: currentItem.platform.name,
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
      const matchedHook = matchHookTypeId(res.data.hookType, masterData.hookTypes);
      if (matchedHook) setHookTypeId(matchedHook);
      if (res.data.suggestedTags?.length) {
        setTags(res.data.suggestedTags);
      }
      toast.success("AI Bedah selesai! Fields sudah terisi.");
    } catch {
      toast.error("Failed to run AI Bedah");
    } finally {
      setIsAiLoading(false);
    }
  };

  const persistCurrentCapture = async () => {
    if (!currentItem) return;
    await saveCapture({
      id: currentItem.id,
      pillarIds: selectedPillars,
      formatId: formatId || null,
      hookTypeId: hookTypeId || null,
      hookText: hookText || undefined,
      visualNotes: visualNotes || undefined,
      notes: notes || undefined,
      tags,
    });
  };

  const handleSelect = () => {
    if (!currentItem || isPending) return;
    startTransition(async () => {
      await persistCurrentCapture();
      const res = await setReferenceStatus({ id: currentItem.id, status: "selected" });
      if (res.ok) {
        toast.success("Reference selected");
        advance();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleSkip = () => {
    if (!currentItem || isPending) return;
    startTransition(async () => {
      const res = await skipReference({ id: currentItem.id });
      if (res.ok) {
        toast.success("Reference skipped");
        advance();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleArchive = () => {
    if (!currentItem || isPending) return;
    startTransition(async () => {
      const res = await archiveReference({ id: currentItem.id });
      if (res.ok) {
        toast.success("Reference archived");
        advance();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag && ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) {
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
      } else if (e.key === "Escape") {
        e.preventDefault();
        router.push("/inbox");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

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
          <Link href="/inbox">
            <Button variant="outline" size="sm" className="text-xs font-mono h-8">
              Back to Inbox
            </Button>
          </Link>
          <Link href="/references">
            <Button size="sm" className="text-xs font-mono h-8 bg-foreground text-background font-bold">
              View References
            </Button>
          </Link>
          <Link href="/contents/new">
            <Button size="sm" variant="outline" className="text-xs font-mono h-8 border-foreground font-bold">
              New Content
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / items.length) * 100);

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-8 space-y-6">
      {/* Top Header & Progress */}
      <div className="flex items-center justify-between border-b border-border/80 pb-4">
        <Link
          href="/inbox"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Exit Triage (Esc)</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-muted-foreground">
            {currentIndex + 1} of {items.length}
          </span>
          <div className="w-28 h-1.5 bg-secondary rounded-full overflow-hidden border border-border/60">
            <div
              className="h-full bg-foreground transition-all duration-300"
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
              <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-foreground text-background">
                {currentItem.platform.name}
              </span>
              {currentItem.format && (
                <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
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

          <div className="max-w-[300px] mx-auto">
            <ReferencePreview
              url={currentItem.url}
              platform={currentItem.platform.slug}
              format={currentItem.format?.name}
              coverUrl={currentItem.coverUrl}
              hookText={hookText || currentItem.hookText}
              summary={currentItem.summary}
              handle={currentItem.sourceAccount?.handle}
              className="aspect-[9/16] rounded-lg"
            />
          </div>

          <div className="p-2.5 rounded bg-secondary/50 border border-border/80 font-mono text-[11px] text-muted-foreground break-all">
            {currentItem.urlOriginal || currentItem.url}
          </div>
        </div>

        {/* Right: AI Bedah + Metadata Capture + Quick Actions */}
        <div className="lg:col-span-7 bg-card border border-border rounded-lg p-6 space-y-5">
          {/* AI Auto-Bedah Quick Trigger */}
          <div className="p-3.5 rounded-lg border border-border bg-secondary/40 flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-0.5">
              <div className="font-bold text-foreground font-display flex items-center gap-1.5 text-xs">
                <Sparkles className="size-3.5 text-amber-500 fill-amber-500" />
                <span>AI Auto-Bedah (Gemini)</span>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">
                Extract opening hook, hook archetype, and adaptation ideas before triaging
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={isAiLoading}
              onClick={handleAiBedah}
              className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5 shrink-0"
            >
              {isAiLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>Run Auto-Bedah</span>
            </Button>
          </div>

          {/* Pillars Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Assign Pillars
            </label>
            <div className="flex flex-wrap gap-1.5">
              {masterData.pillars.map((pillar) => {
                const active = selectedPillars.includes(pillar.id);
                return (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => togglePillar(pillar.id)}
                    className={`px-2.5 py-1 text-xs font-mono rounded border transition-all select-none ${
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
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Format
              </label>
              <select
                value={formatId}
                onChange={(e) => setFormatId(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:border-foreground"
              >
                <option value="">-- Auto / Choose format --</option>
                {masterData.formats.map((fmt) => (
                  <option key={fmt.id} value={fmt.id}>
                    {fmt.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Hook Archetype
              </label>
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

          {/* Hook Text */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Hook / Core Angle
            </label>
            <Input
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              placeholder="Opening 3-second hook..."
              className="text-xs font-mono h-9"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Takeaways &amp; Adaptation Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Takeaway or angle to replicate..."
              rows={4}
              className="text-xs font-mono"
            />
          </div>

          {/* Action Buttons Row */}
          <div className="pt-4 border-t border-border/80 grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              size="lg"
              disabled={isPending}
              onClick={handleSkip}
              className="text-xs font-mono h-11 border-border/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
            >
              <XCircle className="size-4" />
              <span className="font-bold">[2] Skip</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              disabled={isPending}
              onClick={handleArchive}
              className="text-xs font-mono h-11 border-border/80 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
            >
              <Archive className="size-4" />
              <span className="font-bold">[3] Archive</span>
            </Button>

            <Button
              size="lg"
              disabled={isPending}
              onClick={handleSelect}
              className="text-xs font-mono h-11 bg-foreground text-background hover:bg-foreground/90 font-black flex items-center justify-center gap-2"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>[1] Select</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
