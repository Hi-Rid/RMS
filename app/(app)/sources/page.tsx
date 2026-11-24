import { listSources } from "@/lib/queries/sources";
import { SourcesListClient } from "@/app/(app)/sources/sources-list-client";
import { Users } from "lucide-react";

export const instant = false;

interface SourcesPageProps {
  searchParams: Promise<{
    q?: string;
    sort?: "refs" | "handle";
  }>;
}

export default async function SourcesPage({ searchParams }: SourcesPageProps) {
  const params = await searchParams;
  const items = await listSources({
    searchText: params.q,
    sortBy: params.sort,
  });

  return (
    <div className="w-full max-w-6xl py-8 px-4 sm:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
              <Users className="size-6 text-foreground" />
              <span>Source Accounts</span>
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
              {items.length} {items.length === 1 ? "creator" : "creators"}
            </span>
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Track creator handles, reference conversion rates, and inspiration performance
          </p>
        </div>
      </div>

      <SourcesListClient initialItems={items} />
    </div>
  );
}
