"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Save,
  Loader2,
  Star,
  CheckCheck,
} from "lucide-react";
import { saveSnapshotMetrics, skipSnapshot } from "@/lib/actions/snapshots";
import { toast } from "sonner";
import type { SnapshotItem } from "@/lib/queries/snapshots";

interface EvaluateClientProps {
  initialItems: SnapshotItem[];
  counts: { due: number; upcoming: number; done: number };
  activeTab: "due" | "upcoming" | "done";
}

export function EvaluateClient({
  initialItems,
  counts,
  activeTab,
}: EvaluateClientProps) {
  const router = useRouter();

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Header */}
      <div className="border-b border-border/80 pb-6 space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
            <BarChart3 className="size-6 text-foreground" />
            <span>Performance Evaluation</span>
          </h1>
          {counts.due > 0 && (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-500/30">
              {counts.due} due
            </span>
          )}
        </div>
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Track 24h, 7d, and 30d performance checkpoints to evaluate retention & reach
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-1">
        <Link
          href="/evaluate?filter=due"
          className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all select-none flex items-center gap-2 ${
            activeTab === "due"
              ? "bg-foreground text-background font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <span>Due Checkpoints</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-foreground">
            {counts.due}
          </span>
        </Link>

        <Link
          href="/evaluate?filter=upcoming"
          className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all select-none flex items-center gap-2 ${
            activeTab === "upcoming"
              ? "bg-foreground text-background font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <span>Upcoming</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-foreground">
            {counts.upcoming}
          </span>
        </Link>

        <Link
          href="/evaluate?filter=done"
          className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all select-none flex items-center gap-2 ${
            activeTab === "done"
              ? "bg-foreground text-background font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <span>Completed</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-foreground">
            {counts.done}
          </span>
        </Link>
      </div>

      {/* Snapshot Cards List */}
      {initialItems.length === 0 ? (
        <div className="py-20 text-center rounded-lg border border-dashed border-border bg-card/40 space-y-3">
          <CheckCheck className="size-8 mx-auto text-muted-foreground/60" />
          <div className="text-sm font-semibold text-foreground font-display">
            No snapshots in this view
          </div>
          <p className="text-xs font-mono text-muted-foreground max-w-sm mx-auto">
            {activeTab === "due"
              ? "All active post checkpoints are up to date! Check Upcoming for scheduled checkpoints."
              : "No checkpoints recorded under this status."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {initialItems.map((snap) => (
            <SnapshotRowCard key={snap.id} snapshot={snap} isDue={activeTab === "due"} />
          ))}
        </div>
      )}
    </div>
  );
}

function SnapshotRowCard({
  snapshot,
  isDue,
}: {
  snapshot: SnapshotItem;
  isDue: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const [views, setViews] = useState<string>(
    snapshot.views !== null ? String(snapshot.views) : ""
  );
  const [likes, setLikes] = useState<string>(
    snapshot.likes !== null ? String(snapshot.likes) : ""
  );
  const [comments, setComments] = useState<string>(
    snapshot.comments !== null ? String(snapshot.comments) : ""
  );
  const [saves, setSaves] = useState<string>(
    snapshot.saves !== null ? String(snapshot.saves) : ""
  );
  const [shares, setShares] = useState<string>(
    snapshot.shares !== null ? String(snapshot.shares) : ""
  );
  const [retentionPct, setRetentionPct] = useState<string>(
    snapshot.retentionPct !== null ? String(snapshot.retentionPct) : ""
  );
  const [reach, setReach] = useState<string>(
    snapshot.reach !== null ? String(snapshot.reach) : ""
  );
  const [avgWatchSeconds, setAvgWatchSeconds] = useState<string>(
    snapshot.avgWatchSeconds !== null ? String(snapshot.avgWatchSeconds) : ""
  );
  const [followerDelta, setFollowerDelta] = useState<string>(
    snapshot.followerDelta !== null ? String(snapshot.followerDelta) : ""
  );
  const [profileVisits, setProfileVisits] = useState<string>(
    snapshot.profileVisits !== null ? String(snapshot.profileVisits) : ""
  );
  const [showMoreMetrics, setShowMoreMetrics] = useState<boolean>(
    Boolean(
      snapshot.reach !== null ||
        snapshot.avgWatchSeconds !== null ||
        snapshot.followerDelta !== null ||
        snapshot.profileVisits !== null
    )
  );
  const [rating, setRating] = useState<number | null>(snapshot.rating);
  const [notes, setNotes] = useState<string>(snapshot.notes || "");

  const parseIntOrNull = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveSnapshotMetrics({
        id: snapshot.id,
        views: parseIntOrNull(views),
        likes: parseIntOrNull(likes),
        comments: parseIntOrNull(comments),
        saves: parseIntOrNull(saves),
        shares: parseIntOrNull(shares),
        reach: parseIntOrNull(reach),
        followerDelta: parseIntOrNull(followerDelta),
        profileVisits: parseIntOrNull(profileVisits),
        avgWatchSeconds: avgWatchSeconds.trim() ? avgWatchSeconds.trim() : null,
        retentionPct: retentionPct.trim() ? retentionPct.trim() : null,
        rating: rating,
        notes: notes || undefined,
      });

      if (res.ok) {
        toast.success("Snapshot metrics recorded! Status updated to Evaluating.");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleSkip = () => {
    startTransition(async () => {
      const res = await skipSnapshot({ id: snapshot.id });
      if (res.ok) {
        toast.success("Snapshot skipped");
      } else {
        toast.error(res.error.message);
      }
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      {/* Top Header of the Checkpoint Card */}
      <div className="flex items-start justify-between gap-4 flex-wrap border-b border-border/60 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-foreground text-background">
              {snapshot.checkpoint.toUpperCase()} CHECKPOINT
            </span>
            <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
              {snapshot.post.platform.name}
            </span>
            <StatusBadge status={snapshot.status} size="sm" />
          </div>

          <Link
            href={`/contents/${snapshot.content.id}`}
            className="text-sm font-black font-display text-foreground hover:underline"
          >
            {snapshot.content.title}
          </Link>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            <span>Due: {new Date(snapshot.dueAt).toLocaleDateString()}</span>
          </span>

          {snapshot.post.url && (
            <a
              href={snapshot.post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground flex items-center gap-1"
            >
              <span>Post</span>
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>

      {/* Metrics Form */}
      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs font-mono">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total Views
            </Label>
            <Input
              type="number"
              min={0}
              value={views}
              onChange={(e) => setViews(e.target.value)}
              placeholder="0"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Likes
            </Label>
            <Input
              type="number"
              min={0}
              value={likes}
              onChange={(e) => setLikes(e.target.value)}
              placeholder="0"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Comments
            </Label>
            <Input
              type="number"
              min={0}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="0"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Saves
            </Label>
            <Input
              type="number"
              min={0}
              value={saves}
              onChange={(e) => setSaves(e.target.value)}
              placeholder="0"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Shares
            </Label>
            <Input
              type="number"
              min={0}
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="0"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Retention %
            </Label>
            <Input
              type="text"
              value={retentionPct}
              onChange={(e) => setRetentionPct(e.target.value)}
              placeholder="42.5"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Quality Rating (1–5)
            </Label>
            <div className="flex items-center gap-1 h-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`p-0.5 transition-colors ${
                    rating && star <= rating
                      ? "text-amber-500"
                      : "text-muted-foreground/40 hover:text-foreground"
                  }`}
                >
                  <Star className={`size-3.5 ${rating && star <= rating ? "fill-current" : ""}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Toggle for Secondary Metrics */}
        <div>
          <button
            type="button"
            onClick={() => setShowMoreMetrics((prev) => !prev)}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            {showMoreMetrics
              ? "− Hide extra metrics (Reach, Watch Time, Follower Δ, Visits)"
              : "+ More metrics (Reach, Watch Time, Follower Δ, Visits)"}
          </button>

          {showMoreMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Reach
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={reach}
                  onChange={(e) => setReach(e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Avg Watch (s)
                </Label>
                <Input
                  type="text"
                  value={avgWatchSeconds}
                  onChange={(e) => setAvgWatchSeconds(e.target.value)}
                  placeholder="14.2"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Follower Delta (+/-)
                </Label>
                <Input
                  type="number"
                  value={followerDelta}
                  onChange={(e) => setFollowerDelta(e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Profile Visits
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={profileVisits}
                  onChange={(e) => setProfileVisits(e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/40">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Checkpoint notes (audience feedback, drop-off point...)"
            className="h-8 text-xs font-mono flex-1 mr-2"
          />

          <div className="flex items-center gap-2 shrink-0">
            {snapshot.status === "pending" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleSkip}
                className="h-8 text-xs font-mono text-muted-foreground hover:text-foreground"
              >
                <XCircle className="size-3 mr-1" />
                <span>Skip</span>
              </Button>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="h-8 text-xs font-mono bg-foreground text-background font-bold gap-1"
            >
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              <span>Save Metrics</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
