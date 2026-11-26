"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/app/status-badge";
import { CaptureSheet } from "@/components/app/capture-sheet";
import { ReferencePreview } from "@/components/app/reference-preview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Archive,
  Layers,
} from "lucide-react";
import {
  setReferenceStatus,
  skipReference,
  unskipReference,
  archiveReference,
  restoreReference,
} from "@/lib/actions/references";
import { toast } from "sonner";
import type { ReferenceListItem, MasterData } from "@/lib/queries/references";
import { cn } from "@/lib/utils";

interface ReferenceCardProps {
  reference: ReferenceListItem;
  masterData?: MasterData;
  showTriageActions?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function ReferenceCard({
  reference,
  masterData,
  showTriageActions = true,
  selectable = false,
  selected = false,
  onToggleSelect,
}: ReferenceCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const res = await setReferenceStatus({ id: reference.id, status: "selected" });
      if (res.ok) {
        toast.success("Reference selected", {
          action: {
            label: "Undo",
            onClick: async () => {
              const undoRes = await setReferenceStatus({ id: reference.id, status: "inbox" });
              if (undoRes.ok) {
                toast.info("Moved back to Inbox");
                router.refresh();
              } else {
                toast.error(undoRes.error.message);
              }
            },
          },
        });
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
        toast.success("Reference skipped", {
          action: {
            label: "Undo",
            onClick: async () => {
              const undoRes = await unskipReference({ id: reference.id, to: "inbox" });
              if (undoRes.ok) {
                toast.info("Restored to Inbox");
                router.refresh();
              } else {
                toast.error(undoRes.error.message);
              }
            },
          },
        });
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

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const res = await archiveReference({ id: reference.id });
      if (res.ok) {
        toast.success("Reference archived", {
          action: {
            label: "Undo",
            onClick: async () => {
              await restoreReference({ id: reference.id });
              router.refresh();
            },
          },
        });
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

  const pillarText =
    reference.pillars.length > 0
      ? `${reference.pillars[0].name.toUpperCase()}${
          reference.pillars.length > 1 ? ` +${reference.pillars.length - 1}` : ""
        }`
      : null;
  const formatText = reference.format ? reference.format.name.toUpperCase() : null;
  const headerMonoLabel = [pillarText, formatText].filter(Boolean).join(" · ");

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

  const detailHref = `/references/${reference.id}`;

  return (
    <>
      <article
        className={cn(
          "group/card relative bg-card border rounded-lg overflow-hidden transition-colors flex flex-col justify-between",
          selected
            ? "border-brand ring-1 ring-brand/40"
            : "border-border hover:border-foreground/40"
        )}
      >
        {/* Multi-select checkbox overlay */}
        {selectable && (
          <div className="absolute top-2 right-2 z-40">
            <label
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center size-7 rounded-md bg-card/95 border border-border cursor-pointer hover:border-foreground/50"
            >
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect?.(reference.id)}
                aria-label={`Select ${fallbackTitle}`}
              />
            </label>
          </div>
        )}

        <div className="space-y-2.5">
          {/* Preview (clickable area navigates to detail cleanly; action buttons sit as siblings to avoid nested links) */}
          <ReferencePreview
            url={reference.url}
            platform={reference.platform.slug}
            format={reference.format?.name}
            coverUrl={reference.coverUrl}
            hookText={reference.hookText}
            summary={reference.summary}
            handle={reference.sourceAccount?.handle}
            detailHref={detailHref}
            detailAriaLabel={`Open details for ${fallbackTitle}`}
            showExternalButton={!selectable}
            className="aspect-[4/5] rounded-none border-0 border-b"
          />

          <div className="px-3 pb-2 space-y-2">
            {/* Top Row: PILLAR · FORMAT or Needs details + Status */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                {headerMonoLabel && (
                  <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-muted-foreground truncate">
                    {headerMonoLabel}
                  </span>
                )}
                {needsDetails && (
                  <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-warning/10 text-warning border border-warning/30 inline-flex items-center gap-1">
                    <AlertCircle className="size-3 shrink-0" />
                    <span>Needs details</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <StatusBadge status={reference.status} size="sm" />
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open original post"
                  aria-label="Open original post in new tab"
                  className="size-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>

            {/* Title / Hook Preview */}
            <h3 className="text-xs font-mono font-semibold text-foreground leading-snug">
              <Link
                href={detailHref}
                className="line-clamp-2 hover:underline underline-offset-2 focus-visible:outline-none focus-visible:underline"
              >
                {fallbackTitle}
              </Link>
            </h3>

            {/* Description Row: @handle · Audio */}
            {(reference.sourceAccount || reference.audio) && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground flex-wrap">
                {reference.sourceAccount && (
                  <Link
                    href={`/sources/${reference.sourceAccount.id}`}
                    className="flex items-center gap-1 text-foreground/80 hover:text-foreground font-medium truncate max-w-[130px] hover:underline"
                  >
                    <User className="size-3 text-muted-foreground/70 shrink-0" />
                    <span className="truncate">@{reference.sourceAccount.handle}</span>
                  </Link>
                )}
                {reference.sourceAccount && reference.audio && <span>&middot;</span>}
                {reference.audio && (
                  <Link
                    href={`/audio/${reference.audio.id}`}
                    title={reference.audio.title}
                    className="flex items-center gap-1 truncate max-w-[135px] hover:text-foreground hover:underline"
                  >
                    <Music className="size-3 text-muted-foreground/70 shrink-0" />
                    <span className="truncate">{reference.audio.title}</span>
                  </Link>
                )}
              </div>
            )}

            {/* Chips Row: Unused, Pillars & Tags */}
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {isUnused && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground font-bold">
                  Unused
                </span>
              )}
              {reference.pillars.slice(0, 2).map((pillar) => (
                <span
                  key={pillar.id}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-secondary text-foreground border border-border/80 font-medium"
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
        <div className="px-3 py-2 border-t border-border/60 flex items-center justify-between gap-1 flex-wrap bg-card">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCaptureOpen(true)}
              className="h-8 px-2 text-[11px] font-mono rounded-md gap-1"
            >
              <Edit3 className="size-3" />
              <span>Capture</span>
            </Button>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 px-1.5 text-[11px] font-mono rounded-md text-muted-foreground hover:text-foreground"
            >
              <Link href={detailHref}>
                <span>Detail</span>
                <ArrowRight className="size-3 ml-0.5" />
              </Link>
            </Button>
          </div>

          {showTriageActions && (
            <div className="flex items-center gap-1">
              {isArchived ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={handleRestore}
                  className="h-8 px-2 text-[11px] font-mono rounded-md gap-1"
                >
                  <RotateCcw className="size-3" />
                  <span>Restore</span>
                </Button>
              ) : (
                <>
                  {isInbox && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={handleSkip}
                        title="Skip reference"
                        className="h-8 px-2 text-[11px] font-mono rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <XCircle className="size-3 mr-1" />
                        <span>Skip</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending}
                        onClick={handleSelect}
                        title="Select reference"
                        className="h-8 px-2 text-[11px] font-mono rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold"
                      >
                        <CheckCircle2 className="size-3 mr-1" />
                        <span>Select</span>
                      </Button>
                    </>
                  )}

                  {isSelected && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={handleArchive}
                        title="Archive reference"
                        aria-label="Archive reference"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-md"
                      >
                        <Archive className="size-3.5" />
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        title="Create Content"
                        className="h-8 px-2 text-[11px] font-mono rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold"
                      >
                        <Link href={`/contents/new?refId=${reference.id}`}>
                          <Plus className="size-3 mr-1" />
                          <span>Create</span>
                        </Link>
                      </Button>
                    </>
                  )}

                  {isSkipped && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={handleArchive}
                        title="Archive reference"
                        aria-label="Archive reference"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-md"
                      >
                        <Archive className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={handleUnskip}
                        className="h-8 px-2 text-[11px] font-mono rounded-md"
                      >
                        <span>Unskip</span>
                      </Button>
                    </>
                  )}

                  {reference.contentId && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-[11px] font-mono rounded-md gap-1"
                    >
                      <Link href={`/contents/${reference.contentId}`}>
                        <Layers className="size-3" />
                        <span>Studio</span>
                      </Link>
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </article>

      <CaptureSheet
        reference={reference}
        isOpen={isCaptureOpen}
        onOpenChange={setIsCaptureOpen}
        masterData={masterData}
      />
    </>
  );
}
