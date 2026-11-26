import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SourcesLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-52 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
          <Skeleton className="h-3.5 w-80 rounded-md" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-3.5 space-y-2">
            <Skeleton className="h-3 w-28 rounded-md" />
            <Skeleton className="h-6 w-14 rounded-md" />
          </div>
        ))}
      </div>

      {/* Controls & tabs skeleton */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <Skeleton className="h-9 w-full max-w-md rounded-md" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-9 w-40 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 border-b border-border/60 pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-md" />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border/60">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4 p-4">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-44 rounded-md" />
                <Skeleton className="h-3 w-64 rounded-md" />
              </div>
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-7 w-28 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
