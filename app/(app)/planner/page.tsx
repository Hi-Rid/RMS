import { connection } from "next/server";
import Link from "next/link";
import { getPlannerData } from "@/lib/queries/planner";
import { PlannerClient } from "@/app/(app)/planner/planner-client";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, Settings } from "lucide-react";

export const instant = false;

export default async function PlannerPage() {
  await connection();
  const data = await getPlannerData();

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      <PageHeader
        title="Content Planner"
        subtitle="Weekly editorial schedule, publishing cadence & production calendar"
        icon={<Calendar className="size-6 text-foreground" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border tabular-nums">
            {data.scheduledContents.length} Scheduled
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="text-xs font-mono h-8 rounded-md gap-1.5">
              <Link href="/settings?tab=general">
                <Settings className="size-3.5" />
                <span>Weekly Goal</span>
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="text-xs font-mono h-8 rounded-md bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5"
            >
              <Link href="/contents/new">
                <Plus className="size-3.5" />
                <span>New Content</span>
              </Link>
            </Button>
          </>
        }
      />

      <PlannerClient
        weeklyTarget={data.weeklyTarget}
        postedThisWeek={data.postedThisWeek}
        scheduledContents={data.scheduledContents}
        unscheduledContents={data.unscheduledContents}
      />
    </div>
  );
}
