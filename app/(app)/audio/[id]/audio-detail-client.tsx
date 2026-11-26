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
  Layers,
  FileVideo,
  Star,
  ExternalLink,
  Disc,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { updateAudio, deleteAudio } from "@/lib/actions/audio";
import { toast } from "sonner";

interface AudioDetailClientProps {
  data: {
    audio: {
      id: string;
      title: string;
      artist: string;
      isOriginal: boolean;
      notes: string | null;
      createdAt: string;
    };
    usingRefs: {
      id: string;
      url: string;
      summary: string | null;
      hookText: string | null;
      status: string;
      savedAt: string;
      platformName: string;
    }[];
    usingContents: {
      id: string;
      title: string;
      status: string;
      finalRating?: number | null;
      createdAt: string;
      lastPostedAt: string | null;
    }[];
    archivedUsageCount?: number;
    canDelete: boolean;
  };
}

const SHORT_DATE_UTC = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function AudioDetailClient({ data }: AudioDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(data.audio.title);
  const [artist, setArtist] = useState(data.audio.artist);
  const [isOriginal, setIsOriginal] = useState(data.audio.isOriginal);
  const [notes, setNotes] = useState(data.audio.notes || "");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const isDirty = React.useMemo(
    () =>
      title !== data.audio.title ||
      artist !== data.audio.artist ||
      isOriginal !== data.audio.isOriginal ||
      notes !== (data.audio.notes || ""),
    [title, artist, isOriginal, notes, data.audio]
  );

  useUnsavedChanges(isDirty);

  const avgRating = React.useMemo(() => {
    const ratings = data.usingContents
      .map((c) => c.finalRating)
      .filter((r): r is number => typeof r === "number");
    if (ratings.length === 0) return null;
    const sum = ratings.reduce((acc, val) => acc + val, 0);
    return Number((sum / ratings.length).toFixed(1));
  }, [data.usingContents]);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Audio title is required");
      return;
    }

    startTransition(async () => {
      const res = await updateAudio({
        id: data.audio.id,
        title: title.trim(),
        artist: artist.trim(),
        isOriginal,
        notes: notes.trim() || undefined,
      });

      if (res.ok) {
        toast.success("Audio track updated");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleDelete = async () => {
    if (!data.canDelete) {
      toast.error("Cannot delete audio that is attached to references or contents.");
      return;
    }

    const res = await deleteAudio(data.audio.id);
    if (res.ok) {
      toast.success("Audio track deleted");
      setDeleteDialogOpen(false);
      router.push("/audio");
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
            else router.push("/audio");
          }}
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Audio Library</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            className="h-8 px-3 text-xs font-mono font-semibold bg-brand text-primary-foreground hover:bg-brand/90 rounded-md gap-1.5"
          >
            <Link href={`/contents/new?audioId=${data.audio.id}`}>
              <FileVideo className="size-3.5" />
              <span>Use in New Content</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!data.canDelete || isPending}
            onClick={() => setDeleteDialogOpen(true)}
            title={
              data.canDelete
                ? "Delete audio track"
                : `In use by ${data.usingRefs.length + data.usingContents.length} active${
                    data.archivedUsageCount ? ` + ${data.archivedUsageCount} archived` : ""
                  } item(s)`
            }
            className="h-8 text-xs font-mono uppercase tracking-wider text-destructive hover:bg-destructive/10 border-destructive/30 rounded-md"
          >
            <Trash2 className="size-3.5 mr-1.5" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {/* Main Edit Card + KPI Bar */}
      <div className="bg-card border border-border rounded-lg p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="label-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border inline-flex items-center gap-1">
                {isOriginal ? <Mic className="size-3" /> : <Disc className="size-3" />}
                <span>{isOriginal ? "Original / Voiceover" : "Audio Track"}</span>
              </span>
              {data.usingContents.length === 0 ? (
                <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md bg-brand/10 text-brand border border-brand/30">
                  Unused Track
                </span>
              ) : (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border font-bold">
                  Used in {data.usingContents.length}{" "}
                  {data.usingContents.length === 1 ? "Content" : "Contents"}
                </span>
              )}
              {avgRating !== null && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-warning/10 text-warning border border-warning/30 inline-flex items-center gap-1 tabular-nums">
                  <Star className="size-2.5 fill-current" />
                  <span>Avg {avgRating}/5</span>
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-foreground break-words">
              {title || data.audio.title}
            </h1>
            {!data.canDelete && (
              <p className="text-[11px] font-mono text-muted-foreground">
                Protected from deletion — attached to {data.usingRefs.length} reference(s),{" "}
                {data.usingContents.length} active content(s)
                {data.archivedUsageCount
                  ? `, and ${data.archivedUsageCount} archived item(s)`
                  : ""}
                .
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="audio-edit-title" className="label-mono text-muted-foreground">
                Track Title *
              </Label>
              <Input
                id="audio-edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs font-mono h-9 rounded-md"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audio-edit-artist" className="label-mono text-muted-foreground">
                Artist / Creator
              </Label>
              <Input
                id="audio-edit-artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="text-xs font-mono h-9 rounded-md"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <Checkbox
              id="detailIsOriginal"
              checked={isOriginal}
              onCheckedChange={(checked) => setIsOriginal(Boolean(checked))}
            />
            <Label
              htmlFor="detailIsOriginal"
              className="text-xs font-mono cursor-pointer select-none"
            >
              Original Sound / User Voiceover
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audio-edit-notes" className="label-mono text-muted-foreground">
              Notes &amp; Editing Cues
            </Label>
            <Textarea
              id="audio-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Drop at 0:08, great for fast cuts"
              className="text-xs font-mono rounded-md"
            />
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

      {/* Two Linked Lists: References & Contents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="size-4 text-foreground" />
              <h2 className="label-mono font-bold text-foreground">
                References Using This Audio ({data.usingRefs.length})
              </h2>
            </div>
          </div>

          {data.usingRefs.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground py-6 text-center">
              No active references are attached to this audio track.
            </p>
          ) : (
            <div className="space-y-2">
              {data.usingRefs.map((ref) => (
                <div
                  key={ref.id}
                  className="p-3 rounded-md bg-secondary/30 hover:bg-secondary/50 border border-border/60 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
                    <span className="font-bold text-foreground">{ref.platformName}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={ref.status} size="sm" />
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open original post"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                  <Link
                    href={`/references/${ref.id}`}
                    className="block text-xs font-mono text-foreground line-clamp-2 hover:text-brand hover:underline"
                  >
                    {ref.hookText || ref.summary || ref.url}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-foreground" />
              <h2 className="label-mono font-bold text-foreground">
                Contents Produced With This Audio ({data.usingContents.length})
              </h2>
            </div>
            <Link
              href={`/contents/new?audioId=${data.audio.id}`}
              className="text-[11px] font-mono text-brand hover:underline font-semibold"
            >
              + Create Content
            </Link>
          </div>

          {data.usingContents.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground py-6 text-center">
              This track has not yet been used in any active content drafts.
            </p>
          ) : (
            <div className="space-y-2">
              {data.usingContents.map((cnt) => (
                <Link
                  key={cnt.id}
                  href={`/contents/${cnt.id}`}
                  className="block p-3 rounded-md bg-secondary/30 hover:bg-secondary/60 border border-border/60 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground mb-1">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={cnt.status} size="sm" />
                      {typeof cnt.finalRating === "number" && (
                        <span className="text-[10px] font-bold text-warning inline-flex items-center gap-0.5 tabular-nums">
                          <Star className="size-2.5 fill-current" />
                          <span>{cnt.finalRating}/5</span>
                        </span>
                      )}
                    </div>
                    <span className="tabular-nums">
                      {cnt.lastPostedAt
                        ? `Posted ${SHORT_DATE_UTC.format(new Date(cnt.lastPostedAt))}`
                        : "Draft"}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-foreground font-semibold group-hover:underline">
                    {cnt.title}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Audio Track?"
        description={`This will permanently remove "${data.audio.title}" from your audio library.`}
        confirmLabel="Delete Track"
        cancelLabel="Cancel"
        variant="destructive"
        isPending={isPending}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        title="Discard unsaved changes?"
        description="You edited audio details that haven't been saved yet."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={() => {
          setLeaveDialogOpen(false);
          router.push("/audio");
        }}
      />
    </div>
  );
}
