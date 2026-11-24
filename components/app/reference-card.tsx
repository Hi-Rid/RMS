"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import { CaptureSheet } from "@/components/app/capture-sheet";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Edit3,
  CheckCircle2,
  XCircle,
  Archive,
  ArrowRight,
  Music,
  User,
  Plus,
} from "lucide-react";
import {
  setReferenceStatus,
  skipReference,
  unskipReference,
  archiveReference,
} from "@/lib/actions/references";
import { toast } from "sonner";
import type { ReferenceListItem, MasterData } from "@/lib/queries/references";

interface ReferenceCardProps {
  reference: ReferenceListItem;
  masterData?: MasterData;
  showTriageActions?: boolean;
}

function getPlatformStyle(slug: string) {
  switch (slug.toLowerCase()) {
    case "instagram":
      return "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/30";
    case "tiktok":
      return "bg-cyan-500/10 text-cyan-800 dark:text-cyan-400 border-cyan-500/30";
    case "youtube":
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";
    case "threads":
      return "bg-foreground text-background border-foreground";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export function ReferenceCard({
  reference,
  masterData,
  showTriageActions = true,
}: ReferenceCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);

  const handleSelect = () => {
    startTransition(async () => {
      const res = await setReferenceStatus({ id: reference.id, status: "selected" });
      if (res.ok) {
        toast.success("Reference selected");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleSkip = () => {
    startTransition(async () => {
      const res = await skipReference({ id: reference.id });
      if (res.ok) {
        toast.success("Reference skipped");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleUnskip = () => {
    startTransition(async () => {
      const res = await unskipReference({ id: reference.id, to: "inbox" });
      if (res.ok) {
        toast.success("Reference moved to inbox");
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
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const isInbox = reference.status === "inbox";
  const isSelected = reference.status === "selected";
  const isSkipped = reference.status === "skipped";

  return (
    <>
      <div className="bg-card border border-border rounded-md p-4 space-y-3 transition-colors hover:border-foreground/30 flex flex-col justify-between">
        <div className="space-y-2.5">
          {/* Top Row: Platform, Format & Status */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[11px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${getPlatformStyle(reference.platform.slug)}`}>
                {reference.platform.name}
              </span>
              {reference.format && (
                <span className="text-[11px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/60">
                  {reference.format.name}
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
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>

          {/* Hook or Title or URL */}
          <Link
            href={`/references/${reference.id}`}
            className="block group"
          >
            <p className="text-xs font-mono font-medium text-foreground line-clamp-2 leading-relaxed group-hover:underline underline-offset-2">
              {reference.hookText || reference.summary || reference.url}
            </p>
          </Link>

          {/* Metadata: Creator handle & Audio */}
          {(reference.sourceAccount || reference.audio) && (
            <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
              {reference.sourceAccount && (
                <span className="flex items-center gap-1">
                  <User className="size-3 text-muted-foreground/70" />
                  <span>@{reference.sourceAccount.handle}</span>
                </span>
              )}
              {reference.audio && (
                <span className="flex items-center gap-1 truncate max-w-[180px]">
                  <Music className="size-3 text-muted-foreground/70 shrink-0" />
                  <span className="truncate">{reference.audio.title}</span>
                </span>
              )}
            </div>
          )}

          {/* Pillars & Tags */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {reference.pillars.map((pillar) => (
              <span
                key={pillar.id}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/80 text-foreground border border-border/80 font-medium"
              >
                {pillar.name}
              </span>
            ))}
            {reference.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="text-[10px] font-mono text-muted-foreground/80"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Action Bar */}
        <div className="pt-2.5 border-t border-border/60 flex items-center justify-between gap-1.5 flex-wrap">
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
