"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/app/status-badge";
import { CaptureSheet } from "@/components/app/capture-sheet";
import { ReferencePreview } from "@/components/app/reference-preview";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Edit3,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Music,
  User,
  Plus,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import {
  setReferenceStatus,
  skipReference,
  unskipReference,
  restoreReference,
} from "@/lib/actions/references";
import { toast } from "sonner";
import type { ReferenceListItem, MasterData } from "@/lib/queries/references";

interface ReferenceCardProps {
  reference: ReferenceListItem;
  masterData?: MasterData;
  showTriageActions?: boolean;
}

export function ReferenceCard({
  reference,
  masterData,
  showTriageActions = true,
}: ReferenceCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const res = await setReferenceStatus({ id: reference.id, status: "selected" });
      if (res.ok) {
        toast.success("Reference selected");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const res = await skipReference({ id: reference.id });
      if (res.ok) {
        toast.success("Reference skipped");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleUnskip = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const res = await unskipReference({ id: reference.id, to: "inbox" });
      if (res.ok) {
        toast.success("Reference moved to inbox");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleRestore = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const res = await restoreReference({ id: reference.id });
      if (res.ok) {
        toast.success("Reference restored");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const isArchived = Boolean(reference.archivedAt);
  const isInbox = reference.status === "inbox";
  const isSelected = reference.status === "selected";
  const isSkipped = reference.status === "skipped";
  const isUnused = !reference.contentId && reference.status !== "skipped";
  const needsDetails = reference.pillars.length === 0;

  // PRD §12.0: Label mono PILLAR · FORMAT (first pillar + +N)
  const pillarText =
    reference.pillars.length > 0
      ? `${reference.pillars[0].name.toUpperCase()}${
          reference.pillars.length > 1 ? ` +${reference.pillars.length - 1}` : ""
        }`
      : null;
  const formatText = reference.format ? reference.format.name.toUpperCase() : null;
  const headerMonoLabel = [pillarText, formatText].filter(Boolean).join(" · ");

  // PRD §12.0: Title = first sentence of summary; fallback to hookText or Untitled · <host>/<path>
  const fallbackTitle = (() => {
    if (reference.summary) {
      const firstSentence = reference.summary.split(/[.!?]\s+/)[0];
      return firstSentence.length > 80 ? firstSentence.slice(0, 80) + "..." : firstSentence;
    }
    if (reference.hookText) return reference.hookText;
    try {
      const u = new URL(reference.url);
      return `Untitled · ${u.hostname}${u.pathname.slice(0, 16)}`;
    } catch {
      return "Untitled Reference";
    }
  })();

  return (
    <>
      <div
        onClick={() => router.push(`/references/${reference.id}`)}
        className="group/card bg-card border border-border rounded-lg overflow-hidden transition-all hover:border-foreground/40 cursor-pointer flex flex-col justify-between"
      >
        <div className="space-y-3">
          {/* PRD §12.0: Area Pratinjau (Sampul / Visual Preview) */}
          <ReferencePreview
            url={reference.url}
            platform={reference.platform.slug}
            format={reference.format?.name}
            coverUrl={reference.coverUrl}
            hookText={reference.hookText}
            summary={reference.summary}
            handle={reference.sourceAccount?.handle}
          />

          <div className="p-3.5 pt-0 space-y-2.5">
            {/* Top Row: PILLAR · FORMAT mono label & Status Badge */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {headerMonoLabel ? (
                  <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-muted-foreground">
                    {headerMonoLabel}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    <span>Needs details</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <StatusBadge status={reference.status} size="sm" />
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open original URL"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>

            {/* Title / Hook Preview */}
            <h3 className="text-xs font-mono font-semibold text-foreground line-clamp-2 leading-relaxed group-hover/card:underline underline-offset-2">
              {fallbackTitle}
            </h3>

            {/* Description Row: @handle · Status · ♪ Audio */}
            <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground flex-wrap">
              {reference.sourceAccount && (
                <span className="flex items-center gap-1 text-foreground/80 font-medium">
                  <User className="size-3 text-muted-foreground/70" />
                  <span>@{reference.sourceAccount.handle}</span>
                </span>
              )}
              {reference.sourceAccount && reference.audio && <span>&middot;</span>}
              {reference.audio && (
                <span className="flex items-center gap-1 truncate max-w-[170px]" title={reference.audio.title}>
                  <Music className="size-3 text-muted-foreground/70 shrink-0" />
                  <span className="truncate">{reference.audio.title}</span>
                </span>
              )}
            </div>

            {/* Chips Row: Unused, Pillars & Tags */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {isUnused && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-bold">
                  Unused
                </span>
              )}
              {needsDetails && !headerMonoLabel && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                  No Pillars
                </span>
              )}
              {reference.pillars.slice(0, 2).map((pillar) => (
                <span
                  key={pillar.id}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border/80 font-medium"
                >
                  {pillar.name}
                </span>
              ))}
              {reference.tags.slice(0, 2).map((tag, idx) => (
                <span key={idx} className="text-[10px] font-mono text-muted-foreground/80">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Action Bar at the Bottom */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="p-3.5 pt-2 border-t border-border/60 flex items-center justify-between gap-1.5 flex-wrap"
        >
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCaptureOpen(true)}
              className="h-7 px-2 text-[11px] font-mono gap-1"
            >
              <Edit3 className="size-3" />
              <span>Capture</span>
            </Button>

            <Link href={`/references/${reference.id}`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground"
              >
                <span>Detail</span>
                <ArrowRight className="size-3 ml-1" />
              </Button>
            </Link>
          </div>

          {showTriageActions && (
            <div className="flex items-center gap-1">
              {isArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={handleRestore}
                  className="h-7 px-2.5 text-[11px] font-mono gap-1"
                >
                  <RotateCcw className="size-3" />
                  <span>Restore</span>
                </Button>
              ) : (
                <>
                  {isInbox && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={handleSkip}
                        className="h-7 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground"
                      >
                        <XCircle className="size-3 mr-1" />
                        <span>Skip</span>
                      </Button>
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={handleSelect}
                        className="h-7 px-2.5 text-[11px] font-mono bg-foreground text-background hover:bg-foreground/90 font-bold"
                      >
                        <CheckCircle2 className="size-3 mr-1" />
                        <span>Select</span>
                      </Button>
                    </>
                  )}

                  {isSelected && (
                    <Link href={`/contents/new?refId=${reference.id}`}>
                      <Button
                        size="sm"
                        className="h-7 px-2.5 text-[11px] font-mono bg-foreground text-background hover:bg-foreground/90 font-bold"
                      >
                        <Plus className="size-3 mr-1" />
                        <span>Create Content</span>
                      </Button>
                    </Link>
                  )}

                  {isSkipped && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={handleUnskip}
                      className="h-7 px-2 text-[11px] font-mono"
                    >
                      <span>Unskip</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <CaptureSheet
        reference={reference}
        isOpen={isCaptureOpen}
        onOpenChange={setIsCaptureOpen}
        masterData={masterData}
      />
    </>
  );
}
