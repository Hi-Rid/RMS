"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { setContentSchedule } from "@/lib/actions/planner";
import { toast } from "sonner";
import { format, startOfWeek, addDays, addWeeks, isSameDay, parseISO } from "date-fns";
import type { PlannerContentItem } from "@/lib/queries/planner";

interface PlannerClientProps {
  weeklyTarget: number;
  postedThisWeek: number;
  scheduledContents: PlannerContentItem[];
  unscheduledContents: PlannerContentItem[];
}

export function PlannerClient({
  weeklyTarget,
  postedThisWeek,
  scheduledContents,
  unscheduledContents,
}: PlannerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [scheduled, setScheduled] = useState<PlannerContentItem[]>(scheduledContents);
  const [unscheduled, setUnscheduled] = useState<PlannerContentItem[]>(unscheduledContents);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDateInput, setScheduleDateInput] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Sync props when router.refresh() resolves
  React.useEffect(() => {
    setScheduled(scheduledContents);
    setUnscheduled(unscheduledContents);
  }, [scheduledContents, unscheduledContents]);

  // Calculate weekly target progress
  const progressPct = Math.min(100, Math.round((postedThisWeek / Math.max(1, weeklyTarget)) * 100));

  // Build selected week days (Monday to Sunday)
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekStart = addWeeks(currentWeekStart, weekOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const navigateWeek = (nextOffset: number) => {
    setWeekOffset(nextOffset);
    const nextWeekMonday = addWeeks(currentWeekStart, nextOffset);
    const targetDate = nextOffset === 0 ? today : nextWeekMonday;
    setSelectedDate(format(targetDate, "yyyy-MM-dd"));
  };

  const handleScheduleSubmit = (contentId: string) => {
    if (!scheduleDateInput) return;
    startTransition(async () => {
      const res = await setContentSchedule({
        contentId,
        dateStr: scheduleDateInput,
      });

      if (res.ok) {
        const draft = unscheduled.find((c) => c.id === contentId);
        if (draft) {
          setUnscheduled((prev) => prev.filter((c) => c.id !== contentId));
          setScheduled((prev) => [...prev, { ...draft, plannedFor: scheduleDateInput }]);
        } else {
          setScheduled((prev) =>
            prev.map((c) => (c.id === contentId ? { ...c, plannedFor: scheduleDateInput } : c))
          );
        }
        setSchedulingId(null);
        toast.success("Content scheduled");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleUnschedule = (contentId: string) => {
    startTransition(async () => {
      const res = await setContentSchedule({
        contentId,
        dateStr: null,
      });

      if (res.ok) {
        const target = scheduled.find((c) => c.id === contentId);
        if (target) {
          setScheduled((prev) => prev.filter((c) => c.id !== contentId));
          if (target.status === "production") {
            setUnscheduled((prev) => [{ ...target, plannedFor: null }, ...prev]);
          }
        }
        toast.success("Schedule cleared");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  const handleDropSchedule = (contentId: string, targetDateStr: string) => {
    setDragOverDate(null);
    setDraggingId(null);
    if (!contentId || !targetDateStr) return;

    const existingScheduled = scheduled.find((c) => c.id === contentId);
    if (existingScheduled?.plannedFor === targetDateStr) return;

    startTransition(async () => {
      const res = await setContentSchedule({
        contentId,
        dateStr: targetDateStr,
      });

      if (res.ok) {
        const draft = unscheduled.find((c) => c.id === contentId);
        if (draft) {
          setUnscheduled((prev) => prev.filter((c) => c.id !== contentId));
          setScheduled((prev) => [...prev, { ...draft, plannedFor: targetDateStr }]);
        } else {
          setScheduled((prev) =>
            prev.map((c) => (c.id === contentId ? { ...c, plannedFor: targetDateStr } : c))
          );
        }
        setSelectedDate(targetDateStr);
        toast.success(`Scheduled for ${targetDateStr}`);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  // Find contents for selected date
  const contentsOnSelectedDate = scheduled.filter((c) => c.plannedFor === selectedDate);

  return (
    <div className="space-y-6">
      {/* 1. Weekly Target Progress Card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
              Weekly Publishing Goal
            </span>
            <div className="text-sm font-black font-display text-foreground flex items-center gap-2">
              <span>{postedThisWeek} of {weeklyTarget} posted this week</span>
              <span className="text-xs font-mono text-muted-foreground font-normal">({progressPct}%)</span>
            </div>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md ${
              progressPct >= 100
                ? "bg-emerald-600 text-white"
                : "bg-secondary text-foreground"
            }`}
          >
            {progressPct >= 100 ? "Goal Reached!" : `${Math.max(0, weeklyTarget - postedThisWeek)} remaining`}
          </span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* 2. Main Planner Workspace: Week Timeline + Unscheduled Drafts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Week Schedule Timeline & Selected Day */}
        <div className="lg:col-span-2 space-y-5">
          {/* Week Strip (Monday - Sunday) with Navigation */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
                  {weekOffset === 0
                    ? "This Week"
                    : weekOffset === 1
                    ? "Next Week"
                    : weekOffset === -1
                    ? "Last Week"
                    : `Week of ${format(weekStart, "MMM d")}`}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek(weekOffset - 1)}
                  title="Previous week"
                  className="h-7 w-7 p-0 font-mono"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant={weekOffset === 0 ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => navigateWeek(0)}
                  className="h-7 px-2.5 text-[11px] font-mono"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek(weekOffset + 1)}
                  title="Next week"
                  className="h-7 w-7 p-0 font-mono"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
                <a
                  href="/api/planner/ics"
                  download="rms-planner.ics"
                  title="Export scheduled content calendar (.ics)"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px] font-mono gap-1 ml-1"
                  >
                    <Download className="size-3" />
                    <span>.ics</span>
                  </Button>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((day) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const isSelected = selectedDate === dayStr;
                const isCurrentDay = isSameDay(day, today);
                const isDragOver = dragOverDate === dayStr;
                const dayContents = scheduled.filter((c) => c.plannedFor === dayStr);

                return (
                  <button
                    key={dayStr}
                    type="button"
                    onClick={() => setSelectedDate(dayStr)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverDate !== dayStr) setDragOverDate(dayStr);
                    }}
                    onDragLeave={() => {
                      if (dragOverDate === dayStr) setDragOverDate(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedId = e.dataTransfer.getData("text/plain") || draggingId;
                      if (droppedId) {
                        handleDropSchedule(droppedId, dayStr);
                      } else {
                        setDragOverDate(null);
                      }
                    }}
                    className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1 select-none ${
                      isDragOver
                        ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/10 text-foreground"
                        : isSelected
                        ? "bg-foreground text-background border-foreground font-bold"
                        : isCurrentDay
                        ? "bg-secondary/80 border-foreground/40 text-foreground"
                        : "bg-card border-border hover:bg-secondary/40 text-foreground"
                    }`}
                  >
                    <span className="text-[10px] font-mono uppercase opacity-70">
                      {format(day, "EEE")}
                    </span>
                    <span className="text-sm font-black font-display">
                      {format(day, "d")}
                    </span>

                    {/* Content Count Indicator */}
                    {dayContents.length > 0 ? (
                      <span
                        className={`text-[10px] font-mono px-1.5 rounded-full leading-4 ${
                          isSelected
                            ? "bg-background text-foreground font-bold"
                            : "bg-foreground/10 text-foreground font-medium"
                        }`}
                      >
                        {dayContents.length}
                      </span>
                    ) : (
                      <span className="h-4" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Content Showcase */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-4 text-foreground" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                  Scheduled for {format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")} ({contentsOnSelectedDate.length})
                </h3>
              </div>
            </div>

            {contentsOnSelectedDate.length === 0 ? (
              <div className="py-10 text-center space-y-2 text-muted-foreground font-mono text-xs">
                <p>No content scheduled for this date.</p>
                <p className="text-[11px] opacity-70">
                  Select a production draft from the right panel to schedule it here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contentsOnSelectedDate.map((content) => (
                  <div
                    key={content.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(content.id);
                      e.dataTransfer.setData("text/plain", content.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverDate(null);
                    }}
                    className={`p-3.5 rounded-lg bg-secondary/30 border border-border/80 flex items-center justify-between gap-3 hover:border-foreground/30 transition-colors cursor-grab active:cursor-grabbing ${
                      draggingId === content.id ? "opacity-50" : ""
                    }`}
                  >
                    <GripVertical className="size-3.5 text-muted-foreground shrink-0" />
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-foreground text-background font-bold">
                          {content.status}
                        </span>
                        {content.formatName && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                            {content.formatName}
                          </span>
                        )}
                        {content.checklistTotal > 0 && (
                          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                            <CheckSquare className="size-3" />
                            <span>
                              {content.checklistDone}/{content.checklistTotal}
                            </span>
                          </span>
                        )}
                        {content.postedAt && (
                          <span className="text-[10px] font-mono text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            <span>Posted</span>
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/contents/${content.id}`}
                        className="text-xs font-mono font-bold text-foreground hover:underline block truncate"
                      >
                        {content.title}
                      </Link>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleUnschedule(content.id)}
                        className="h-7 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground"
                      >
                        Unschedule
                      </Button>
                      <Link href={`/contents/${content.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-[11px] font-mono uppercase tracking-wider"
                        >
                          Studio
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Unscheduled Production Drafts */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-foreground" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                Unscheduled Drafts ({unscheduled.length})
              </h3>
            </div>
          </div>

          <p className="text-[11px] font-mono text-muted-foreground">
            Drag any card onto a day cell or click Schedule below.
          </p>

          {unscheduled.length === 0 ? (
            <div className="py-10 text-center space-y-1 text-muted-foreground font-mono text-xs">
              <p>All production drafts are scheduled!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unscheduled.map((draft) => (
                <div
                  key={draft.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggingId(draft.id);
                    e.dataTransfer.setData("text/plain", draft.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverDate(null);
                  }}
                  className={`p-3 rounded-lg border border-border bg-secondary/20 space-y-2.5 cursor-grab active:cursor-grabbing transition-opacity ${
                    draggingId === draft.id ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span className="uppercase flex items-center gap-1">
                      <GripVertical className="size-3 shrink-0" />
                      <span>{draft.formatName || "Video"}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {draft.checklistTotal > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckSquare className="size-3" />
                          <span>
                            {draft.checklistDone}/{draft.checklistTotal}
                          </span>
                        </span>
                      )}
                      <span className="capitalize">{draft.status}</span>
                    </div>
                  </div>

                  <Link
                    href={`/contents/${draft.id}`}
                    className="text-xs font-mono font-bold text-foreground hover:underline block line-clamp-2"
                  >
                    {draft.title}
                  </Link>

                  {/* Schedule Action */}
                  {schedulingId === draft.id ? (
                    <div className="space-y-2 pt-1 border-t border-border/60">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={scheduleDateInput}
                          onChange={(e) => setScheduleDateInput(e.target.value)}
                          className="flex-1 h-7 px-2 text-xs font-mono bg-background border border-border rounded"
                        />
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleScheduleSubmit(draft.id)}
                          className="h-7 px-2.5 text-[11px] font-mono uppercase font-bold"
                        >
                          Confirm
                        </Button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSchedulingId(null)}
                        className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSchedulingId(draft.id);
                          setScheduleDateInput(selectedDate);
                        }}
                        className="w-full h-7 text-xs font-mono uppercase tracking-wider font-bold gap-1"
                      >
                        <CalendarIcon className="size-3" />
                        <span>Schedule Date</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
