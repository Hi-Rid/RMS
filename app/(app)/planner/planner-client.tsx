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
  Plus,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { setContentSchedule } from "@/lib/actions/planner";
import { toast } from "sonner";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  differenceInCalendarWeeks,
  parseISO,
} from "date-fns";
import type { PlannerContentItem } from "@/lib/queries/planner";

interface PlannerClientProps {
  weeklyTarget: number;
  postedThisWeek: number;
  scheduledContents: PlannerContentItem[];
  unscheduledContents: PlannerContentItem[];
}

function getJakartaTodayIso(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return format(new Date(), "yyyy-MM-dd");
  }
}

export function PlannerClient({
  weeklyTarget,
  postedThisWeek,
  scheduledContents,
  unscheduledContents,
}: PlannerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [todayIso] = useState<string>(() => getJakartaTodayIso());
  const todayDate = React.useMemo(() => parseISO(todayIso), [todayIso]);

  const [scheduled, setScheduled] = useState<PlannerContentItem[]>(scheduledContents);
  const [unscheduled, setUnscheduled] = useState<PlannerContentItem[]>(unscheduledContents);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDateInput, setScheduleDateInput] = useState<string>(todayIso);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  React.useEffect(() => {
    setScheduled(scheduledContents);
    setUnscheduled(unscheduledContents);
  }, [scheduledContents, unscheduledContents]);

  const progressPct = Math.min(
    100,
    Math.round((postedThisWeek / Math.max(1, weeklyTarget)) * 100)
  );

  const currentWeekStart = React.useMemo(
    () => startOfWeek(todayDate, { weekStartsOn: 1 }),
    [todayDate]
  );
  const weekStart = React.useMemo(
    () => addWeeks(currentWeekStart, weekOffset),
    [currentWeekStart, weekOffset]
  );
  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const visibleWeekSet = React.useMemo(
    () => new Set(weekDays.map((d) => format(d, "yyyy-MM-dd"))),
    [weekDays]
  );

  const jumpToDate = React.useCallback(
    (isoDate: string) => {
      const target = parseISO(isoDate);
      if (Number.isNaN(target.getTime())) return;
      const targetWeekStart = startOfWeek(target, { weekStartsOn: 1 });
      const offsetDiff = differenceInCalendarWeeks(targetWeekStart, currentWeekStart, {
        weekStartsOn: 1,
      });
      setWeekOffset(offsetDiff);
      setSelectedDate(isoDate);
    },
    [currentWeekStart]
  );

  const navigateWeek = (nextOffset: number) => {
    setWeekOffset(nextOffset);
    const nextWeekMonday = addWeeks(currentWeekStart, nextOffset);
    const targetDate = nextOffset === 0 ? todayDate : nextWeekMonday;
    setSelectedDate(format(targetDate, "yyyy-MM-dd"));
  };

  const applyScheduleDate = (contentId: string, targetDateStr: string) => {
    if (!contentId || !targetDateStr) return;

    const existingScheduled = scheduled.find((c) => c.id === contentId);
    if (existingScheduled?.plannedFor === targetDateStr) {
      setSchedulingId(null);
      return;
    }

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
        setSchedulingId(null);
        jumpToDate(targetDateStr);
        toast.success(`Scheduled for ${format(parseISO(targetDateStr), "MMM d, yyyy")}`);
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
        setSchedulingId(null);
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
    applyScheduleDate(contentId, targetDateStr);
  };

  const contentsOnSelectedDate = scheduled.filter((c) => c.plannedFor === selectedDate);
  const scheduledOutsideWeek = scheduled.filter(
    (c) => c.plannedFor && !visibleWeekSet.has(c.plannedFor)
  );

  return (
    <div className="space-y-6">
      {/* 1. Weekly Target Progress Card */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <span className="label-mono text-muted-foreground font-bold">
              Weekly Publishing Goal
            </span>
            <div className="text-sm font-black font-display text-foreground flex items-center gap-2 flex-wrap">
              <span>{postedThisWeek} of {weeklyTarget} posted this week</span>
              <span className="text-xs font-mono text-muted-foreground font-normal tabular-nums">
                ({progressPct}%)
              </span>
            </div>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md tabular-nums ${
              progressPct >= 100
                ? "bg-success text-white"
                : "bg-secondary text-foreground border border-border"
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
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
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

              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek(weekOffset - 1)}
                  title="Previous week"
                  aria-label="Previous week"
                  className="h-8 w-8 p-0 font-mono rounded-md"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant={weekOffset === 0 ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => navigateWeek(0)}
                  className="h-8 px-2.5 text-[11px] font-mono rounded-md"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek(weekOffset + 1)}
                  title="Next week"
                  aria-label="Next week"
                  className="h-8 w-8 p-0 font-mono rounded-md"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  title="Export scheduled content calendar (.ics)"
                  className="h-8 px-2.5 text-[11px] font-mono rounded-md gap-1 ml-1"
                >
                  <a href="/api/planner/ics" download="rms-planner.ics">
                    <Download className="size-3" />
                    <span>.ics</span>
                  </a>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {weekDays.map((day) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const isSelected = selectedDate === dayStr;
                const isCurrentDay = dayStr === todayIso;
                const isDragOver = dragOverDate === dayStr;
                const dayContents = scheduled.filter((c) => c.plannedFor === dayStr);
                const accessibleDay = `${format(day, "EEEE, MMM d")}${
                  isCurrentDay ? " (Today)" : ""
                }, ${dayContents.length} scheduled`;

                return (
                  <button
                    key={dayStr}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={accessibleDay}
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
                    className={`px-1 py-2 sm:p-2.5 rounded-md border text-center transition-colors flex flex-col items-center gap-1 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                      isDragOver
                        ? "ring-2 ring-success border-success bg-success/10 text-foreground"
                        : isSelected
                          ? "bg-foreground text-background border-foreground font-bold"
                          : isCurrentDay
                            ? "bg-secondary/90 border-foreground/40 text-foreground"
                            : "bg-card border-border hover:bg-secondary/40 text-foreground"
                    }`}
                  >
                    <span className="text-[10px] font-mono uppercase opacity-75 leading-none">
                      {format(day, "EEE")}
                    </span>
                    <span className="text-sm font-black font-display leading-none tabular-nums">
                      {format(day, "d")}
                    </span>

                    {dayContents.length > 0 ? (
                      <span
                        className={`text-[10px] font-mono px-1.5 rounded-sm leading-4 tabular-nums ${
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

            {scheduledOutsideWeek.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-[11px] font-mono text-muted-foreground">
                <span>
                  {scheduledOutsideWeek.length} item{scheduledOutsideWeek.length > 1 ? "s" : ""} scheduled in other weeks
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Array.from(new Set(scheduledOutsideWeek.map((s) => s.plannedFor!)))
                    .sort()
                    .slice(0, 4)
                    .map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => jumpToDate(d)}
                        className="px-2 py-0.5 rounded-md border border-border bg-secondary/50 hover:border-foreground/40 text-foreground transition-colors"
                      >
                        {format(parseISO(d), "MMM d")}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Selected Date Content Showcase */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarIcon className="size-4 text-foreground shrink-0" />
                <h3 className="label-mono font-bold text-foreground truncate">
                  Scheduled for {format(parseISO(selectedDate), "EEE, MMM d, yyyy")} ({contentsOnSelectedDate.length})
                </h3>
              </div>
            </div>

            {contentsOnSelectedDate.length === 0 ? (
              <div className="py-10 text-center space-y-3 text-muted-foreground font-mono text-xs">
                <p>No content scheduled for this date.</p>
                <p className="text-[11px] opacity-80">
                  Drag a draft onto a day cell, click &ldquo;Schedule Date&rdquo; on the right, or create a new draft.
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
                    className={`p-3.5 rounded-md bg-secondary/30 border border-border/80 space-y-2.5 hover:border-foreground/30 transition-colors sm:cursor-grab sm:active:cursor-grabbing ${
                      draggingId === content.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-[200px]">
                        <GripVertical className="size-3.5 text-muted-foreground shrink-0 mt-1 hidden sm:block" />
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-foreground text-background font-bold">
                              {content.status}
                            </span>
                            {content.formatName && (
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border">
                                {content.formatName}
                              </span>
                            )}
                            {content.checklistTotal > 0 && (
                              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 tabular-nums">
                                <CheckSquare className="size-3" />
                                <span>
                                  {content.checklistDone}/{content.checklistTotal}
                                </span>
                              </span>
                            )}
                            {content.postedAt && (
                              <span className="text-[10px] font-mono text-success font-bold flex items-center gap-1">
                                <CheckCircle2 className="size-3" />
                                <span>Posted</span>
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/contents/${content.id}`}
                            className="text-xs font-mono font-bold text-foreground hover:underline block break-words"
                          >
                            {content.title}
                          </Link>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            if (schedulingId === content.id) {
                              setSchedulingId(null);
                            } else {
                              setSchedulingId(content.id);
                              setScheduleDateInput(content.plannedFor || selectedDate);
                            }
                          }}
                          className="h-8 px-2 text-[11px] font-mono rounded-md gap-1"
                        >
                          <CalendarClock className="size-3" />
                          <span>Move</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleUnschedule(content.id)}
                          className="h-8 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground rounded-md"
                        >
                          Clear
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-[11px] font-mono uppercase tracking-wider rounded-md"
                        >
                          <Link href={`/contents/${content.id}`}>Studio</Link>
                        </Button>
                      </div>
                    </div>

                    {/* Accessible Touch & Keyboard Reschedule Form */}
                    {schedulingId === content.id && (
                      <div className="pt-2.5 border-t border-border/60 flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          aria-label={`Reschedule date for ${content.title}`}
                          value={scheduleDateInput}
                          onChange={(e) => setScheduleDateInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && scheduleDateInput) {
                              e.preventDefault();
                              applyScheduleDate(content.id, scheduleDateInput);
                            }
                          }}
                          className="min-w-0 flex-1 h-8 px-2 text-xs font-mono bg-background border border-border rounded-md"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={isPending || !scheduleDateInput}
                          onClick={() => applyScheduleDate(content.id, scheduleDateInput)}
                          className="h-8 px-3 text-[11px] font-mono uppercase font-bold rounded-md"
                        >
                          Save Date
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSchedulingId(null)}
                          className="h-8 px-2 text-[11px] font-mono rounded-md"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Unscheduled Production Drafts */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-foreground" />
              <h3 className="label-mono font-bold text-foreground">
                Unscheduled Drafts ({unscheduled.length})
              </h3>
            </div>
          </div>

          <p className="text-[11px] font-mono text-muted-foreground">
            Drag any card onto a day cell or click Schedule Date below.
          </p>

          {unscheduled.length === 0 ? (
            <div className="py-10 text-center space-y-3 text-muted-foreground font-mono text-xs">
              <p>
                {scheduled.length === 0
                  ? "No production drafts yet."
                  : "All production drafts are scheduled!"}
              </p>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs font-mono rounded-md gap-1.5">
                <Link href="/contents/new">
                  <Plus className="size-3.5" />
                  <span>Create Content</span>
                </Link>
              </Button>
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
                  className={`p-3 rounded-md border border-border bg-secondary/20 space-y-2.5 sm:cursor-grab sm:active:cursor-grabbing transition-opacity ${
                    draggingId === draft.id ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span className="uppercase flex items-center gap-1">
                      <GripVertical className="size-3 shrink-0 hidden sm:inline" />
                      <span>{draft.formatName || "Video"}</span>
                    </span>
                    <div className="flex items-center gap-2 tabular-nums">
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

                  {schedulingId === draft.id ? (
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          aria-label={`Schedule date for ${draft.title}`}
                          value={scheduleDateInput}
                          onChange={(e) => setScheduleDateInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && scheduleDateInput) {
                              e.preventDefault();
                              applyScheduleDate(draft.id, scheduleDateInput);
                            }
                          }}
                          className="min-w-0 flex-1 h-8 px-2 text-xs font-mono bg-background border border-border rounded-md"
                        />
                        <Button
                          size="sm"
                          disabled={isPending || !scheduleDateInput}
                          onClick={() => applyScheduleDate(draft.id, scheduleDateInput)}
                          className="h-8 px-2.5 text-[11px] font-mono uppercase font-bold rounded-md shrink-0"
                        >
                          Confirm
                        </Button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSchedulingId(null)}
                        className="text-[11px] font-mono text-muted-foreground hover:text-foreground"
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
                        className="w-full h-8 text-xs font-mono uppercase tracking-wider font-bold rounded-md gap-1.5"
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
