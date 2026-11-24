import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="relative min-h-full w-full py-10 px-4 sm:px-8 flex flex-col items-center">
      <div className="relative w-full max-w-2xl flex flex-col items-center space-y-8">
        {/* Centered Hero Skeleton */}
        <div className="flex flex-col items-center text-center space-y-3">
          <Skeleton className="size-11 rounded-lg" />
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-4 w-36 rounded-md" />
        </div>

        {/* Prompt Box Skeleton */}
        <div className="w-full space-y-3">
          <Skeleton className="w-full h-[96px] rounded-xl" />
          <div className="flex flex-col items-center gap-2 pt-1">
            <div className="flex items-center justify-center flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-20 rounded-md" />
              ))}
            </div>
            <div className="flex items-center justify-center">
              <Skeleton className="h-7 w-28 rounded-md" />
            </div>
          </div>
        </div>

        {/* Focus Card Skeleton */}
        <Card className="w-full rounded-xl border bg-card p-6 shadow-none space-y-6">
          <div className="flex items-start justify-between border-b border-border/70 pb-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-6 w-52 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
            <Skeleton className="size-7 rounded-md" />
          </div>

          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="size-6 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-3 w-64 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Bottom 2-col Grid Skeleton */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </Card>
          <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </Card>
        </div>
      </div>
    </div>
  );
}
