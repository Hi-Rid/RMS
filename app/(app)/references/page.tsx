import Link from "next/link";
import { listReferences, getMasterData } from "@/lib/queries/references";
import { ReferenceFilters } from "./reference-filters";
import { ReferenceCard } from "@/components/app/reference-card";
import { Bookmark, Plus, ChevronLeft, ChevronRight } from "lucide-react";
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
    archived?: string;
    q?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 36;

export default async function ReferencesPage({ searchParams }: ReferencesPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [masterData, refsData] = await Promise.all([
    getMasterData(),
    listReferences({
      status: params.status,
      pillarSlug: params.pillar,
      platformSlug: params.platform,
      formatSlug: params.format,
      unusedOnly: params.unused === "1",
      archived: params.archived === "1",
      searchText: params.q,
      limit: PAGE_SIZE,
      offset,
    }),
  ]);

  const { items, total } = refsData;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildPageHref = (pageNum: number) => {
    const qp = new URLSearchParams();
    if (params.status) qp.set("status", params.status);
    if (params.pillar) qp.set("pillar", params.pillar);
    if (params.platform) qp.set("platform", params.platform);
    if (params.format) qp.set("format", params.format);
    if (params.unused) qp.set("unused", params.unused);
    if (params.archived) qp.set("archived", params.archived);
    if (params.q) qp.set("q", params.q);
    if (pageNum > 1) qp.set("page", String(pageNum));
    const qs = qp.toString();
    return qs ? `/references?${qs}` : "/references";
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
              <Bookmark className="size-6 text-foreground" />
              <span>
                {params.archived === "1" ? "Archived References" : "References Library"}
              </span>
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
              {total} {total === 1 ? "ref" : "refs"}
            </span>
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {params.archived === "1"
              ? "Restore archived items back to active workflows"
              : "Explore, filter and curate your content inspiration database"}
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
            Try adjusting your status, platform, format, pillar or search filters to find what you&apos;re looking for.
          </p>
        </div>
      ) : (
        <>
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

          {totalPages > 1 && (
            <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-4 text-xs font-mono">
              <span className="text-muted-foreground">
                Showing {offset + 1}–{Math.min(offset + items.length, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link href={buildPageHref(currentPage - 1)}>
                    <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs font-mono gap-1">
                      <ChevronLeft className="size-3.5" />
                      <span>Prev</span>
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled className="h-8 px-2.5 text-xs font-mono gap-1">
                    <ChevronLeft className="size-3.5" />
                    <span>Prev</span>
                  </Button>
                )}

                <span className="px-2 font-bold text-foreground">
                  Page {currentPage} / {totalPages}
                </span>

                {currentPage < totalPages ? (
                  <Link href={buildPageHref(currentPage + 1)}>
                    <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs font-mono gap-1">
                      <span>Next</span>
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled className="h-8 px-2.5 text-xs font-mono gap-1">
                    <span>Next</span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
