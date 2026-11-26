import Link from "next/link";
import { listSources, type SourceSortOption } from "@/lib/queries/sources";
import { getMasterData } from "@/lib/queries/references";
import { SourcesListClient } from "@/app/(app)/sources/sources-list-client";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Users, Bookmark } from "lucide-react";

export const instant = false;

interface SourcesPageProps {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    platform?: string;
    filter?: string;
  }>;
}

export default async function SourcesPage({ searchParams }: SourcesPageProps) {
  const params = await searchParams;
  const [items, masterData] = await Promise.all([listSources(), getMasterData()]);

  const validSorts: SourceSortOption[] = [
    "refs",
    "hit_rate",
    "score",
    "recent",
    "handle",
  ];
  const initialSort: SourceSortOption = validSorts.includes(
    params.sort as SourceSortOption
  )
    ? (params.sort as SourceSortOption)
    : "refs";

  const initialScope: "all" | "curated" | "inbox" | "rated" =
    params.filter === "curated" ||
    params.filter === "inbox" ||
    params.filter === "rated"
      ? params.filter
      : "all";

  const inboxCount = items.reduce((acc, item) => acc + item.inboxCount, 0);

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      <PageHeader
        title="Source Accounts"
        subtitle="Track creator handles, hit rates, studio conversions, and inspiration angles"
        icon={<Users className="size-6 text-foreground" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border tabular-nums">
            {items.length} {items.length === 1 ? "creator" : "creators"}
            {inboxCount > 0 ? ` · ${inboxCount} inbox` : ""}
          </span>
        }
        actions={
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 text-xs font-mono rounded-md gap-1.5"
          >
            <Link href="/references">
              <Bookmark className="size-3.5 text-muted-foreground" />
              <span>References</span>
            </Link>
          </Button>
        }
      />

      <SourcesListClient
        initialItems={items}
        platforms={masterData.platforms}
        initialQuery={params.q || ""}
        initialSort={initialSort}
        initialPlatform={params.platform || "all"}
        initialScope={initialScope}
      />
    </div>
  );
}
