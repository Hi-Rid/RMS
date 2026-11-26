"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/app/status-badge";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  ExternalLink,
  Clock,
  XCircle,
  Save,
  Loader2,
  Star,
  CheckCheck,
  RotateCcw,
  X,
} from "lucide-react";
import { saveSnapshotMetrics, skipSnapshot, restoreSnapshot } from "@/lib/actions/snapshots";
import { toast } from "sonner";
import type { SnapshotItem } from "@/lib/queries/snapshots";

interface EvaluateClientProps {
  initialItems: SnapshotItem[];
  counts: { due: number; upcoming: number; done: number; skipped: number };
  activeTab: "due" | "upcoming" | "done" | "skipped";
}

function formatWibDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }) + " WIB";
  } catch {
    return iso;
  }
}

function getRelativeDueLabel(iso: string): string | null {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 24) return `in ${Math.max(1, hours)}h`;
  return `in ${Math.round(hours / 24)}d`;
}

export function EvaluateClient({
  initialItems,
  counts,
  activeTab,
}: EvaluateClientProps) {
  const totalAll = counts.due + counts.upcoming + counts.done + counts.skipped;

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      <PageHeader
        title="Performance Evaluation"
        subtitle="Track 24h, 7d, and 30d performance checkpoints to evaluate retention & reach"
        icon={<BarChart3 className="size-6 text-foreground" />}
        badge={
          counts.due > 0 ? (
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-brand/10 text-brand border border-brand/25 tabular-nums">
              {counts.due} due
            </span>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-2">
        {(
          [
            { key: "due", label: "Due Checkpoints", count: counts.due },
            { key: "upcoming", label: "Upcoming", count: counts.upcoming },
            { key: "done", label: "Completed", count: counts.done },
            { key: "skipped", label: "Skipped", count: counts.skipped },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/evaluate?filter=${tab.key}`}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-colors select-none inline-flex items-center gap-2 ${
                isActive
                  ? "bg-foreground text-background font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-sm tabular-nums ${
                  isActive
                    ? "bg-background text-foreground font-bold"
                    : "bg-secondary text-foreground"
                }`}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Snapshot Cards List */}
      {initialItems.length === 0 ? (
        totalAll === 0 ? (
          <EmptyState
            icon={<BarChart3 className="size-5" />}
            title="No evaluation checkpoints yet"
            description="Checkpoints at 24h, 7d, and 30d are generated automatically when you record a Published Post inside Contents Studio."
            primaryAction={{
              label: "Open Contents Studio",
              href: "/contents",
            }}
            secondaryAction={{
              label: "Open Content Planner",
              href: "/planner",
            }}
          />
        ) : (
          <EmptyState
            icon={<CheckCheck className="size-5" />}
            title="No snapshots in this tab"
            description={
              activeTab === "due"
                ? "All active due checkpoints are up to date! Check Upcoming for future checkpoints."
                : activeTab === "upcoming"
                  ? "No future checkpoints scheduled yet. Record another post in Studio to start tracking."
                  : activeTab === "skipped"
                    ? "No skipped checkpoints."
                    : "No completed evaluations recorded yet."
            }
            primaryAction={
              activeTab === "due" && counts.upcoming > 0
                ? { label: "View Upcoming", href: "/evaluate?filter=upcoming" }
                : activeTab !== "done" && counts.done > 0
                  ? { label: "View Completed", href: "/evaluate?filter=done" }
                  : { label: "Open Contents Studio", href: "/contents" }
            }
          />
        )
      ) : (
        <div className="space-y-4">
          {initialItems.map((snap) => (
            <SnapshotRowCard key={snap.id} snapshot={snap} activeTab={activeTab} />
          ))}
        </div>
      )}
    </div>
  );
}

function SnapshotRowCard({
  snapshot,
  activeTab,
}: {
  snapshot: SnapshotItem;
  activeTab: "due" | "upcoming" | "done" | "skipped";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [earlyEditExpanded, setEarlyEditExpanded] = useState(activeTab !== "upcoming");

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

  const parseStrictInt = (raw: string, label: string): { ok: true; value: number | null } | { ok: false; error: string } => {
    const cleaned = raw.trim().replace(/[,\s]/g, "");
    if (!cleaned) return { ok: true, value: null };
    if (!/^-?\d+$/.test(cleaned)) {
      return { ok: false, error: `${label} must be a whole number.` };
    }
    return { ok: true, value: Number.parseInt(cleaned, 10) };
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const pViews = parseStrictInt(views, "Total Views");
    if (!pViews.ok) return toast.error(pViews.error);
    const pLikes = parseStrictInt(likes, "Likes");
    if (!pLikes.ok) return toast.error(pLikes.error);
    const pComments = parseStrictInt(comments, "Comments");
    if (!pComments.ok) return toast.error(pComments.error);
    const pSaves = parseStrictInt(saves, "Saves");
    if (!pSaves.ok) return toast.error(pSaves.error);
    const pShares = parseStrictInt(shares, "Shares");
    if (!pShares.ok) return toast.error(pShares.error);
    const pReach = parseStrictInt(reach, "Reach");
    if (!pReach.ok) return toast.error(pReach.error);
    const pFollower = parseStrictInt(followerDelta, "Follower Delta");
    if (!pFollower.ok) return toast.error(pFollower.error);
    const pVisits = parseStrictInt(profileVisits, "Profile Visits");
    if (!pVisits.ok) return toast.error(pVisits.error);

    const cleanRet = retentionPct.trim().replace(/,/g, ".");
    if (cleanRet) {
      const rNum = Number(cleanRet);
      if (!Number.isFinite(rNum) || rNum < 0 || rNum > 100) {
        return toast.error("Retention % must be a number between 0 and 100.");
      }
    }

    const cleanWatch = avgWatchSeconds.trim().replace(/,/g, ".");
    if (cleanWatch) {
      const wNum = Number(cleanWatch);
      if (!Number.isFinite(wNum) || wNum < 0) {
        return toast.error("Avg Watch (s) must be a non-negative number.");
      }
    }

    startTransition(async () => {
      const res = await saveSnapshotMetrics({
        id: snapshot.id,
        views: pViews.value,
        likes: pLikes.value,
        comments: pComments.value,
        saves: pSaves.value,
        shares: pShares.value,
        reach: pReach.value,
        followerDelta: pFollower.value,
        profileVisits: pVisits.value,
        avgWatchSeconds: cleanWatch || null,
        retentionPct: cleanRet || null,
        rating,
        notes: notes.trim() || undefined,
      });

      if (res.ok) {
        toast.success(
          activeTab === "done"
            ? "Snapshot metrics updated!"
            : "Snapshot saved! Check Insights or Completed tab."
        );
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleConfirmSkip = async () => {
    const res = await skipSnapshot({ id: snapshot.id });
    if (res.ok) {
      toast.success("Snapshot moved to Skipped tab");
      setSkipDialogOpen(false);
      router.refresh();
    } else {
      toast.error(res.error.message);
    }
  };

  const handleRestore = () => {
    startTransition(async () => {
      const res = await restoreSnapshot({ id: snapshot.id });
      if (res.ok) {
        toast.success("Snapshot restored to active schedule");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const relDue = activeTab === "upcoming" ? getRelativeDueLabel(snapshot.dueAt) : null;
  const uid = snapshot.id;

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      {/* Top Header of the Checkpoint Card */}
      <div className="flex items-start justify-between gap-4 flex-wrap border-b border-border/60 pb-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-foreground text-background">
              {snapshot.checkpoint.toUpperCase()} CHECKPOINT
            </span>
            <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border">
              {snapshot.post.platform.name}
            </span>
            <StatusBadge status={snapshot.status} size="sm" />
            {relDue && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border">
                Due {relDue}
              </span>
            )}
          </div>

          <Link
            href={`/contents/${snapshot.content.id}`}
            className="text-sm font-black font-display text-foreground hover:underline inline-block"
          >
            {snapshot.content.title}
          </Link>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            <span>Due: {formatWibDateTime(snapshot.dueAt)}</span>
          </span>

          {snapshot.post.url && (
            <a
              href={snapshot.post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground inline-flex items-center gap-1 underline underline-offset-2"
            >
              <span>Post</span>
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>

      {activeTab === "skipped" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs font-mono text-muted-foreground">
            This checkpoint was skipped. Restore it to Due / Upcoming to record metrics.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleRestore}
            className="h-8 text-xs font-mono rounded-md gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>Restore Checkpoint</span>
          </Button>
        </div>
      ) : activeTab === "upcoming" && !earlyEditExpanded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs font-mono text-muted-foreground">
            Scheduled for future review ({formatWibDateTime(snapshot.dueAt)}).
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEarlyEditExpanded(true)}
              className="h-8 text-xs font-mono rounded-md"
            >
              Record Metrics Early
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSkipDialogOpen(true)}
              className="h-8 text-xs font-mono text-muted-foreground hover:text-foreground rounded-md"
            >
              Skip
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs font-mono">
            <div className="space-y-1">
              <Label htmlFor={`views-${uid}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total Views
              </Label>
              <Input
                id={`views-${uid}`}
                type="number"
                min={0}
                value={views}
                onChange={(e) => setViews(e.target.value)}
                placeholder="0"
                className="h-8 text-xs font-mono rounded-md"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`likes-${uid}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Likes
              </Label>
              <Input
                id={`likes-${uid}`}
                type="number"
                min={0}
                value={likes}
                onChange={(e) => setLikes(e.target.value)}
                placeholder="0"
                className="h-8 text-xs font-mono rounded-md"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`comments-${uid}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Comments
              </Label>
              <Input
                id={`comments-${uid}`}
                type="number"
                min={0}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="0"
                className="h-8 text-xs font-mono rounded-md"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`saves-${uid}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Saves
              </Label>
              <Input
                id={`saves-${uid}`}
                type="number"
                min={0}
                value={saves}
                onChange={(e) => setSaves(e.target.value)}
                placeholder="0"
                className="h-8 text-xs font-mono rounded-md"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`shares-${uid}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Shares
              </Label>
              <Input
                id={`shares-${uid}`}
                type="number"
                min={0}
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="0"
                className="h-8 text-xs font-mono rounded-md"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor={`retention-${uid}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Retention %
              </Label>
              <Input
                id={`retention-${uid}`}
                type="text"
                inputMode="decimal"
                value={retentionPct}
                onChange={(e) => setRetentionPct(e.target.value)}
                placeholder="42.5"
                className="h-8 text-xs font-mono rounded-md"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Rating (1–5)
                </span>
                {rating !== null && (
                  <button
                    type="button"
                    aria-label="Clear rating"
                    onClick={() => setRating(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-0.5 h-8" role="group" aria-label="Checkpoint quality rating">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = Boolean(rating && star <= rating);
                  return (
                    <button
                      key={star}
                      type="button"
                      aria-label={`Rate ${star} out of 5`}
                      aria-pressed={rating === star}
                      onClick={() => setRating(star)}
                      className={`p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                        active
                          ? "text-warning"
                          : "text-muted-foreground/40 hover:text-foreground"
                      }`}
                    >
                      <Star className={`size-3.5 ${active ? "fill-current" : ""}`} />
                    </button>
                  );
                })}
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
                  <Label htmlFor={`reach-${uid}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Reach
                  </Label>
                  <Input
                    id={`reach-${uid}`}
                    type="number"
                    min={0}
                    value={reach}
                    onChange={(e) => setReach(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono rounded-md"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`watch-${uid}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Avg Watch (s)
                  </Label>
                  <Input
                    id={`watch-${uid}`}
                    type="text"
                    inputMode="decimal"
                    value={avgWatchSeconds}
                    onChange={(e) => setAvgWatchSeconds(e.target.value)}
                    placeholder="14.2"
                    className="h-8 text-xs font-mono rounded-md"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`follower-${uid}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Follower Delta (+/-)
                  </Label>
                  <Input
                    id={`follower-${uid}`}
                    type="number"
                    value={followerDelta}
                    onChange={(e) => setFollowerDelta(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono rounded-md"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`visits-${uid}`} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Profile Visits
                  </Label>
                  <Input
                    id={`visits-${uid}`}
                    type="number"
                    min={0}
                    value={profileVisits}
                    onChange={(e) => setProfileVisits(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono rounded-md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/40">
            <Input
              aria-label="Checkpoint notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Checkpoint notes (audience feedback, drop-off point...)"
              className="h-8 text-xs font-mono flex-1 min-w-[200px] rounded-md"
            />

            <div className="flex items-center gap-2 shrink-0">
              {snapshot.status === "pending" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setSkipDialogOpen(true)}
                  className="h-8 text-xs font-mono text-muted-foreground hover:text-foreground rounded-md"
                >
                  <XCircle className="size-3 mr-1" />
                  <span>Skip</span>
                </Button>
              )}

              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="h-8 text-xs font-mono bg-foreground text-background hover:bg-foreground/90 font-bold gap-1 rounded-md"
              >
                {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                <span>Save Metrics</span>
              </Button>
            </div>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={skipDialogOpen}
        onOpenChange={setSkipDialogOpen}
        title="Skip this checkpoint?"
        description={`Skip the ${snapshot.checkpoint.toUpperCase()} evaluation for "${snapshot.content.title}"? You can restore it anytime from the Skipped tab.`}
        confirmLabel="Skip Checkpoint"
        cancelLabel="Keep"
        variant="default"
        isPending={isPending}
        onConfirm={handleConfirmSkip}
      />
    </div>
  );
}
