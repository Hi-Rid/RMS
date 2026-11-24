"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Plus,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { setContentSchedule } from "@/lib/actions/planner";
import { toast } from "sonner";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
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
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDateInput, setScheduleDateInput] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  // Calculate weekly target progress
  const progressPct = Math.min(100, Math.round((postedThisWeek / Math.max(1, weeklyTarget)) * 100));

  // Build This Week days (Monday to Sunday)
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handleScheduleSubmit = (contentId: string) => {
    if (!scheduleDateInput) return;
    startTransition(async () => {
      const res = await setContentSchedule({
        contentId,
        dateStr: scheduleDateInput,
      });

      if (res.ok) {
        toast.success("Content scheduled");
        setSchedulingId(null);
        window.location.reload();
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
        toast.success("Schedule cleared");
        window.location.reload();
      } else {
        toast.error(res.error.message);
      }
    });
  };

  // Find contents for selected date
  const contentsOnSelectedDate = scheduledContents.filter((c) => c.plannedFor === selectedDate);

  return (
    <div className="space-y-6">
      {/* 1. Weekly Target Progress Card (PRD §12.14) */}
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
          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md ${progressPct >= 100 ? "bg-emerald-600 text-white" : "bg-secondary text-foreground"}`}>
            {progressPct >= 100 ? "Goal Reached!" : `${Math.max(0, weeklyTarget - postedThisWeek)} remaining`}
          </span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* 2. Main Planner Workspace: Calendar / This Week + Unscheduled Drafts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Week Schedule Timeline & Selected Day */}
        <div className="lg:col-span-2 space-y-5">
          {/* Week Strip (Monday - Sunday) */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
              <span>This Week Schedule</span>
              <span>{format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((day) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const isSelected = selectedDate === dayStr;
                const isCurrentDay = isSameDay(day, today);
                const dayContents = scheduledContents.filter((c) => c.plannedFor === dayStr);

                return (
                  <button
                    key={dayStr}
                    type="button"
                    onClick={() => setSelectedDate(dayStr)}
                    className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1 select-none ${
                      isSelected
                        ? "bg-foreground text-background border-foreground font-bold shadow-sm"
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
                    {dayContents.length > 0 && (
                      <span
                        className={`size-1.5 rounded-full mt-0.5 ${
                          isSelected ? "bg-background" : "bg-primary"
                        }`}
                      />
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
                    className="p-3.5 rounded-lg bg-secondary/30 border border-border/80 flex items-center justify-between gap-3 hover:border-foreground/30 transition-colors"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-foreground text-background font-bold">
                          {content.status}
                        </span>
                        {content.formatName && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                            {content.formatName}
                          </span>
                        )}
                        {content.postedAt && (
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            Posted
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

        {/* Right Column: Unscheduled Production Drafts (PRD §12.14) */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-foreground" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                Unscheduled Drafts ({unscheduledContents.length})
              </h3>
            </div>
          </div>

          <p className="text-[11px] font-mono text-muted-foreground">
            Contents in production without a planned publishing date.
          </p>

          {unscheduledContents.length === 0 ? (
            <div className="py-10 text-center space-y-1 text-muted-foreground font-mono text-xs">
              <p>All production drafts are scheduled!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unscheduledContents.map((draft) => (
                <div
                  key={draft.id}
                  className="p-3 rounded-lg border border-border bg-secondary/20 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span className="uppercase">{draft.formatName || "Video"}</span>
                    <span className="capitalize">{draft.status}</span>
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
