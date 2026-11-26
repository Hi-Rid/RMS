import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-8 lg:px-10 space-y-6 sm:space-y-8">
      {/* Header & Quick Ingest Skeleton */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/80 pb-5">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-48 rounded-md" />
            <Skeleton className="h-7 w-40 rounded-md" />
            <Skeleton className="h-3.5 w-64 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-3.5 w-72 rounded-md" />
        </div>
      </div>

      {/* Weekly Target + 4-Stage Pipeline Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="size-4 rounded-sm" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-7 w-12 rounded-md" />
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-full rounded-md" />
              </div>
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Lower 2-Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <Skeleton className="h-4 w-48 rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <Skeleton className="h-4 w-44 rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <Skeleton className="h-4 w-48 rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-8 rounded-md" />
              <Skeleton className="h-8 rounded-md" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <Skeleton className="h-4 w-40 rounded-md" />
            <div className="grid grid-cols-3 gap-2.5">
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
