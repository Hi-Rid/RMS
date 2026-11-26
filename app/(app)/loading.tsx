import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-8 w-44 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
          <Skeleton className="h-3.5 w-72 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-60 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-5 w-4/5 rounded-md" />
            <Skeleton className="h-3.5 w-full rounded-md" />
            <Skeleton className="h-3.5 w-2/3 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
