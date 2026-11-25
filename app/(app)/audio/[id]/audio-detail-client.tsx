"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Music, ArrowLeft, Trash2, Save, ExternalLink, Bookmark, Layers, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      createdAt: string;
      lastPostedAt: string | null;
    }[];
    canDelete: boolean;
  };
}

export function AudioDetailClient({ data }: AudioDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(data.audio.title);
  const [artist, setArtist] = useState(data.audio.artist);
  const [isOriginal, setIsOriginal] = useState(data.audio.isOriginal);
  const [notes, setNotes] = useState(data.audio.notes || "");

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
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleDelete = () => {
    if (!data.canDelete) {
      toast.error("Cannot delete audio that is currently attached to references or contents.");
      return;
    }

    startTransition(async () => {
      const res = await deleteAudio(data.audio.id);
      if (res.ok) {
        toast.success("Audio track deleted");
        router.push("/audio");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Back & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/audio"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Audio Library</span>
        </Link>

        {/* Delete Action (enabled only if unused) */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.canDelete || isPending}
              title={
                data.canDelete
                  ? "Delete this unused track"
                  : "Cannot delete: Audio is in use by references or contents"
              }
              className="h-8 text-xs font-mono uppercase tracking-wider text-destructive hover:bg-destructive/10 border-border"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              <span>Delete Track</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Audio Track?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove &ldquo;{data.audio.title}&rdquo; from your audio library.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                Delete Track
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Main Edit Card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
              Audio Track Details
            </span>
            <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-foreground">
              {data.audio.title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {data.usingContents.length === 0 ? (
              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-primary text-primary-foreground">
                Unused Track
              </span>
            ) : (
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border font-bold">
                In {data.usingContents.length} {data.usingContents.length === 1 ? "Content" : "Contents"}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider">Track Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider">Artist</Label>
              <Input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="detailIsOriginal"
              checked={isOriginal}
              onChange={(e) => setIsOriginal(e.target.checked)}
              className="size-4 rounded border-border"
            />
            <Label htmlFor="detailIsOriginal" className="text-xs font-mono cursor-pointer">
              Original Sound / User Voiceover
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider">Notes & Editing Cues</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Drop at 0:08, great for fast cuts"
              className="text-xs font-mono"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="text-xs font-mono uppercase tracking-wider font-bold h-9 px-4 gap-1.5"
            >
              <Save className="size-3.5" />
              <span>{isPending ? "Saving..." : "Save Changes"}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Two Linked Lists: References & Contents (PRD §12.12) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* References List */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="size-4 text-foreground" />
              <h2 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                References Using This Audio ({data.usingRefs.length})
              </h2>
            </div>
          </div>

          {data.usingRefs.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground py-6 text-center">
              No references are currently attached to this audio track.
            </p>
          ) : (
            <div className="space-y-2">
              {data.usingRefs.map((ref) => (
                <Link
                  key={ref.id}
                  href={`/references/${ref.id}`}
                  className="block p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 border border-border/60 transition-colors group"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground mb-1">
                    <span className="font-bold text-foreground">{ref.platformName}</span>
                    <span className="capitalize">{ref.status}</span>
                  </div>
                  <p className="text-xs font-mono text-foreground line-clamp-2 group-hover:underline">
                    {ref.hookText || ref.summary || ref.url}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Contents List */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-foreground" />
              <h2 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                Contents Produced With This Audio ({data.usingContents.length})
              </h2>
            </div>
          </div>

          {data.usingContents.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground py-6 text-center">
              This track has not yet been used in any produced content drafts.
            </p>
          ) : (
            <div className="space-y-2">
              {data.usingContents.map((cnt) => (
                <Link
                  key={cnt.id}
                  href={`/contents/${cnt.id}`}
                  className="block p-3 rounded-lg bg-secondary/30 hover:bg-secondary/60 border border-border/60 transition-colors group"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground mb-1">
                    <span className="capitalize font-bold text-foreground">{cnt.status}</span>
                    <span>
                      {cnt.lastPostedAt
                        ? `Posted ${new Date(cnt.lastPostedAt).toLocaleDateString()}`
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
    </div>
  );
}
