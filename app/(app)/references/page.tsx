import { listReferences, getMasterData } from "@/lib/queries/references";
import { ReferenceFilters } from "./reference-filters";
import { ReferenceCard } from "@/components/app/reference-card";
import { Bookmark, Plus } from "lucide-react";
import { AddLinksDialog } from "@/components/app/add-links-dialog";
import { Button } from "@/components/ui/button";

export const instant = false;

interface ReferencesPageProps {
  searchParams: Promise<{
    status?: string;
    pillar?: string;
    platform?: string;
    format?: string;
    unused?: string;
    q?: string;
  }>;
}

export default async function ReferencesPage({ searchParams }: ReferencesPageProps) {
  const params = await searchParams;

  const [masterData, refsData] = await Promise.all([
    getMasterData(),
    listReferences({
      status: params.status,
      pillarSlug: params.pillar,
      platformSlug: params.platform,
      formatSlug: params.format,
      unusedOnly: params.unused === "1",
      searchText: params.q,
      limit: 36,
    }),
  ]);

  const { items, total } = refsData;

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
              <Bookmark className="size-6 text-foreground" />
              <span>References Library</span>
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
              {total} {total === 1 ? "ref" : "refs"}
            </span>
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Explore, filter and curate your content inspiration database
          </p>
        </div>

        <AddLinksDialog>
          <Button
            size="sm"
            className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Add Links</span>
          </Button>
        </AddLinksDialog>
      </div>

      {/* Filters */}
      <ReferenceFilters masterData={masterData} />

      {/* Grid of References */}
      {items.length === 0 ? (
        <div className="py-20 text-center rounded-lg border border-dashed border-border bg-card/40 space-y-3">
          <Bookmark className="size-8 mx-auto text-muted-foreground/60" />
          <div className="text-sm font-semibold text-foreground font-display">
            No references found
          </div>
          <p className="text-xs font-mono text-muted-foreground max-w-sm mx-auto">
            Try adjusting your status, pillar or search filters to find what you're looking for.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((ref) => (
            <ReferenceCard
              key={ref.id}
              reference={ref}
              masterData={masterData}
              showTriageActions={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
