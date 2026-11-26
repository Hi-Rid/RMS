"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  Save,
  Bookmark,
  ExternalLink,
  ArrowRight,
  FolderKanban,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { updateSource, deleteSource } from "@/lib/actions/sources";
import { buildCreatorProfileUrl } from "@/lib/domain/normalize";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SourceDetailClientProps {
  data: {
    source: {
      id: string;
      handle: string;
      notes: string | null;
      platform: {
        id: string;
        name: string;
        slug: string;
      };
      createdAt: string;
    };
    sourceRefs: {
      id: string;
      url: string;
      summary: string | null;
      hookText: string | null;
      status: string;
      contentId: string | null;
      savedAt: string;
      formatName: string | null;
      hookTypeName: string | null;
    }[];
    archivedRefsCount?: number;
    stats: {
      totalRefs: number;
      inboxCount: number;
      selectedCount: number;
      producedCount: number;
      conversionPct: number;
      avgScore: number | null;
    };
    canDelete: boolean;
  };
}

const SHORT_DATE_UTC = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function SourceDetailClient({ data }: SourceDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [handle, setHandle] = useState(data.source.handle);
  const [notes, setNotes] = useState(data.source.notes || "");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const isDirty =
    handle.trim().replace(/^@+/, "").toLowerCase() !== data.source.handle ||
    notes !== (data.source.notes || "");
  useUnsavedChanges(isDirty);

  const profileUrl = buildCreatorProfileUrl(
    data.source.platform.slug,
    data.source.handle
  );

  const filteredRefs = React.useMemo(() => {
    if (statusFilter === "all") return data.sourceRefs;
    if (statusFilter === "produced") {
      return data.sourceRefs.filter(
        (r) =>
          r.status === "production" ||
          r.status === "posted" ||
          r.status === "evaluating"
      );
    }
    return data.sourceRefs.filter((r) => r.status === statusFilter);
  }, [data.sourceRefs, statusFilter]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) {
      toast.error("Creator handle is required");
      return;
    }
    startTransition(async () => {
      const res = await updateSource({
        id: data.source.id,
        handle: handle.trim(),
        notes,
      });

      if (res.ok) {
        toast.success("Creator details updated");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleDelete = async () => {
    if (!data.canDelete) {
      toast.error("Cannot delete source with attached references.");
      return;
    }

    const res = await deleteSource(data.source.id);
    if (res.ok) {
      toast.success("Source account deleted");
      setDeleteDialogOpen(false);
      router.push("/sources");
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (isDirty) setLeaveDialogOpen(true);
            else router.push("/sources");
          }}
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Sources</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs font-mono rounded-md gap-1.5"
          >
            <Link
              href={`/references?q=${encodeURIComponent(`@${data.source.handle}`)}`}
            >
              <Bookmark className="size-3.5 text-muted-foreground" />
              <span>Filter in Library</span>
            </Link>
          </Button>

          {profileUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-mono rounded-md gap-1.5"
            >
              <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                <span>Open Profile</span>
                <ExternalLink className="size-3" />
              </a>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!data.canDelete || isPending}
            onClick={() => setDeleteDialogOpen(true)}
            title={
              data.canDelete
                ? "Delete source account"
                : `Linked to ${data.sourceRefs.length} active${
                    data.archivedRefsCount ? ` + ${data.archivedRefsCount} archived` : ""
                  } reference(s)`
            }
            className="h-8 text-xs font-mono uppercase tracking-wider text-destructive hover:bg-destructive/10 border-destructive/30 rounded-md"
          >
            <Trash2 className="size-3.5 mr-1.5" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* Main Creator Profile Card */}
      <div className="bg-card border border-border rounded-lg p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap border-b border-border/70 pb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-foreground text-background">
                {data.source.platform.name}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border tabular-nums">
                {data.stats.totalRefs} Active Refs
              </span>
              {data.stats.avgScore !== null && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-warning/10 text-warning border border-warning/30 inline-flex items-center gap-1 tabular-nums">
                  <Star className="size-3 fill-current" />
                  <span>Avg {data.stats.avgScore.toFixed(1)}/5</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-foreground break-words">
              @{handle.trim().replace(/^@+/, "") || data.source.handle}
            </h1>
            {!data.canDelete && (
              <p className="text-[11px] font-mono text-muted-foreground">
                Protected from deletion — linked to {data.sourceRefs.length} active
                {data.archivedRefsCount
                  ? ` + ${data.archivedRefsCount} archived`
                  : ""}{" "}
                reference(s).
              </p>
            )}
          </div>

          {/* Creator Funnel Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
            <div className="rounded-md border border-border/80 bg-secondary/40 px-3 py-2">
              <div className="label-mono text-muted-foreground">Inbox</div>
              <div className="text-base font-black font-display tabular-nums mt-0.5">
                {data.stats.inboxCount}
              </div>
            </div>
            <div className="rounded-md border border-border/80 bg-secondary/40 px-3 py-2">
              <div className="label-mono text-muted-foreground">Selected</div>
              <div className="text-base font-black font-display tabular-nums mt-0.5">
                {data.stats.selectedCount}
              </div>
            </div>
            <div className="rounded-md border border-border/80 bg-secondary/40 px-3 py-2">
              <div className="label-mono text-muted-foreground">Produced</div>
              <div className="text-base font-black font-display tabular-nums mt-0.5">
                {data.stats.producedCount}
              </div>
            </div>
            <div className="rounded-md border border-border/80 bg-secondary/40 px-3 py-2">
              <div className="label-mono text-muted-foreground">Hit Rate</div>
              <div className="text-base font-black font-display tabular-nums mt-0.5">
                {data.stats.conversionPct}%
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="source-handle"
                className="label-mono text-muted-foreground"
              >
                Creator Handle *
              </Label>
              <Input
                id="source-handle"
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="text-xs font-mono h-9 rounded-md"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label
                htmlFor="source-notes"
                className="label-mono text-muted-foreground"
              >
                Creator Notes &amp; Content Angles
              </Label>
              <Textarea
                id="source-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What makes this creator's hooks or visuals stand out? (e.g. fast pacing, strong contrarian openings)"
                rows={3}
                className="text-xs font-mono rounded-md"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
            <span className="text-[11px] font-mono text-muted-foreground">
              {isDirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !isDirty}
              className="text-xs font-mono uppercase tracking-wider font-bold h-9 px-4 rounded-md gap-1.5 bg-foreground text-background hover:bg-foreground/90"
            >
              <Save className="size-3.5" />
              <span>{isPending ? "Saving..." : "Save Changes"}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* References From This Account */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <Bookmark className="size-4 text-foreground" />
            <h2 className="label-mono font-bold text-foreground">
              References From @{data.source.handle} ({filteredRefs.length})
            </h2>
          </div>

          {data.sourceRefs.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {[
                { value: "all", label: "All", count: data.stats.totalRefs },
                { value: "inbox", label: "Inbox", count: data.stats.inboxCount },
                {
                  value: "selected",
                  label: "Selected",
                  count: data.stats.selectedCount,
                },
                {
                  value: "produced",
                  label: "Produced",
                  count: data.stats.producedCount,
                },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors inline-flex items-center gap-1",
                    statusFilter === tab.value
                      ? "bg-foreground text-background font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  <span>{tab.label}</span>
                  <span className="text-[10px] opacity-80 tabular-nums">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredRefs.length === 0 ? (
          <div className="py-12 text-center rounded-lg border border-dashed border-border bg-card/40 text-xs font-mono text-muted-foreground">
            {data.sourceRefs.length === 0
              ? "No active saved references found for this creator."
              : "No references in this status stage."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRefs.map((ref) => (
              <article
                key={ref.id}
                className="p-4 rounded-lg bg-card border border-border hover:border-foreground/40 transition-colors flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusBadge status={ref.status} size="sm" />
                      {ref.formatName && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-secondary border border-border/80 text-foreground font-semibold">
                          {ref.formatName}
                        </span>
                      )}
                    </div>
                    <span className="tabular-nums shrink-0">
                      {SHORT_DATE_UTC.format(new Date(ref.savedAt))}
                    </span>
                  </div>

                  <Link
                    href={`/references/${ref.id}`}
                    className="block text-xs font-mono text-foreground line-clamp-3 leading-relaxed hover:text-brand hover:underline"
                  >
                    {ref.hookText || ref.summary || ref.url}
                  </Link>

                  {ref.hookTypeName && (
                    <div className="text-[10px] font-mono text-muted-foreground">
                      Hook: {ref.hookTypeName}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 text-[11px] font-mono">
                  {ref.contentId ? (
                    <Link
                      href={`/contents/${ref.contentId}`}
                      className="inline-flex items-center gap-1 text-foreground hover:text-brand font-semibold"
                    >
                      <FolderKanban className="size-3" />
                      <span>Open Studio</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/contents/new?refId=${ref.id}`}
                      className="inline-flex items-center gap-1 text-brand hover:underline font-semibold"
                    >
                      <span>Create Draft</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  )}

                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open original post"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <span>Source</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Source Account?"
        description={`This will permanently remove creator @${data.source.handle} (${data.source.platform.name}).`}
        confirmLabel="Delete Source"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={isPending}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        title="Discard unsaved changes?"
        description="You edited creator details that haven't been saved yet."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={() => {
          setLeaveDialogOpen(false);
          router.push("/sources");
        }}
      />
    </div>
  );
}
