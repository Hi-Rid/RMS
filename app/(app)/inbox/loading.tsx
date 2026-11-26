import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-32 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
          <Skeleton className="h-3.5 w-72 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-36 rounded-md" />
        </div>
      </div>

      <Skeleton className="h-12 w-full rounded-lg" />

      <div className="space-y-3 border-b border-border/70 pb-4">
        <div className="flex flex-col lg:flex-row justify-between gap-3">
          <Skeleton className="h-9 w-full max-w-md rounded-md" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="bg-card border border-border rounded-lg overflow-hidden space-y-2.5 pb-3">
            <Skeleton className="aspect-[4/5] w-full rounded-none" />
            <div className="px-3 space-y-2">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-6 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
