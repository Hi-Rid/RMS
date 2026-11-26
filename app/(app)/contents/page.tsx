import Link from "next/link";
import {
  listContents,
  getStudioMasterOptions,
  getContentCounts,
  type ContentSortOption,
} from "@/lib/queries/contents";
import { getMasterData } from "@/lib/queries/references";
import { ContentFilters } from "./content-filters";
import { ContentsViewClient } from "@/components/app/contents-view-client";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  FileVideo,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

export const instant = false;

interface ContentsPageProps {
  searchParams: Promise<{
    status?: string;
    pillar?: string;
    format?: string;
    series?: string;
    hookType?: string;
    planned?: string;
    archived?: string;
    q?: string;
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 30;

function getPaginationRange(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const range: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const pageNum = sorted[i];
    if (i > 0 && pageNum - sorted[i - 1] > 1) {
      range.push("ellipsis");
    }
    range.push(pageNum);
  }
  return range;
}

export default async function ContentsPage({ searchParams }: ContentsPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const archived = params.archived === "1";
  const plannedFilter =
    params.planned === "scheduled" || params.planned === "unscheduled"
      ? params.planned
      : "all";
  const sort: ContentSortOption =
    params.sort === "updated" ||
    params.sort === "planned" ||
    params.sort === "oldest" ||
    params.sort === "title" ||
    params.sort === "rating"
      ? params.sort
      : "recent";

  const [masterData, studioOptions, counts, contentsData] = await Promise.all([
    getMasterData(),
    getStudioMasterOptions(),
    getContentCounts(),
    listContents({
      status: params.status,
      pillarSlug: params.pillar,
      formatSlug: params.format,
      seriesId: params.series,
      hookTypeSlug: params.hookType,
      plannedFilter,
      archived,
      searchText: params.q,
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
  ]);

  // Evaluated strictly after dynamic queries to satisfy Next.js cacheComponents
  const todayIso = new Date().toISOString().slice(0, 10);

  const { items, total } = contentsData;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const hasFilters = Boolean(
    params.status ||
      params.pillar ||
      params.format ||
      params.series ||
      params.hookType ||
      plannedFilter !== "all" ||
      archived ||
      params.q ||
      sort !== "recent"
  );

  const buildPageHref = (pageNum: number) => {
    const qp = new URLSearchParams();
    if (params.status) qp.set("status", params.status);
    if (params.pillar) qp.set("pillar", params.pillar);
    if (params.format) qp.set("format", params.format);
    if (params.series) qp.set("series", params.series);
    if (params.hookType) qp.set("hookType", params.hookType);
    if (plannedFilter !== "all") qp.set("planned", plannedFilter);
    if (archived) qp.set("archived", "1");
    if (params.q) qp.set("q", params.q);
    if (sort !== "recent") qp.set("sort", sort);
    if (pageNum > 1) qp.set("page", String(pageNum));
    const qs = qp.toString();
    return qs ? `/contents?${qs}` : "/contents";
  };

  const pageNumbers = getPaginationRange(safePage, totalPages);

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      <PageHeader
        title={archived ? "Archived Contents" : "Contents Studio"}
        subtitle={
          archived
            ? "Restore archived content drafts or permanently delete unused studio entries."
            : "Plan, script, track shoot checklists, and publish across platforms."
        }
        icon={<FileVideo className="size-6 text-foreground" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border tabular-nums">
            {total} {total === 1 ? "content" : "contents"}
            {!archived && counts.scheduled > 0 ? ` · ${counts.scheduled} planned` : ""}
          </span>
        }
        actions={
          <>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 text-xs font-mono rounded-md gap-1.5"
            >
              <Link href="/planner">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span>Planner</span>
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="text-xs font-mono h-8 rounded-md bg-brand text-primary-foreground hover:bg-brand/90 font-bold gap-1.5"
            >
              <Link href="/contents/new">
                <Plus className="size-3.5" />
                <span>New Content</span>
              </Link>
            </Button>
          </>
        }
      />

      {/* Filters */}
      <ContentFilters
        masterData={masterData}
        seriesList={studioOptions.series}
        counts={counts}
      />

      {/* Empty States or Content Views */}
      {items.length === 0 ? (
        total > 0 && currentPage > totalPages ? (
          <EmptyState
            icon={<FileVideo className="size-5" />}
            title={`Page ${currentPage} is empty`}
            description={`There are ${total} matching content pieces across ${totalPages} page${totalPages > 1 ? "s" : ""}.`}
            primaryAction={{
              label: "Jump to Page 1",
              href: buildPageHref(1),
            }}
          />
        ) : hasFilters ? (
          <EmptyState
            icon={<FileVideo className="size-5" />}
            title={archived ? "No Archived Contents" : "No Matching Contents"}
            description={
              archived
                ? "No archived content pieces match your current filters."
                : "No content pieces match your current stage, hook, schedule, pillar, or search filters."
            }
            primaryAction={{
              label: "Clear All Filters",
              href: "/contents",
              icon: <RotateCcw className="size-3.5" />,
            }}
            secondaryAction={{
              label: "Create New Content",
              href: "/contents/new",
              icon: <Plus className="size-3.5" />,
            }}
          />
        ) : (
          <EmptyState
            icon={<FileVideo className="size-5" />}
            title="Start Your First Content Piece"
            description="Create an original draft or adapt a curated reference into a structured script and shoot checklist."
            primaryAction={{
              label: "Create New Content",
              href: "/contents/new",
              icon: <Plus className="size-3.5" />,
            }}
            secondaryAction={{
              label: "Pick from References",
              href: "/references?status=selected",
            }}
          />
        )
      ) : (
        <div className="space-y-6">
          <ContentsViewClient
            items={items}
            todayIso={todayIso}
            isArchivedView={archived}
            activeStatusFilter={params.status || "all"}
          />

          {totalPages > 1 && (
            <div className="pt-4 border-t border-border/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <span className="text-muted-foreground tabular-nums">
                Showing {offset + 1}–{Math.min(offset + items.length, total)} of {total} contents
                <span className="text-muted-foreground/70">
                  {" "}
                  (Page {safePage} of {totalPages})
                </span>
              </span>

              <div className="flex items-center gap-1 flex-wrap">
                {safePage > 1 ? (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-mono rounded-md gap-1"
                  >
                    <Link href={buildPageHref(safePage - 1)}>
                      <ChevronLeft className="size-3.5" />
                      <span>Prev</span>
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="h-8 px-2.5 text-xs font-mono rounded-md gap-1"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>Prev</span>
                  </Button>
                )}

                {pageNumbers.map((entry, idx) =>
                  entry === "ellipsis" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 text-xs font-mono text-muted-foreground select-none"
                    >
                      …
                    </span>
                  ) : entry === safePage ? (
                    <span
                      key={entry}
                      aria-current="page"
                      className="h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-md bg-foreground text-background text-xs font-mono font-bold tabular-nums"
                    >
                      {entry}
                    </span>
                  ) : (
                    <Button
                      key={entry}
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-8 min-w-8 px-2 text-xs font-mono rounded-md tabular-nums"
                    >
                      <Link href={buildPageHref(entry)}>{entry}</Link>
                    </Button>
                  )
                )}

                {safePage < totalPages ? (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-mono rounded-md gap-1"
                  >
                    <Link href={buildPageHref(safePage + 1)}>
                      <span>Next</span>
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="h-8 px-2.5 text-xs font-mono rounded-md gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
