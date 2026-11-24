import { connection } from "next/server";
import { getPlannerData } from "@/lib/queries/planner";
import { PlannerClient } from "@/app/(app)/planner/planner-client";
import { Calendar } from "lucide-react";

export const instant = false;

export default async function PlannerPage() {
  await connection();
  const data = await getPlannerData();

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
              <Calendar className="size-6 text-foreground" />
              <span>Content Planner</span>
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
              {data.scheduledContents.length} Scheduled
            </span>
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Weekly editorial schedule, publishing cadence & production calendar
          </p>
        </div>
      </div>

      <PlannerClient
        weeklyTarget={data.weeklyTarget}
        postedThisWeek={data.postedThisWeek}
        scheduledContents={data.scheduledContents}
        unscheduledContents={data.unscheduledContents}
      />
    </div>
  );
}
