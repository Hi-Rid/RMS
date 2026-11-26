import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ContentsLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-52 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <Skeleton className="h-3.5 w-80 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      {/* Filters skeleton */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row justify-between gap-3">
          <Skeleton className="h-9 w-full max-w-md rounded-md" />
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 border-b border-border/60 pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-md" />
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-md" />
          ))}
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-card border border-border rounded-lg p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-4/5 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <div className="pt-3 border-t border-border/60 flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
