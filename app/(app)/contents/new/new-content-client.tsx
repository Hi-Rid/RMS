"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Sparkles, Plus, ExternalLink, Link as LinkIcon } from "lucide-react";
import { createContent } from "@/lib/actions/contents";
import { toast } from "sonner";
import type { MasterData, ReferenceListItem } from "@/lib/queries/references";

interface NewContentClientProps {
  masterData: MasterData;
  sourceReference: ReferenceListItem | null;
}

export function NewContentClient({
  masterData,
  sourceReference,
}: NewContentClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(
    sourceReference?.hookText
      ? `Adapt: ${sourceReference.hookText.slice(0, 50)}...`
      : ""
  );
  const [formatId, setFormatId] = useState(sourceReference?.format?.id || "");
  const [selectedPillars, setSelectedPillars] = useState<string[]>(
    sourceReference?.pillars.map((p) => p.id) || []
  );
  const [hookText, setHookText] = useState(sourceReference?.hookText || "");
  const [hookTypeId, setHookTypeId] = useState(sourceReference?.hookType?.id || "");
  const [notes, setNotes] = useState(sourceReference?.notes || "");
  const [plannedFor, setPlannedFor] = useState("");
  const [workUrl, setWorkUrl] = useState("");

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

    startTransition(async () => {
      const res = await createContent({
        title,
        formatId: formatId || null,
        pillarIds: selectedPillars,
        refIds: sourceReference ? [sourceReference.id] : [],
        hookText: hookText || undefined,
        hookTypeId: hookTypeId || null,
        notes: notes || undefined,
        workUrl: workUrl || null,
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
    <div className="w-full max-w-3xl py-8 px-4 sm:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-4">
        <Link
          href={sourceReference ? `/references/${sourceReference.id}` : "/contents"}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back</span>
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-foreground">
          {sourceReference ? "Create Content from Reference" : "New Content Piece"}
        </h1>
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {sourceReference
            ? `Adapting inspiration from ${sourceReference.platform.name}`
            : "Original concept without external reference"}
        </p>
      </div>

      {/* Linked Reference Preview if present */}
      {sourceReference && (
        <div className="bg-secondary/40 border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <LinkIcon className="size-3.5" />
              <span>Primary Reference Attached</span>
            </span>
            <a
              href={sourceReference.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <span>View Original</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
          <p className="text-xs font-mono text-foreground">
            {sourceReference.hookText || sourceReference.summary || sourceReference.url}
          </p>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Content Working Title *
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 3 Tools I Use to 10x Content Output"
            className="text-sm font-mono h-10 font-medium"
            required
          />
        </div>

        {/* Pillars Selection */}
        <div className="space-y-2">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Content Pillars
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

        {/* Hook statement */}
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Opening Hook Statement
          </Label>
          <Input
            value={hookText}
            onChange={(e) => setHookText(e.target.value)}
            placeholder="First 3 seconds line or opening title..."
            className="text-xs font-mono h-9"
          />
        </div>

        {/* Script / Outline / Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Script / Production Outline
          </Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key points, dialogue, visual cues, shot checklist..."
            rows={5}
            className="text-xs font-mono"
          />
        </div>

        {/* Planned Date & Drive / Work URL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Planned Shoot / Post Date
            </Label>
            <Input
              type="date"
              value={plannedFor}
              onChange={(e) => setPlannedFor(e.target.value)}
              className="text-xs font-mono h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Work Asset / Drive URL (Optional)
            </Label>
            <Input
              type="url"
              value={workUrl}
              onChange={(e) => setWorkUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="text-xs font-mono h-9"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          <Link href="/contents">
            <Button variant="outline" size="sm" type="button" className="text-xs font-mono h-9">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isPending}
            className="text-xs font-mono h-9 bg-foreground text-background font-bold gap-1.5 px-4"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            <span>Create Content & Open Studio</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
