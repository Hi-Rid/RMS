"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, ArrowLeft, Trash2, Save, Bookmark, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateSourceNotes, deleteSource } from "@/lib/actions/sources";
import { toast } from "sonner";

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
      savedAt: string;
    }[];
    canDelete: boolean;
  };
}

export function SourceDetailClient({ data }: SourceDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(data.source.notes || "");

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSourceNotes({
        id: data.source.id,
        notes,
      });

      if (res.ok) {
        toast.success("Creator notes updated");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleDelete = () => {
    if (!data.canDelete) {
      toast.error("Cannot delete source with active references.");
      return;
    }

    const confirm = window.confirm(`Delete creator @${data.source.handle}?`);
    if (!confirm) return;

    startTransition(async () => {
      const res = await deleteSource(data.source.id);
      if (res.ok) {
        toast.success("Source account deleted");
        router.push("/sources");
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
          href="/sources"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Sources</span>
        </Link>

        {/* Delete Action (PRD §12.13: enabled only if 0 refs) */}
        <Button
          variant="outline"
          size="sm"
          disabled={!data.canDelete || isPending}
          onClick={handleDelete}
          title={
            data.canDelete
              ? "Delete this empty creator profile"
              : "Cannot delete: Creator has active references"
          }
          className="h-8 text-xs font-mono uppercase tracking-wider text-destructive hover:bg-destructive/10 border-border"
        >
          <Trash2 className="size-3.5 mr-1.5" />
          <span>Delete Source</span>
        </Button>
      </div>

      {/* Main Source Card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-foreground text-background">
                {data.source.platform.name}
              </span>
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                {data.sourceRefs.length} References
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-foreground">
              @{data.source.handle}
            </h1>
          </div>
        </div>

        {/* Notes Editor */}
        <form onSubmit={handleSaveNotes} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Creator Notes & Content Angles
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What makes this creator's hooks or visuals stand out? (e.g. fast visual pacing, strong contrarian viewpoints)"
              rows={3}
              className="text-xs font-mono resize-none"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="text-xs font-mono uppercase tracking-wider font-bold h-8 px-4 gap-1.5"
            >
              <Save className="size-3.5" />
              <span>{isPending ? "Saving..." : "Save Notes"}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* References From This Account */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <Bookmark className="size-4 text-foreground" />
          <h2 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
            References From @{data.source.handle} ({data.sourceRefs.length})
          </h2>
        </div>

        {data.sourceRefs.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-border bg-card/40 text-xs font-mono text-muted-foreground">
            No saved references found for this creator.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {data.sourceRefs.map((ref) => (
              <Link
                key={ref.id}
                href={`/references/${ref.id}`}
                className="block p-4 rounded-xl bg-card hover:border-foreground/40 border border-border transition-all group"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground mb-2">
                  <span className="capitalize font-bold text-foreground">{ref.status}</span>
                  <span>{new Date(ref.savedAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs font-mono text-foreground line-clamp-3 leading-relaxed group-hover:underline">
                  {ref.hookText || ref.summary || ref.url}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
